import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ShowSeatDetail, CategorySummary } from '../types/client.ts';
import { apiFetch } from '../services/api.ts';
import { useAuth } from './AuthContext.tsx';
import { RealtimeSeatEvent } from '../../backend/src/types/index.ts';

interface HoldSession {
  holdSessionToken: string;
  showId: string;
  heldSeatIds: string[];
  expiresAt: string;
  totalPriceCents: number;
}

interface SeatMapContextType {
  currentShowId: string | null;
  seats: ShowSeatDetail[];
  categories: CategorySummary[];
  selectedSeatIds: string[];
  activeHold: HoldSession | null;
  remainingSeconds: number;
  isLoading: boolean;
  error: string | null;
  toggleSeatSelection: (seat: ShowSeatDetail) => void;
  clearSelection: () => void;
  requestHold: () => Promise<boolean>;
  releaseHold: () => Promise<void>;
  loadShowSeats: (showId: string, silent?: boolean) => Promise<void>;
  handleSeatEvent: (event: RealtimeSeatEvent) => void;
  joinWaitlist: (categoryId: string, requestedCount?: number, email?: string, name?: string) => Promise<{ success: boolean; queuePosition?: number; message?: string }>;
}

const SeatMapContext = createContext<SeatMapContextType | undefined>(undefined);

