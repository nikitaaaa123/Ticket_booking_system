import { Request, Response } from 'express';
import { WaitlistService } from '../services/waitlist.service.ts';
import {
  JoinWaitlistRequestDTO,
  AcceptOfferRequestDTO,
  DeclineOfferRequestDTO,
} from '../types/index.ts';

export class WaitlistController {
  /**
   * Endpoint 1: POST Join Waitlist
   */
  public static async joinWaitlist(req: Request, res: Response): Promise<void> {
    try {
      const {
        showId,
        categoryId,
        requestedSeatsCount = 1,
        customerEmail,
        customerName,
      }: JoinWaitlistRequestDTO = req.body;

      const userId = req.user ? req.user.id : (req.body.guestUserId || `guest-${Date.now()}`);

      if (!showId || !categoryId) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'showId and categoryId are required.',
        });
        return;
      }

      const result = await WaitlistService.joinWaitlist({
        showId,
        categoryId,
        userId,
        customerEmail: customerEmail || req.user?.email,
        customerName: customerName || req.user?.fullName,
        requestedSeatsCount,
      });

      if (!result.success) {
        res.status(400).json({
          error: result.error || 'JoinWaitlistFailed',
          message: result.message,
        });
        return;
      }

      res.status(201).json({
        message: result.message,
        waitlistEntry: result.waitlistEntry,
        queuePosition: result.queuePosition,
        totalWaitingInQueue: result.totalWaitingInQueue,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Endpoint 3a: GET Inspect Offer Details by Token
   */
  public static async getOfferDetails(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({ error: 'ValidationError', message: 'Offer token is required in URL.' });
        return;
      }

      const result = await WaitlistService.getOfferDetails(token);

      if (!result.success) {
        const statusCode = result.error === 'NotFound' ? 404 : result.error === 'OfferExpired' ? 410 : 400;
        res.status(statusCode).json({
          error: result.error,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        offer: result.offer,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Endpoint 3b: POST Accept Offer & Confirm Booking
   */
  public static async acceptOffer(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { customerEmail, customerName }: AcceptOfferRequestDTO = req.body;

      if (!token) {
        res.status(400).json({ error: 'ValidationError', message: 'Offer token is required in URL.' });
        return;
      }

      const result = await WaitlistService.acceptOffer(token, {
        customerEmail: customerEmail || req.user?.email,
        customerName: customerName || req.user?.fullName,
      });

      if (!result.success) {
        const statusCode = result.error === 'NotFound' ? 404 : result.error === 'OfferExpired' ? 410 : 400;
        res.status(statusCode).json({
          error: result.error,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        message: result.message,
        booking: result.booking,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Endpoint: POST Decline Offer
   */
  public static async declineOffer(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { reason }: DeclineOfferRequestDTO = req.body;

      if (!token) {
        res.status(400).json({ error: 'ValidationError', message: 'Offer token is required in URL.' });
        return;
      }

      const result = await WaitlistService.declineOffer(token, reason);

      if (!result.success) {
        const statusCode = result.error === 'NotFound' ? 404 : 400;
        res.status(statusCode).json({
          error: result.error,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        message: result.message,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET Current Customer's Waitlist Entries & Active Offers
   */
  public static async getMyWaitlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const entries = WaitlistService.getUserWaitlist(userId);

      res.status(200).json({
        total: entries.length,
        waitlist: entries,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}
