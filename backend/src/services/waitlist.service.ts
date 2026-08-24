import crypto from 'crypto';
import { store } from '../db/store.ts';
import {
  WaitlistEntry,
  WaitlistOffer,
  WaitlistStatus,
  OfferStatus,
  ShowSeat,
  Booking,
} from '../types/index.ts';
import { config } from '../config/env.ts';
import { realtimeService } from './realtime.service.ts';
import { EmailService } from './email.service.ts';
import { BookingService } from './booking.service.ts';

export interface JoinWaitlistParams {
  showId: string;
  categoryId: string;
  userId: string;
  customerEmail?: string;
  customerName?: string;
  requestedSeatsCount?: number;
}

export interface JoinWaitlistResult {
  success: boolean;
  waitlistEntry?: WaitlistEntry;
  queuePosition?: number;
  totalWaitingInQueue?: number;
  message?: string;
  error?: string;
}

export interface OfferDetailsResult {
  success: boolean;
  offer?: {
    id: string;
    offerToken: string;
    showId: string;
    showTitle: string;
    venueName: string;
    venueAddress: string;
    startTime: string;
    seatId: string;
    seatLabel: string;
    categoryId: string;
    categoryName: string;
    priceCents: number;
    priceFormatted: string;
    expiresAt: string;
    remainingSeconds: number;
    status: OfferStatus;
    customerEmail?: string;
    customerName?: string;
  };
  error?: string;
  message?: string;
}

export class WaitlistService {
  /**
   * Endpoint 1: Join Waitlist for a Show + Category
   * Adds the customer to a strict FIFO queue.
   */
  public static async joinWaitlist(params: JoinWaitlistParams): Promise<JoinWaitlistResult> {
    const { showId, categoryId, userId, customerEmail, customerName, requestedSeatsCount = 1 } = params;

    const show = store.shows.get(showId);
    if (!show) {
      return { success: false, error: 'ShowNotFound', message: `Show ${showId} not found.` };
    }

    const venue = store.venues.get(show.venueId);
    const category = Array.from(store.categories.values()).find(
      (c) => c.id === categoryId && c.venueId === show.venueId
    );
    if (!category) {
      return { success: false, error: 'CategoryNotFound', message: `Category ${categoryId} not found for this venue.` };
    }

    const user = store.users.get(userId);
    const emailToUse = customerEmail || user?.email;
    const nameToUse = customerName || user?.fullName || 'Valued Customer';

    if (!emailToUse) {
      return { success: false, error: 'ValidationError', message: 'Customer email is required to join waitlist.' };
    }

    // Edge Case: Deduplication - Check if customer already has an active (WAITING or OFFERED) entry for this category
    const existingActive = Array.from(store.waitlist.values()).find(
      (w) =>
        w.showId === showId &&
        w.categoryId === categoryId &&
        (w.userId === userId || (emailToUse && w.customerEmail === emailToUse)) &&
        (w.status === 'WAITING' || w.status === 'OFFERED')
    );

    if (existingActive) {
      const activeQueue = this.getQueueForCategory(showId, categoryId);
      const position = activeQueue.findIndex((w) => w.id === existingActive.id) + 1;
      return {
        success: true,
        waitlistEntry: existingActive,
        queuePosition: position > 0 ? position : 1,
        totalWaitingInQueue: activeQueue.length,
        message: `You are already on the waitlist for ${category.name} at position #${position || 1}.`,
      };
    }

    // Determine FIFO Priority Order (Highest existing priority + 1)
    const existingQueue = this.getQueueForCategory(showId, categoryId);
    const maxPriority = existingQueue.reduce((max, item) => Math.max(max, item.priorityOrder || 0), 0);
    const newPriority = maxPriority + 1;

    const now = new Date().toISOString();
    const waitlistEntry: WaitlistEntry = {
      id: `wl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      showId,
      categoryId,
      userId,
      customerEmail: emailToUse,
      customerName: nameToUse,
      requestedSeatsCount,
      status: 'WAITING',
      priorityOrder: newPriority,
      createdAt: now,
      updatedAt: now,
    };

    store.waitlist.set(waitlistEntry.id, waitlistEntry);

    const updatedQueue = this.getQueueForCategory(showId, categoryId);
    const queuePosition = updatedQueue.findIndex((w) => w.id === waitlistEntry.id) + 1;

    return {
      success: true,
      waitlistEntry,
      queuePosition,
      totalWaitingInQueue: updatedQueue.length,
      message: `Successfully joined waitlist for ${category.name}. You are position #${queuePosition} in line.`,
    };
  }