export const SeatMapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, guestUserId } = useAuth();
  const currentEffectiveUserId = user?.id || guestUserId;

  const [currentShowId, setCurrentShowId] = useState<string | null>(null);
  const [seats, setSeats] = useState<ShowSeatDetail[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeHold, setActiveHold] = useState<HoldSession | null>(() => {
    const saved = localStorage.getItem('tbs_active_hold');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          return parsed;
        }
      } catch {
        localStorage.removeItem('tbs_active_hold');
      }
    }
    return null;
  });

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(() => {
    if (activeHold?.heldSeatIds && activeHold.heldSeatIds.length > 0) {
      return activeHold.heldSeatIds;
    }
    return [];
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load seats from backend
  const loadShowSeats = useCallback(async (showId: string, silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    setCurrentShowId(showId);
    try {
      const data = await apiFetch<{
        seats: ShowSeatDetail[];
        categories: CategorySummary[];
        stats: any;
      }>(`/api/seats/show/${showId}`);

      setSeats(data.seats || []);
      setCategories(data.categories || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load seat layout');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  // Real-time surgical seat event handler (updates state in-place without resetting selection)
  const handleSeatEvent = useCallback((event: RealtimeSeatEvent) => {
    if (!event) return;

    setSeats((prevSeats) => {
      if (!event.seatIds || event.seatIds.length === 0) return prevSeats;
      const targetIds = new Set(event.seatIds);

      return prevSeats.map((seat) => {
        if (!targetIds.has(seat.id)) return seat;

        if (event.type === 'SEAT_HELD') {
          return {
            ...seat,
            status: 'HELD' as const,
            heldByUserId: event.heldByUserId || null,
            holdExpiresAt: event.expiresAt || null,
          };
        } else if (event.type === 'SEAT_RELEASED') {
          return {
            ...seat,
            status: 'AVAILABLE' as const,
            heldByUserId: null,
            holdExpiresAt: null,
          };
        } else if (event.type === 'SEAT_BOOKED') {
          return {
            ...seat,
            status: 'BOOKED' as const,
            heldByUserId: null,
            holdExpiresAt: null,
          };
        }
        return seat;
      });
    });

    // If seats were held by someone ELSE, or booked, safely remove from local clicked selection
    if (event.type === 'SEAT_HELD' && event.heldByUserId && event.heldByUserId !== currentEffectiveUserId) {
      if (event.seatIds && event.seatIds.length > 0) {
        const heldByOtherSet = new Set(event.seatIds);
        setSelectedSeatIds((prev) => prev.filter((id) => !heldByOtherSet.has(id)));
      }
    } else if (event.type === 'SEAT_BOOKED') {
      if (event.seatIds && event.seatIds.length > 0) {
        const bookedSet = new Set(event.seatIds);
        setSelectedSeatIds((prev) => prev.filter((id) => !bookedSet.has(id)));
      }
    }
  }, [currentEffectiveUserId]);

  // Countdown timer for active hold
  useEffect(() => {
    if (!activeHold) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const diffMs = new Date(activeHold.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setRemainingSeconds(secs);

      if (secs <= 0) {
        // Hold expired
        setActiveHold(null);
        localStorage.removeItem('tbs_active_hold');
        setSelectedSeatIds([]);
        if (currentShowId) {
          loadShowSeats(currentShowId, true);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeHold, currentShowId, loadShowSeats]);

  // Toggle seat selection
  const toggleSeatSelection = useCallback((seat: ShowSeatDetail) => {
    // If seat is booked, or held by someone else, ignore click
    if (seat.status === 'BOOKED') return;
    if (seat.status === 'HELD' && seat.heldByUserId && seat.heldByUserId !== currentEffectiveUserId) return;

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.id)) {
        return prev.filter((id) => id !== seat.id);
      } else {
        // Cap max seats per transaction to 8
        if (prev.length >= 8) {
          alert('You can select a maximum of 8 seats per order.');
          return prev;
        }
        return [...prev, seat.id];
      }
    });
  }, [currentEffectiveUserId]);

  const clearSelection = useCallback(() => {
    setSelectedSeatIds([]);
  }, []);

  // Request atomic hold
  const requestHold = useCallback(async (): Promise<boolean> => {
    if (!currentShowId || selectedSeatIds.length === 0) return false;
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiFetch<{
        success: boolean;
        holdSessionToken: string;
        expiresAt: string;
        heldSeatIds: string[];
        totalPriceCents: number;
      }>('/api/seats/hold', {
        method: 'POST',
        body: JSON.stringify({
          showId: currentShowId,
          seatIds: selectedSeatIds,
          guestUserId: user ? undefined : guestUserId,
        }),
      });

      if (res.success || res.holdSessionToken) {
        const holdData: HoldSession = {
          holdSessionToken: res.holdSessionToken,
          showId: currentShowId,
          heldSeatIds: res.heldSeatIds || selectedSeatIds,
          expiresAt: res.expiresAt,
          totalPriceCents: res.totalPriceCents,
        };
        setActiveHold(holdData);
        localStorage.setItem('tbs_active_hold', JSON.stringify(holdData));
        setSelectedSeatIds(res.heldSeatIds || selectedSeatIds);
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err.message || 'Seat hold request failed. A seat may have just been claimed.');
      // Refresh seat layout silently to show real state
      if (currentShowId) {
        loadShowSeats(currentShowId, true);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentShowId, selectedSeatIds, user, guestUserId, loadShowSeats]);

  // Release hold
  const releaseHold = useCallback(async () => {
    if (!activeHold) return;
    try {
      await apiFetch('/api/seats/release', {
        method: 'POST',
        body: JSON.stringify({
          showId: activeHold.showId,
          holdSessionToken: activeHold.holdSessionToken,
        }),
      });
    } catch (e) {
      console.warn('Could not cleanly release hold:', e);
    } finally {
      setActiveHold(null);
      localStorage.removeItem('tbs_active_hold');
      setSelectedSeatIds([]);
      if (currentShowId) {
        loadShowSeats(currentShowId, true);
      }
    }
  }, [activeHold, currentShowId, loadShowSeats]);

  // Join waitlist
  const joinWaitlist = useCallback(async (
    categoryId: string,
    requestedCount = 1,
    email?: string,
    name?: string
  ) => {
    if (!currentShowId) return { success: false, message: 'No show selected' };
    try {
      const res = await apiFetch<{
        waitlistEntry: any;
        queuePosition: number;
        message: string;
      }>('/api/waitlist/join', {
        method: 'POST',
        body: JSON.stringify({
          showId: currentShowId,
          categoryId,
          requestedSeatsCount: requestedCount,
          customerEmail: email || user?.email,
          customerName: name || user?.fullName,
          guestUserId: user ? undefined : guestUserId,
        }),
      });

      // Refresh category list silently
      if (currentShowId) {
        loadShowSeats(currentShowId, true);
      }

      return {
        success: true,
        queuePosition: res.queuePosition,
        message: res.message,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to join waitlist',
      };
    }
  }, [currentShowId, user, guestUserId, loadShowSeats]);

  return (
    <SeatMapContext.Provider
      value={{
        currentShowId,
        seats,
        categories,
        selectedSeatIds,
        activeHold,
        remainingSeconds,
        isLoading,
        error,
        toggleSeatSelection,
        clearSelection,
        requestHold,
        releaseHold,
        loadShowSeats,
        handleSeatEvent,
        joinWaitlist,
      }}
    >
      {children}
    </SeatMapContext.Provider>
  );
};

export const useSeatMap = () => {
  const context = useContext(SeatMapContext);
  if (!context) {
    throw new Error('useSeatMap must be used within a SeatMapProvider');
  }
  return context;
};
