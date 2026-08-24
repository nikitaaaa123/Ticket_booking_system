import crypto from 'crypto';
import { store } from '../db/store.ts';
import { config } from '../config/env.ts';
import { ShowSeat, SeatStatus } from '../types/index.ts';
import { realtimeService } from './realtime.service.ts';
import { WaitlistService } from './waitlist.service.ts';

export interface HoldSeatsResult {
  success: boolean;
  holdSessionToken?: string;
  expiresAt?: string;
  holdDurationMinutes?: number;
  heldSeatIds?: string[];
  totalPriceCents?: number;
  failedSeatId?: string;
  error?: string;
  message?: string;
}

export class SeatHoldService {
  // Process-level mutex queue per seat to simulate strict SQL row-level lock serialization
  private static seatLocks: Map<string, Promise<void>> = new Map();

  /**
   * Concurrency-safe, atomic seat holding mechanism.
   *
   * MECHANISM EXPLANATION:
   * 1. Multi-seat deadlock prevention: Sort seat IDs alphabetically before acquiring locks.
   * 2. Atomic test-and-set: Checks that every requested seat is currently AVAILABLE
   *    or has an EXPIRED hold (`status === 'HELD' && hold_expires_at < NOW()`).
   * 3. Mutex / Transaction Boundary: If any single seat in the batch cannot be acquired,
   *    the entire transaction is rolled back immediately (all-or-nothing).
   * 4. Session Token + TTL: Sets hold_expires_at = NOW() + TTL and generates a secure session token.
   * 5. Real-time broadcast: Immediately pushes `SEAT_HELD` to WebSocket subscribers for that show.
   */
  public static async holdSeats(
    showId: string,
    showSeatIds: string[],
    userId: string
  ): Promise<HoldSeatsResult> {
    if (!showSeatIds || showSeatIds.length === 0) {
      return { success: false, error: 'ValidationError', message: 'No seats specified for holding.' };
    }

    const show = store.shows.get(showId);
    if (!show) {
      return { success: false, error: 'NotFound', message: `Show with id ${showId} not found.` };
    }

    // Always sweep expired holds for this show first
    this.sweepExpiredHoldsForShow(showId);

    const holdDurationMinutes = show.holdDurationMinutes || config.defaultSeatHoldTTLMinutes;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + holdDurationMinutes * 60 * 1000);
    const holdSessionToken = `hold_${crypto.randomBytes(24).toString('hex')}`;

    // Sort seat IDs to guarantee deterministic locking order across concurrent requests (prevents deadlock)
    const sortedSeatIds = [...showSeatIds].sort();

    // Acquire lock and execute atomic transaction
    return await this.withSeatLocks(sortedSeatIds, async () => {
      const seatsToHold: ShowSeat[] = [];
      let totalPriceCents = 0;

      // Phase 1: Validate every seat under strict lock
      for (const seatId of sortedSeatIds) {
        const seat = store.showSeats.get(seatId);

        if (!seat || seat.showId !== showId) {
          return {
            success: false,
            failedSeatId: seatId,
            error: 'SeatNotFound',
            message: `Seat ${seatId} does not exist for show ${showId}.`,
          };
        }

        // Check availability (either available OR expired hold)
        const isExpired = seat.status === 'HELD' && seat.holdExpiresAt && new Date(seat.holdExpiresAt) <= now;
        const isAvailable = seat.status === 'AVAILABLE' || isExpired;

        // If seat is currently held by this exact user with valid hold, allow extending/refreshing
        const isAlreadyHeldBySameUser = seat.status === 'HELD' && seat.heldByUserId === userId && !isExpired;

        if (!isAvailable && !isAlreadyHeldBySameUser) {
          return {
            success: false,
            failedSeatId: seatId,
            error: 'SeatUnavailable',
            message: `Seat ${seatId} is already ${seat.status.toLowerCase()} by another customer.`,
          };
        }

        // Calculate price
        const pricing = Array.from(store.showPricing.values()).find(
          (p) => p.showId === showId && p.categoryId === seat.categoryId
        );
        totalPriceCents += pricing?.priceCents || 0;
        seatsToHold.push(seat);
      }

      // Phase 2: Atomic update / Commit
      for (const seat of seatsToHold) {
        seat.status = 'HELD';
        seat.heldByUserId = userId;
        seat.holdExpiresAt = expiresAt.toISOString();
        seat.holdSessionToken = holdSessionToken;
        seat.version += 1;
        seat.updatedAt = new Date().toISOString();
        store.showSeats.set(seat.id, seat);
      }

      // Phase 3: Real-time broadcast
      realtimeService.broadcastToShow(showId, {
        type: 'SEAT_HELD',
        showId,
        seatIds: sortedSeatIds,
        heldByUserId: userId,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        success: true,
        holdSessionToken,
        expiresAt: expiresAt.toISOString(),
        holdDurationMinutes,
        heldSeatIds: sortedSeatIds,
        totalPriceCents,
      };
    });
  }