  /**
   * Helper: Get active FIFO queue for a show category
   */
  public static getQueueForCategory(showId: string, categoryId: string): WaitlistEntry[] {
    return Array.from(store.waitlist.values())
      .filter((w) => w.showId === showId && w.categoryId === categoryId && w.status === 'WAITING')
      .sort((a, b) => {
        if (a.priorityOrder !== b.priorityOrder) {
          return a.priorityOrder - b.priorityOrder;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }

  /**
   * Reallocation Core: When a seat frees up (via booking cancellation, hold expiry, or declined offer),
   * pop the next customer from that category's queue and issue a time-limited offer.
   */
  public static async processWaitlistForFreedSeat(
    showId: string,
    showSeatId: string
  ): Promise<{ allocated: boolean; offer?: WaitlistOffer; waitlistEntry?: WaitlistEntry; reason?: string }> {
    const seat = store.showSeats.get(showSeatId);
    if (!seat || seat.showId !== showId) {
      return { allocated: false, reason: 'SeatNotFound' };
    }

    const show = store.shows.get(showId);
    if (!show) {
      return { allocated: false, reason: 'ShowNotFound' };
    }

    // Edge Case: Check if show start time has already passed
    if (new Date(show.startTime) <= new Date()) {
      return { allocated: false, reason: 'ShowAlreadyStarted' };
    }

    // Retrieve the next waiting customer (FIFO)
    const queue = this.getQueueForCategory(showId, seat.categoryId);

    // Edge Case 1: Empty waitlist -> seat simply stays AVAILABLE in public inventory
    if (queue.length === 0) {
      return { allocated: false, reason: 'WAITLIST_EMPTY' };
    }

    // Pop the next customer
    const nextCandidate = queue[0];
    const user = store.users.get(nextCandidate.userId);
    const emailToUse = nextCandidate.customerEmail || user?.email;
    const nameToUse = nextCandidate.customerName || user?.fullName || 'Valued Customer';

    // Calculate time-limited offer expiry (e.g. 15 minutes)
    const offerDurationMinutes =
      show.offerDurationMinutes || config.defaultWaitlistOfferTTLMinutes || 15;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + offerDurationMinutes * 60 * 1000);

    // Generate secure, unique offer token
    const offerToken = `wlo_${crypto.randomBytes(24).toString('hex')}`;
    const offerId = `wlo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Create Waitlist Offer record
    const offer: WaitlistOffer = {
      id: offerId,
      waitlistId: nextCandidate.id,
      showId,
      showSeatId: seat.id,
      userId: nextCandidate.userId,
      customerEmail: emailToUse,
      customerName: nameToUse,
      offerToken,
      status: 'PENDING',
      offeredAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      respondedAt: null,
    };

    // Commit state updates
    store.waitlistOffers.set(offer.id, offer);

    // Update waitlist entry status
    nextCandidate.status = 'OFFERED';
    nextCandidate.updatedAt = now.toISOString();
    store.waitlist.set(nextCandidate.id, nextCandidate);

    // Place time-limited hold on the seat specifically for this offer
    seat.status = 'HELD';
    seat.heldByUserId = nextCandidate.userId;
    seat.holdSessionToken = offerToken;
    seat.holdExpiresAt = expiresAt.toISOString();
    seat.version += 1;
    seat.updatedAt = now.toISOString();
    store.showSeats.set(seat.id, seat);

    // Broadcast Real-time event
    realtimeService.broadcastToShow(showId, {
      type: 'WAITLIST_OFFER',
      showId,
      seatIds: [seat.id],
      heldByUserId: nextCandidate.userId,
      expiresAt: expiresAt.toISOString(),
    });

    // Lookup metadata for notification
    const physicalSeat = store.seats.get(seat.seatId);
    const category = Array.from(store.categories.values()).find((c) => c.id === seat.categoryId);
    const pricing = Array.from(store.showPricing.values()).find(
      (p) => p.showId === showId && p.categoryId === seat.categoryId
    );
    const venue = store.venues.get(show.venueId);

    const seatLabel = physicalSeat ? `Row ${physicalSeat.rowLabel}-${physicalSeat.seatNumber}` : seat.id;
    const priceCents = pricing?.priceCents || 0;
    const priceFormatted = `$${(priceCents / 100).toFixed(2)}`;
    const claimUrl = `${config.appUrl}/booking/offer/${offerToken}`;

    // Send actionable email with countdown and direct claim link
    if (emailToUse) {
      EmailService.sendWaitlistOffer({
        recipientEmail: emailToUse,
        recipientName: nameToUse,
        showTitle: show.title,
        venueName: venue?.name || 'Main Stage Venue',
        venueAddress: venue?.address || '',
        startTime: show.startTime,
        seatLabel: `${seatLabel} (${category?.name || 'Standard'})`,
        priceFormatted,
        expiresAt: expiresAt.toISOString(),
        offerToken,
        claimUrl,
      }).catch((err) => console.error('[WaitlistService] Failed to send offer email:', err));
    }

    console.log(
      `[WaitlistService] Created offer for ${nameToUse} (${emailToUse}) for seat ${seatLabel} on show "${show.title}". Expires at: ${expiresAt.toISOString()}`
    );

    return { allocated: true, offer, waitlistEntry: nextCandidate };
  }

  /**
   * Endpoint 3: Validate Offer Token & Retrieve Details
   */
  public static async getOfferDetails(offerToken: string): Promise<OfferDetailsResult> {
    const offer = Array.from(store.waitlistOffers.values()).find((o) => o.offerToken === offerToken);

    if (!offer) {
      return { success: false, error: 'NotFound', message: 'Offer token not found or invalid.' };
    }

    const now = new Date();
    const expiryDate = new Date(offer.expiresAt);

    // Check if expired
    if (offer.status === 'PENDING' && expiryDate <= now) {
      await this.expireSingleOffer(offer);
      return {
        success: false,
        error: 'OfferExpired',
        message: 'This ticket offer has expired and the seat was offered to the next customer in line.',
      };
    }

    if (offer.status !== 'PENDING') {
      return {
        success: false,
        error: 'OfferNotAvailable',
        message: `This offer is no longer pending (Status: ${offer.status}).`,
      };
    }

    const show = store.shows.get(offer.showId);
    const seat = store.showSeats.get(offer.showSeatId);
    const physicalSeat = seat ? store.seats.get(seat.seatId) : null;
    const category = seat ? Array.from(store.categories.values()).find((c) => c.id === seat.categoryId) : null;
    const pricing = seat
      ? Array.from(store.showPricing.values()).find(
          (p) => p.showId === offer.showId && p.categoryId === seat.categoryId
        )
      : null;
    const venue = show ? store.venues.get(show.venueId) : null;

    const remainingSeconds = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000));
    const seatLabel = physicalSeat ? `Row ${physicalSeat.rowLabel}-${physicalSeat.seatNumber}` : offer.showSeatId;
    const priceCents = pricing?.priceCents || 0;

    return {
      success: true,
      offer: {
        id: offer.id,
        offerToken: offer.offerToken,
        showId: offer.showId,
        showTitle: show?.title || 'Event',
        venueName: venue?.name || 'Venue',
        venueAddress: venue?.address || '',
        startTime: show?.startTime || '',
        seatId: offer.showSeatId,
        seatLabel,
        categoryId: seat?.categoryId || '',
        categoryName: category?.name || 'Seat',
        priceCents,
        priceFormatted: `$${(priceCents / 100).toFixed(2)}`,
        expiresAt: offer.expiresAt,
        remainingSeconds,
        status: offer.status,
        customerEmail: offer.customerEmail,
        customerName: offer.customerName,
      },
    };
  }

  /**
   * Endpoint 3: Accept Offer & Complete Booking
   * Validates offer token and converts the held seat into a confirmed ticket booking.
   */
  public static async acceptOffer(
    offerToken: string,
    customerData?: { customerEmail?: string; customerName?: string }
  ): Promise<{ success: boolean; booking?: Booking; error?: string; message?: string }> {
    const offer = Array.from(store.waitlistOffers.values()).find((o) => o.offerToken === offerToken);

    if (!offer) {
      return { success: false, error: 'NotFound', message: 'Offer token not found.' };
    }

    const now = new Date();
    if (offer.status === 'PENDING' && new Date(offer.expiresAt) <= now) {
      await this.expireSingleOffer(offer);
      return {
        success: false,
        error: 'OfferExpired',
        message: 'This offer has expired. The ticket was reallocated to the next customer in the queue.',
      };
    }

    if (offer.status !== 'PENDING') {
      return {
        success: false,
        error: 'OfferNotPending',
        message: `Offer cannot be accepted because it is already ${offer.status}.`,
      };
    }

    const emailToUse = customerData?.customerEmail || offer.customerEmail;
    const nameToUse = customerData?.customerName || offer.customerName;

    // Reuse BookingService confirmation flow
    const confirmResult = await BookingService.confirmBooking({
      showId: offer.showId,
      seatIds: [offer.showSeatId],
      userId: offer.userId,
      holdSessionToken: offer.offerToken,
      customerEmail: emailToUse,
      customerName: nameToUse,
    });

    if (!confirmResult.success) {
      return {
        success: false,
        error: confirmResult.error || 'ConfirmationFailed',
        message: confirmResult.message || 'Failed to confirm booking from waitlist offer.',
      };
    }

    // Mark Offer ACCEPTED
    offer.status = 'ACCEPTED';
    offer.respondedAt = now.toISOString();
    store.waitlistOffers.set(offer.id, offer);

    // Mark Waitlist Entry CONVERTED
    const entry = store.waitlist.get(offer.waitlistId);
    if (entry) {
      entry.status = 'CONVERTED';
      entry.updatedAt = now.toISOString();
      store.waitlist.set(entry.id, entry);
    }

    console.log(`[WaitlistService] Offer ${offer.id} successfully accepted and converted to booking!`);

    return {
      success: true,
      booking: confirmResult.booking,
      message: 'Waitlist offer accepted and booking confirmed successfully!',
    };
  }

  /**
   * Decline Offer: Customer explicitly declines early, allowing instant handover to the next customer
   */
  public static async declineOffer(
    offerToken: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const offer = Array.from(store.waitlistOffers.values()).find((o) => o.offerToken === offerToken);

    if (!offer) {
      return { success: false, error: 'NotFound', message: 'Offer token not found.' };
    }

    if (offer.status !== 'PENDING') {
      return { success: false, error: 'OfferNotPending', message: `Offer is already ${offer.status}.` };
    }

    const now = new Date().toISOString();
    offer.status = 'DECLINED';
    offer.respondedAt = now;
    store.waitlistOffers.set(offer.id, offer);

    const entry = store.waitlist.get(offer.waitlistId);
    if (entry) {
      entry.status = 'CANCELLED';
      entry.updatedAt = now;
      store.waitlist.set(entry.id, entry);
    }

    // Release the seat from hold
    const seat = store.showSeats.get(offer.showSeatId);
    if (seat && seat.holdSessionToken === offerToken) {
      seat.status = 'AVAILABLE';
      seat.heldByUserId = null;
      seat.holdExpiresAt = null;
      seat.holdSessionToken = null;
      seat.version += 1;
      seat.updatedAt = now;
      store.showSeats.set(seat.id, seat);
    }

    // Immediately trigger reallocation for the freed seat to the next waitlist customer!
    const realloc = await this.processWaitlistForFreedSeat(offer.showId, offer.showSeatId);
    if (!realloc.allocated) {
      realtimeService.broadcastToShow(offer.showId, {
        type: 'SEAT_RELEASED',
        showId: offer.showId,
        seatIds: [offer.showSeatId],
        reason: 'OFFER_DECLINED_QUEUE_EMPTY',
      });
    }

    return {
      success: true,
      message: 'Offer declined. Seat was immediately reallocated to the next person in line.',
    };
  }

  /**
   * Helper: Expire a single offer and reallocate
   */
  private static async expireSingleOffer(offer: WaitlistOffer): Promise<void> {
    const now = new Date().toISOString();
    offer.status = 'EXPIRED';
    offer.respondedAt = now;
    store.waitlistOffers.set(offer.id, offer);

    const entry = store.waitlist.get(offer.waitlistId);
    if (entry) {
      entry.status = 'EXPIRED';
      entry.updatedAt = now;
      store.waitlist.set(entry.id, entry);
    }

    const seat = store.showSeats.get(offer.showSeatId);
    if (seat && seat.holdSessionToken === offer.offerToken) {
      seat.status = 'AVAILABLE';
      seat.heldByUserId = null;
      seat.holdExpiresAt = null;
      seat.holdSessionToken = null;
      seat.version += 1;
      seat.updatedAt = now;
      store.showSeats.set(seat.id, seat);
    }

    // Pass the seat to the next waitlist candidate
    const realloc = await this.processWaitlistForFreedSeat(offer.showId, offer.showSeatId);
    if (!realloc.allocated) {
      realtimeService.broadcastToShow(offer.showId, {
        type: 'SEAT_RELEASED',
        showId: offer.showId,
        seatIds: [offer.showSeatId],
        reason: 'OFFER_EXPIRED_QUEUE_EMPTY',
      });
    }
  }

  /**
   * Background TTL Sweeper for Expired Waitlist Offers
   * Scans all pending offers, expires lapsed ones, and re-offers to the next customer in line.
   */
  public static async sweepExpiredOffers(): Promise<{ expiredCount: number; reallocatedCount: number }> {
    const now = new Date();
    let expiredCount = 0;
    let reallocatedCount = 0;

    for (const offer of Array.from(store.waitlistOffers.values())) {
      if (offer.status === 'PENDING' && new Date(offer.expiresAt) <= now) {
        expiredCount++;
        await this.expireSingleOffer(offer);
        reallocatedCount++;
      }
    }

    return { expiredCount, reallocatedCount };
  }

  /**
   * Get user's waitlist entries
   */
  public static getUserWaitlist(userId: string): any[] {
    const user = store.users.get(userId);
    const userEmail = user?.email?.toLowerCase();

    const entries = Array.from(store.waitlist.values())
      .filter((w) => w.userId === userId || (userEmail && w.customerEmail && w.customerEmail.toLowerCase() === userEmail))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return entries.map((entry) => {
      const show = store.shows.get(entry.showId);
      const venue = show ? store.venues.get(show.venueId) : null;
      const category = Array.from(store.categories.values()).find((c) => c.id === entry.categoryId);

      let position: number | null = null;
      if (entry.status === 'WAITING') {
        const queue = this.getQueueForCategory(entry.showId, entry.categoryId);
        const idx = queue.findIndex((q) => q.id === entry.id);
        position = idx >= 0 ? idx + 1 : null;
      }

      // Check if there is an active offer for this entry
      const activeOffer = Array.from(store.waitlistOffers.values()).find(
        (o) => o.waitlistId === entry.id && o.status === 'PENDING'
      );

      return {
        ...entry,
        showTitle: show?.title || 'Unknown Show',
        showStartTime: show?.startTime,
        venueName: venue?.name || 'Unknown Venue',
        categoryName: category?.name || 'Unknown Category',
        colorCode: category?.colorCode || '#2563EB',
        queuePosition: position,
        activeOfferToken: activeOffer?.offerToken || null,
        activeOfferExpiresAt: activeOffer?.expiresAt || null,
      };
    });
  }
}
