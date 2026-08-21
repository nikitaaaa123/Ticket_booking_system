import crypto from 'crypto';
import { store } from '../db/store.ts';
import { Booking, BookingItem, ShowSeat } from '../types/index.ts';
import { realtimeService } from './realtime.service.ts';
import { QRService } from './qr.service.ts';
import { EmailService } from './email.service.ts';
import { WaitlistService } from './waitlist.service.ts';

export interface ConfirmBookingParams {
  showId: string;
  seatIds: string[];
  userId: string;
  holdSessionToken?: string;
  customerEmail?: string;
  customerName?: string;
}

export interface ConfirmBookingResult {
  success: boolean;
  booking?: Booking & {
    showTitle: string;
    venueName: string;
    seatLabels: string[];
    qrCodeDataURL: string;
  };
  error?: string;
  message?: string;
}

export class BookingService {
  /**
   * Generates a clean, human-friendly booking reference (e.g., 'BK-893A4F72')
   */
  public static generateBookingReference(): string {
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `BK-${randomHex}`;
  }

  /**
   * Confirm Booking: Converts held seats into a permanent confirmed booking atomically.
   */
  public static async confirmBooking(params: ConfirmBookingParams): Promise<ConfirmBookingResult> {
    const { showId, seatIds, userId, holdSessionToken, customerEmail, customerName } = params;

    if (!seatIds || seatIds.length === 0) {
      return { success: false, error: 'ValidationError', message: 'No seats provided for booking.' };
    }

    const show = store.shows.get(showId);
    if (!show) {
      return { success: false, error: 'NotFound', message: `Show ${showId} not found.` };
    }

    const venue = store.venues.get(show.venueId);
    const user = store.users.get(userId);

    const emailToUse = customerEmail || user?.email;
    const nameToUse = customerName || user?.fullName || 'Valued Customer';

    if (!emailToUse) {
      return { success: false, error: 'ValidationError', message: 'Recipient customer email is required.' };
    }

    const now = new Date();
    const sortedSeatIds = [...seatIds].sort();

    const verifiedSeats: ShowSeat[] = [];
    const bookingItems: BookingItem[] = [];
    const seatLabels: string[] = [];
    let totalAmountCents = 0;

    // Validate all seats are held by this user and hold hasn't expired
    for (const seatId of sortedSeatIds) {
      const seat = store.showSeats.get(seatId);
      if (!seat || seat.showId !== showId) {
        return { success: false, error: 'SeatNotFound', message: `Seat ${seatId} not found for show.` };
      }

      const isExpired = seat.holdExpiresAt && new Date(seat.holdExpiresAt) <= now;
      const isMyHold =
        seat.status === 'HELD' &&
        ((seat.heldByUserId && seat.heldByUserId === userId) ||
          (holdSessionToken && seat.holdSessionToken === holdSessionToken));

      if (!isMyHold || isExpired) {
        return {
          success: false,
          error: 'HoldExpiredOrInvalid',
          message: `Hold for seat ${seatId} has expired or was not placed by you. Please select and hold again.`,
        };
      }

      const physicalSeat = store.seats.get(seat.seatId);
      const pricing = Array.from(store.showPricing.values()).find(
        (p) => p.showId === showId && p.categoryId === seat.categoryId
      );
      const priceCents = pricing?.priceCents || 0;

      const label = physicalSeat ? `Row ${physicalSeat.rowLabel}-${physicalSeat.seatNumber}` : seatId;
      seatLabels.push(label);

      bookingItems.push({
        id: `bi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bookingId: '', // populated below
        showSeatId: seat.id,
        seatLabel: label,
        categoryId: seat.categoryId,
        priceCents,
      });

      totalAmountCents += priceCents;
      verifiedSeats.push(seat);
    }

    // Generate reference and booking record
    const bookingId = `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const bookingReference = this.generateBookingReference();

    // Link booking items
    bookingItems.forEach((bi) => (bi.bookingId = bookingId));

    // Generate QR Code containing verifiable pass payload
    const qrDataURL = await QRService.generateDataURL({
      ref: bookingReference,
      showId: show.id,
      showTitle: show.title,
      seats: seatLabels,
      userId,
      confirmedAt: now.toISOString(),
    });

    const qrBuffer = await QRService.generateBuffer({
      ref: bookingReference,
      showId: show.id,
      showTitle: show.title,
      seats: seatLabels,
      userId,
      confirmedAt: now.toISOString(),
    });

    const newBooking: Booking = {
      id: bookingId,
      bookingReference,
      showId,
      userId,
      customerEmail: emailToUse,
      customerName: nameToUse,
      totalAmountCents,
      currency: 'USD',
      status: 'CONFIRMED',
      items: bookingItems,
      qrCodeDataURL: qrDataURL,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Commit Booking and mark ShowSeats as 'BOOKED'
    store.bookings.set(newBooking.id, newBooking);

    for (const seat of verifiedSeats) {
      seat.status = 'BOOKED';
      seat.heldByUserId = null;
      seat.holdExpiresAt = null;
      seat.holdSessionToken = null;
      seat.version += 1;
      seat.updatedAt = now.toISOString();
      store.showSeats.set(seat.id, seat);
    }

    // Broadcast Real-time event to all clients viewing the seat map
    realtimeService.broadcastToShow(showId, {
      type: 'SEAT_BOOKED',
      showId,
      seatIds: sortedSeatIds,
      bookingReference,
    });

    // Asynchronously dispatch confirmation email with QR code
    EmailService.sendBookingConfirmation({
      recipientEmail: emailToUse,
      recipientName: nameToUse,
      bookingReference,
      showTitle: show.title,
      venueName: venue?.name || 'Grand Stage Venue',
      venueAddress: venue?.address || '',
      startTime: show.startTime,
      seatLabels,
      totalAmountFormatted: `$${(totalAmountCents / 100).toFixed(2)}`,
      qrCodeDataURL: qrDataURL,
      qrCodeBuffer: qrBuffer,
    }).catch((err) => {
      console.error('[BookingService] Failed to send email async:', err);
    });

    return {
      success: true,
      booking: {
        ...newBooking,
        showTitle: show.title,
        venueName: venue?.name || 'Grand Stage Venue',
        seatLabels,
        qrCodeDataURL: qrDataURL,
      },
    };
  }

  /**
   * Cancel Booking: Marks booking CANCELLED, flips seats back to AVAILABLE,
   * broadcasts update, and invokes waitlist reallocation hooks.
   */
  public static async cancelBooking(
    bookingId: string,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; freedSeatIds?: string[]; message?: string; error?: string }> {
    const booking = store.bookings.get(bookingId);

    if (!booking) {
      return { success: false, error: 'NotFound', message: `Booking ${bookingId} not found.` };
    }

    if (booking.userId !== userId) {
      const requestingUser = store.users.get(userId);
      if (requestingUser?.role !== 'ADMIN') {
        return { success: false, error: 'Forbidden', message: 'You do not have permission to cancel this booking.' };
      }
    }

    if (booking.status === 'CANCELLED') {
      return { success: false, error: 'AlreadyCancelled', message: 'This booking has already been cancelled.' };
    }

    const now = new Date();
    booking.status = 'CANCELLED';
    booking.cancelledAt = now.toISOString();
    booking.cancellationReason = reason || 'Customer requested cancellation';
    booking.updatedAt = now.toISOString();
    store.bookings.set(booking.id, booking);

    const freedSeatIds: string[] = [];
    const reallocatedOffers: any[] = [];
    const publicFreedSeatIds: string[] = [];

    // Revert each seat back to AVAILABLE first, then reallocate to waitlist if queue exists
    for (const item of booking.items) {
      const seat = store.showSeats.get(item.showSeatId);
      if (seat && seat.showId === booking.showId) {
        seat.status = 'AVAILABLE';
        seat.heldByUserId = null;
        seat.holdExpiresAt = null;
        seat.holdSessionToken = null;
        seat.version += 1;
        seat.updatedAt = now.toISOString();
        store.showSeats.set(seat.id, seat);
        freedSeatIds.push(seat.id);

        // Process waitlist for this freed seat
        const waitlistResult = await WaitlistService.processWaitlistForFreedSeat(booking.showId, seat.id);
        if (waitlistResult.allocated && waitlistResult.offer) {
          reallocatedOffers.push(waitlistResult.offer);
        } else {
          publicFreedSeatIds.push(seat.id);
        }
      }
    }

    // Broadcast seat release to public viewers only for seats that were not offered to waitlist
    if (publicFreedSeatIds.length > 0) {
      realtimeService.broadcastToShow(booking.showId, {
        type: 'SEAT_RELEASED',
        showId: booking.showId,
        seatIds: publicFreedSeatIds,
        reason: 'BOOKING_CANCELLED',
      });
    }

    const waitlistMsg =
      reallocatedOffers.length > 0
        ? ` (${reallocatedOffers.length} seat(s) automatically offered to waiting customers)`
        : '';

    return {
      success: true,
      freedSeatIds,
      message: `Booking ${booking.bookingReference} successfully cancelled. ${freedSeatIds.length} seat(s) returned to inventory${waitlistMsg}.`,
    };
  }

  /**
   * Get Customer Booking History
   */
  public static getCustomerBookings(userId: string): any[] {
    const bookings = Array.from(store.bookings.values())
      .filter((b) => b.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return bookings.map((b) => {
      const show = store.shows.get(b.showId);
      const venue = show ? store.venues.get(show.venueId) : null;
      return {
        ...b,
        showTitle: show?.title || 'Unknown Event',
        showStartTime: show?.startTime,
        showEndTime: show?.endTime,
        venueName: venue?.name || 'Unknown Venue',
        venueCity: venue?.city || '',
        seatCount: b.items.length,
        seatLabels: b.items.map((i) => i.seatLabel),
      };
    });
  }
}