  /**
   * Release held seats manually (e.g. checkout cancelled or user deselects)
   */
  public static async releaseSeats(
    showId: string,
    showSeatIds: string[],
    userId?: string,
    holdSessionToken?: string
  ): Promise<{ success: boolean; releasedSeatIds: string[] }> {
    const sortedSeatIds = [...showSeatIds].sort();

    return await this.withSeatLocks(sortedSeatIds, async () => {
      const released: string[] = [];
      const publicReleased: string[] = [];

      for (const seatId of sortedSeatIds) {
        const seat = store.showSeats.get(seatId);
        if (!seat || seat.showId !== showId || seat.status !== 'HELD') {
          continue;
        }

        // Validate ownership if credentials passed
        if (userId && seat.heldByUserId && seat.heldByUserId !== userId) {
          continue;
        }
        if (holdSessionToken && seat.holdSessionToken && seat.holdSessionToken !== holdSessionToken) {
          continue;
        }

        // Revert to AVAILABLE
        seat.status = 'AVAILABLE';
        seat.heldByUserId = null;
        seat.holdExpiresAt = null;
        seat.holdSessionToken = null;
        seat.version += 1;
        seat.updatedAt = new Date().toISOString();
        store.showSeats.set(seat.id, seat);
        released.push(seat.id);

        // Check if waitlist exists for this freed seat
        const waitlistResult = await WaitlistService.processWaitlistForFreedSeat(showId, seat.id);
        if (!waitlistResult.allocated) {
          publicReleased.push(seat.id);
        }
      }

      if (publicReleased.length > 0) {
        realtimeService.broadcastToShow(showId, {
          type: 'SEAT_RELEASED',
          showId,
          seatIds: publicReleased,
        });
      }

      return { success: true, releasedSeatIds: released };
    });
  }

  /**
   * Background TTL Sweeper: Scans all held seats across all shows and releases expired ones.
   */
  public static async sweepExpiredHolds(): Promise<{ expiredCount: number; showUpdates: Record<string, string[]> }> {
    const now = new Date();
    const showUpdates: Record<string, string[]> = {};
    let expiredCount = 0;

    for (const seat of Array.from(store.showSeats.values())) {
      if (seat.status === 'HELD' && seat.holdExpiresAt) {
        const expiryTime = new Date(seat.holdExpiresAt);
        if (expiryTime <= now) {
          // Revert seat
          seat.status = 'AVAILABLE';
          seat.heldByUserId = null;
          seat.holdExpiresAt = null;
          seat.holdSessionToken = null;
          seat.version += 1;
          seat.updatedAt = now.toISOString();
          store.showSeats.set(seat.id, seat);
          expiredCount++;

          // Attempt waitlist reallocation
          const waitlistResult = await WaitlistService.processWaitlistForFreedSeat(seat.showId, seat.id);
          if (!waitlistResult.allocated) {
            if (!showUpdates[seat.showId]) {
              showUpdates[seat.showId] = [];
            }
            showUpdates[seat.showId].push(seat.id);
          }
        }
      }
    }

    // Broadcast per show updates to active subscribers
    for (const [showId, releasedIds] of Object.entries(showUpdates)) {
      realtimeService.broadcastToShow(showId, {
        type: 'SEAT_RELEASED',
        showId,
        seatIds: releasedIds,
        reason: 'HOLD_EXPIRED',
      });
    }

    return { expiredCount, showUpdates };
  }

  /**
   * Show-scoped sweep to guarantee fresh state prior to map queries
   */
  public static async sweepExpiredHoldsForShow(showId: string): Promise<string[]> {
    const now = new Date();
    const released: string[] = [];
    const publicReleased: string[] = [];

    for (const seat of Array.from(store.showSeats.values())) {
      if (seat.showId === showId && seat.status === 'HELD' && seat.holdExpiresAt) {
        if (new Date(seat.holdExpiresAt) <= now) {
          seat.status = 'AVAILABLE';
          seat.heldByUserId = null;
          seat.holdExpiresAt = null;
          seat.holdSessionToken = null;
          seat.version += 1;
          seat.updatedAt = now.toISOString();
          store.showSeats.set(seat.id, seat);
          released.push(seat.id);

          const waitlistResult = await WaitlistService.processWaitlistForFreedSeat(showId, seat.id);
          if (!waitlistResult.allocated) {
            publicReleased.push(seat.id);
          }
        }
      }
    }

    if (publicReleased.length > 0) {
      realtimeService.broadcastToShow(showId, {
        type: 'SEAT_RELEASED',
        showId,
        seatIds: publicReleased,
        reason: 'HOLD_EXPIRED',
      });
    }

    return released;
  }

