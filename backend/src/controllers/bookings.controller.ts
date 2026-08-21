import { Request, Response } from 'express';
import { BookingService } from '../services/booking.service.ts';
import { ConfirmBookingRequestDTO, CancelBookingRequestDTO } from '../types/index.ts';

export class BookingsController {
  /**
   * Endpoint 1: POST Confirm Booking
   * Converts active holds into a confirmed ticket booking with QR pass and email dispatch.
   */
  public static async confirmBooking(req: Request, res: Response): Promise<void> {
    try {
      const {
        showId,
        seatIds,
        holdSessionToken,
        customerEmail,
        customerName,
      }: ConfirmBookingRequestDTO = req.body;

      const userId = req.user ? req.user.id : (req.body.guestUserId || `guest-${Date.now()}`);

      if (!showId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'showId and an array of held seatIds are required.',
        });
        return;
      }

      const result = await BookingService.confirmBooking({
        showId,
        seatIds,
        userId,
        holdSessionToken,
        customerEmail: customerEmail || req.user?.email,
        customerName: customerName || req.user?.fullName,
      });

      if (!result.success) {
        res.status(400).json({
          error: result.error || 'BookingFailed',
          message: result.message || 'Unable to confirm booking for the specified seats.',
        });
        return;
      }

      res.status(201).json({
        message: 'Booking confirmed successfully',
        booking: result.booking,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Endpoint 4: GET Customer Booking History
   */
  public static async getMyBookings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const bookings = BookingService.getCustomerBookings(userId);

      res.status(200).json({
        total: bookings.length,
        bookings,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Endpoint 5: POST Cancel Booking
   */
  public static async cancelBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId, reason }: CancelBookingRequestDTO = req.body;
      const userId = req.user!.id;

      if (!bookingId) {
        res.status(400).json({ error: 'ValidationError', message: 'bookingId is required.' });
        return;
      }

      const result = await BookingService.cancelBooking(bookingId, userId, reason);

      if (!result.success) {
        const statusCode = result.error === 'NotFound' ? 404 : result.error === 'Forbidden' ? 403 : 400;
        res.status(statusCode).json({
          error: result.error,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        message: result.message,
        freedSeatIds: result.freedSeatIds,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}
