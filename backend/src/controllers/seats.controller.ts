import { Request, Response } from 'express';
import { store } from '../db/store.ts';
import { SeatHoldService } from '../services/seatHold.service.ts';

export class SeatsController {
  /**
   * Endpoint 1: GET Seat Map for a Show
   * Returns every seat with current status ('AVAILABLE' / 'HELD' / 'BOOKED'),
   * category info, price, coordinate layout, and whether it is held by the current user.
   */
  public static async getSeatMap(req: Request, res: Response): Promise<void> {
    try {
      const { showId } = req.params;
      const currentUserId = req.user?.id;
      const sessionToken = req.headers['x-hold-session-token'] as string | undefined;

      const show = store.shows.get(showId);
      if (!show) {
        res.status(404).json({ error: 'NotFound', message: `Show with id ${showId} not found.` });
        return;
      }

      // Sweep expired holds for this show prior to returning state (guarantees strictly fresh data)
      await SeatHoldService.sweepExpiredHoldsForShow(showId);

      const venue = store.venues.get(show.venueId);
      const categories = Array.from(store.categories.values()).filter((c) => c.venueId === show.venueId);
      const showPricing = Array.from(store.showPricing.values()).filter((p) => p.showId === showId);
      const showSeats = Array.from(store.showSeats.values()).filter((ss) => ss.showId === showId);

      const pricingMap = new Map<string, number>();
      showPricing.forEach((p) => pricingMap.set(p.categoryId, p.priceCents));

      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      let myHeldSeatsCount = 0;
      let totalHoldAmountCents = 0;
      let activeHoldExpiresAt: string | null = null;

      const enrichedSeats = showSeats.map((ss) => {
        const physicalSeat = store.seats.get(ss.seatId);
        const category = categoryMap.get(ss.categoryId);
        const priceCents = pricingMap.get(ss.categoryId) || 0;

        const isHeldByMe = Boolean(
          ss.status === 'HELD' &&
            ((currentUserId && ss.heldByUserId === currentUserId) ||
              (sessionToken && ss.holdSessionToken === sessionToken))
        );

        if (isHeldByMe) {
          myHeldSeatsCount++;
          totalHoldAmountCents += priceCents;
          if (ss.holdExpiresAt) activeHoldExpiresAt = ss.holdExpiresAt;
        }

        return {
          id: ss.id, // ShowSeat ID
          showId: ss.showId,
          seatId: ss.seatId,
          categoryId: ss.categoryId,
          categoryName: category?.name || 'Standard',
          colorCode: category?.colorCode || '#3B82F6',
          priceCents,
          currency: 'USD',
          rowLabel: physicalSeat?.rowLabel || '?',
          seatNumber: physicalSeat?.seatNumber || 0,
          gridRow: physicalSeat?.gridRow || 1,
          gridCol: physicalSeat?.gridCol || 1,
          isAccessible: physicalSeat?.isAccessible || false,
          status: ss.status, // 'AVAILABLE' | 'HELD' | 'BOOKED'
          isHeldByMe,
          holdExpiresAt: isHeldByMe ? ss.holdExpiresAt : undefined,
        };
      });

      // Calculate category level stats & waitlist counts
      const categorySummaries = categories.map((cat) => {
        const catSeats = enrichedSeats.filter((s) => s.categoryId === cat.id);
        const availableCount = catSeats.filter((s) => s.status === 'AVAILABLE').length;
        const heldCount = catSeats.filter((s) => s.status === 'HELD').length;
        const bookedCount = catSeats.filter((s) => s.status === 'BOOKED').length;
        const priceCents = pricingMap.get(cat.id) || 0;

        const waitlistCount = Array.from(store.waitlist.values()).filter(
          (w) => w.showId === showId && w.categoryId === cat.id && w.status === 'WAITING'
        ).length;

        return {
          categoryId: cat.id,
          name: cat.name,
          colorCode: cat.colorCode,
          description: cat.description,
          priceCents,
          totalSeats: catSeats.length,
          availableSeats: availableCount,
          heldSeats: heldCount,
          bookedSeats: bookedCount,
          isSoldOut: availableCount === 0,
          waitlistCount,
        };
      });

      res.status(200).json({
        show: {
          id: show.id,
          title: show.title,
          category: show.category,
          startTime: show.startTime,
          endTime: show.endTime,
          holdDurationMinutes: show.holdDurationMinutes,
          offerDurationMinutes: show.offerDurationMinutes,
        },
        venue: {
          id: venue?.id,
          name: venue?.name,
          city: venue?.city,
          address: venue?.address,
        },
        categories: categorySummaries,
        seats: enrichedSeats,
        myHold: myHeldSeatsCount > 0 ? {
          heldSeatsCount: myHeldSeatsCount,
          totalHoldAmountCents,
          expiresAt: activeHoldExpiresAt,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Endpoint 2: POST Hold Seats
   * Customer selects one or more seats to place on hold with TTL.
   */
  public static async holdSeats(req: Request, res: Response): Promise<void> {
    try {
      const { showId, seatIds }: { showId: string; seatIds: string[] } = req.body;
      const userId = req.user ? req.user.id : (req.body.guestUserId || `guest-${Date.now()}`);

      if (!showId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'showId and a non-empty array of seatIds are required.',
        });
        return;
      }

      const result = await SeatHoldService.holdSeats(showId, seatIds, userId);

      if (!result.success) {
        res.status(409).json({
          error: result.error || 'SeatHoldFailed',
          message: result.message || 'One or more requested seats could not be held.',
          failedSeatId: result.failedSeatId,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Seats held successfully',
        holdSessionToken: result.holdSessionToken,
        expiresAt: result.expiresAt,
        holdDurationMinutes: result.holdDurationMinutes,
        heldSeatIds: result.heldSeatIds,
        totalPriceCents: result.totalPriceCents,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * Endpoint 3: POST Release Held Seats
   * Customer deselects seats or abandons checkout
   */
  public static async releaseSeats(req: Request, res: Response): Promise<void> {
    try {
      const { showId, seatIds, holdSessionToken }: { showId: string; seatIds: string[]; holdSessionToken?: string } = req.body;
      const userId = req.user?.id;

      if (!showId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'showId and an array of seatIds are required.',
        });
        return;
      }

      const result = await SeatHoldService.releaseSeats(showId, seatIds, userId, holdSessionToken);

      res.status(200).json({
        success: true,
        message: 'Seats released successfully',
        releasedSeatIds: result.releasedSeatIds,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}