  /**
   * Helper to execute a callback with acquired in-memory locks for given seats.
   * Publicly accessible so booking confirmation can execute within the same atomic lock boundary.
   */
  public static async withSeatLocks<T>(seatIds: string[], fn: () => Promise<T>): Promise<T> {
    // Acquire sequential lock promises
    const releaseFns: (() => void)[] = [];

    for (const seatId of seatIds) {
      let release: () => void;
      const nextLock = new Promise<void>((resolve) => {
        release = resolve;
      });

      const currentLock = this.seatLocks.get(seatId) || Promise.resolve();
      this.seatLocks.set(seatId, currentLock.then(() => nextLock));
      await currentLock;
      releaseFns.push(release!);
    }

    try {
      return await fn();
    } finally {
      // Release all acquired locks in reverse order
      while (releaseFns.length > 0) {
        const rel = releaseFns.pop();
        if (rel) rel();
      }
    }
  }

  /**
   * Verify an active hold: validates existence, ownership, and non-expiration.
   * If expired, immediately releases the seats and notifies WebSocket subscribers.
   */
  public static async verifyHold(
    showId: string,
    showSeatIds: string[],
    userId?: string,
    holdSessionToken?: string
  ): Promise<{
    valid: boolean;
    expired?: boolean;
    expiresAt?: string;
    remainingSeconds?: number;
    heldSeatIds?: string[];
    totalPriceCents?: number;
    error?: string;
    message?: string;
  }> {
    if (!showSeatIds || showSeatIds.length === 0) {
      return { valid: false, error: 'ValidationError', message: 'No seats specified.' };
    }

    const show = store.shows.get(showId);
    if (!show) {
      return { valid: false, error: 'NotFound', message: `Show with id ${showId} not found.` };
    }

    const now = new Date();
    const sortedSeatIds = [...showSeatIds].sort();

    return await this.withSeatLocks(sortedSeatIds, async () => {
      let totalPriceCents = 0;
      let earliestExpiresAt: string | null = null;
      const expiredSeatIds: string[] = [];

      for (const seatId of sortedSeatIds) {
        const seat = store.showSeats.get(seatId);
        if (!seat || seat.showId !== showId) {
          return { valid: false, error: 'SeatNotFound', message: `Seat ${seatId} not found.` };
        }

        if (seat.status !== 'HELD') {
          return {
            valid: false,
            expired: true,
            error: 'HoldExpired',
            message: 'Your seat hold has expired. Please select the seat again.',
          };
        }

        const isExpired = seat.holdExpiresAt && new Date(seat.holdExpiresAt) <= now;
        if (isExpired) {
          expiredSeatIds.push(seat.id);
          continue;
        }

        const isUserMatch = Boolean(userId && seat.heldByUserId === userId);
        const isTokenMatch = Boolean(holdSessionToken && seat.holdSessionToken === holdSessionToken);

        if (!isUserMatch && !isTokenMatch) {
          return {
            valid: false,
            error: 'UnauthorizedHold',
            message: 'Hold was not placed by you or has expired.',
          };
        }

        if (!earliestExpiresAt || new Date(seat.holdExpiresAt!) < new Date(earliestExpiresAt)) {
          earliestExpiresAt = seat.holdExpiresAt!;
        }

        const pricing = Array.from(store.showPricing.values()).find(
          (p) => p.showId === showId && p.categoryId === seat.categoryId
        );
        totalPriceCents += pricing?.priceCents || 0;
      }

      // If any seat in the hold has expired, release them all
      if (expiredSeatIds.length > 0) {
        for (const expiredId of expiredSeatIds) {
          const seat = store.showSeats.get(expiredId);
          if (seat && seat.status === 'HELD') {
            seat.status = 'AVAILABLE';
            seat.heldByUserId = null;
            seat.holdExpiresAt = null;
            seat.holdSessionToken = null;
            seat.version += 1;
            seat.updatedAt = now.toISOString();
            store.showSeats.set(seat.id, seat);
          }
        }
        realtimeService.broadcastToShow(showId, {
          type: 'SEAT_RELEASED',
          showId,
          seatIds: expiredSeatIds,
          reason: 'HOLD_EXPIRED',
        });

        return {
          valid: false,
          expired: true,
          error: 'HoldExpired',
          message: 'Your seat hold has expired. Please select the seat again.',
        };
      }

      const remainingSecs = earliestExpiresAt
        ? Math.max(0, Math.floor((new Date(earliestExpiresAt).getTime() - now.getTime()) / 1000))
        : 0;

      return {
        valid: true,
        expiresAt: earliestExpiresAt || undefined,
        remainingSeconds: remainingSecs,
        heldSeatIds: sortedSeatIds,
        totalPriceCents,
      };
    });
  }
}
