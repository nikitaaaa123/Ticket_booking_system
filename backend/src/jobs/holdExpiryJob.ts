import { SeatHoldService } from '../services/seatHold.service.ts';
import { WaitlistService } from '../services/waitlist.service.ts';
import { config } from '../config/env.ts';

class HoldExpiryJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const intervalMs = config.sweepIntervalSeconds * 1000;
    console.log(`[HoldExpiryJob] Starting background TTL sweeper for seat holds & waitlist offers (Interval: ${config.sweepIntervalSeconds}s)`);

    this.timer = setInterval(async () => {
      try {
        // 1. Sweep expired direct seat holds
        const { expiredCount, showUpdates } = await SeatHoldService.sweepExpiredHolds();
        if (expiredCount > 0) {
          console.log(
            `[HoldExpiryJob] Swept ${expiredCount} expired seat hold(s) across ${Object.keys(showUpdates).length} show(s)`
          );
        }

        // 2. Sweep expired waitlist offers and trigger queue handover
        const { expiredCount: expiredOffers, reallocatedCount } = await WaitlistService.sweepExpiredOffers();
        if (expiredOffers > 0) {
          console.log(
            `[HoldExpiryJob] Swept ${expiredOffers} expired waitlist offer(s) -> ${reallocatedCount} seat(s) reallocated to next candidate(s)`
          );
        }
      } catch (err) {
        console.error('[HoldExpiryJob] Error running background TTL sweep:', err);
      }
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[HoldExpiryJob] Stopped seat hold background TTL sweeper');
  }
}

export const holdExpiryJob = new HoldExpiryJob();
