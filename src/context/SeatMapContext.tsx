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
  verifyActiveHold: () => Promise<{ valid: boolean; remainingSeconds: number; message?: string }>;
  loadShowSeats: (showId: string, silent?: boolean) => Promise<void>;
  handleSeatEvent: (event: RealtimeSeatEvent) => void;
  joinWaitlist: (
    categoryId: string,
    requestedCount?: number,
    email?: string,
    name?: string,
    showId?: string
  ) => Promise<{ success: boolean; queuePosition?: number; message?: string }>;
}

const SeatMapContext = createContext<SeatMapContextType | undefined>(undefined);

export const SeatMapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, guestUserId } = useAuth();
  const currentEffectiveUserId = user?.id || guestUserId;

  const [currentShowId, setCurrentShowId] = useState<string | null>(null);
  const [seats, setSeats] = useState<ShowSeatDetail[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeHold, setActiveHold] = useState<HoldSession | null>(() => {
    const saved = sessionStorage.getItem('tbs_active_hold');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          return parsed;
        }
      } catch {
        sessionStorage.removeItem('tbs_active_hold');
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

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (activeHold?.expiresAt) {
      const diffMs = new Date(activeHold.expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diffMs / 1000));
    }
    return 0;
  });
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

  // Verify active hold against backend server (recovers remaining time on refresh or check)
  const verifyActiveHold = useCallback(async (): Promise<{ valid: boolean; remainingSeconds: number; message?: string }> => {
    const currentSavedHold = activeHold || (() => {
      const saved = sessionStorage.getItem('tbs_active_hold');
      return saved ? JSON.parse(saved) : null;
    })();

    if (!currentSavedHold || !currentSavedHold.showId || !currentSavedHold.heldSeatIds?.length) {
      return { valid: false, remainingSeconds: 0, message: 'No active hold found' };
    }

    try {
      const res = await apiFetch<{
        valid: boolean;
        expired?: boolean;
        expiresAt?: string;
        remainingSeconds?: number;
        heldSeatIds?: string[];
        totalPriceCents?: number;
        message?: string;
      }>('/api/seats/verify-hold', {
        method: 'POST',
        body: JSON.stringify({
          showId: currentSavedHold.showId,
          seatIds: currentSavedHold.heldSeatIds,
          holdSessionToken: currentSavedHold.holdSessionToken,
          guestUserId: user ? undefined : guestUserId,
        }),
      });

      if (res.valid && res.expiresAt) {
        const diffMs = new Date(res.expiresAt).getTime() - Date.now();
        const secs = Math.max(0, Math.floor(diffMs / 1000));
        setRemainingSeconds(secs);

        const updatedHold: HoldSession = {
          ...currentSavedHold,
          expiresAt: res.expiresAt,
          totalPriceCents: res.totalPriceCents ?? currentSavedHold.totalPriceCents,
        };
        setActiveHold(updatedHold);
        sessionStorage.setItem('tbs_active_hold', JSON.stringify(updatedHold));
        return { valid: true, remainingSeconds: secs };
      } else {
        // Expired or invalidated on server
        setActiveHold(null);
        sessionStorage.removeItem('tbs_active_hold');
        setSelectedSeatIds([]);
        setRemainingSeconds(0);
        if (currentSavedHold.showId) {
          loadShowSeats(currentSavedHold.showId, true);
        }
        return {
          valid: false,
          remainingSeconds: 0,
          message: res.message || 'Your seat hold has expired. Please select the seat again.',
        };
      }
    } catch (err: any) {
      console.warn('[SeatMapContext] verifyActiveHold failed:', err);
      setActiveHold(null);
      sessionStorage.removeItem('tbs_active_hold');
      setSelectedSeatIds([]);
      setRemainingSeconds(0);
      return {
        valid: false,
        remainingSeconds: 0,
        message: err.message || 'Your seat hold has expired. Please select the seat again.',
      };
    }
  }, [activeHold, user, guestUserId, loadShowSeats]);

  // Check and verify on initial mount or rehydration
  useEffect(() => {
    const saved = sessionStorage.getItem('tbs_active_hold');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
          setActiveHold(null);
          sessionStorage.removeItem('tbs_active_hold');
          setSelectedSeatIds([]);
          setRemainingSeconds(0);
        } else {
          // Check authoritative server state
          verifyActiveHold();
        }
      } catch {
        sessionStorage.removeItem('tbs_active_hold');
      }
    }
  }, []);

  // Real-time surgical seat event handler (updates state in-place without resetting selection)
  const handleSeatEvent = useCallback((event: RealtimeSeatEvent) => {
    if (!event) return;
    if (event.showId && currentShowId && event.showId !== currentShowId) {
      return;
    }

    setSeats((prevSeats) => {
      if (!event.seatIds || event.seatIds.length === 0) return prevSeats;
      const targetIds = new Set(event.seatIds);

      const nextSeats = prevSeats.map((seat) => {
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

      // Recalculate category availability dynamically in real-time
      setCategories((prevCategories) => {
        return prevCategories.map((cat) => {
          const availableInCat = nextSeats.filter(
            (s) => s.categoryId === cat.id && s.status === 'AVAILABLE'
          ).length;
          return {
            ...cat,
            availableSeats: availableInCat,
            isSoldOut: availableInCat === 0,
          };
        });
      });

      return nextSeats;
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
  }, [currentShowId, currentEffectiveUserId]);

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
        sessionStorage.removeItem('tbs_active_hold');
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
        sessionStorage.setItem('tbs_active_hold', JSON.stringify(holdData));
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
      sessionStorage.removeItem('tbs_active_hold');
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
    name?: string,
    showId?: string
  ) => {
    const effectiveShowId = showId || currentShowId;
    if (!effectiveShowId) {
      console.error('[SeatMapContext] Cannot join waitlist: no showId provided or selected', {
        showId,
        currentShowId,
        categoryId,
      });
      return { success: false, message: 'showId and categoryId are required.' };
    }

    const payload = {
      showId: effectiveShowId,
      categoryId,
      requestedSeatsCount: requestedCount,
      customerEmail: email || user?.email,
      customerName: name || user?.fullName,
      guestUserId: user ? undefined : guestUserId,
    };

    console.log('[SeatMapContext] POST /api/waitlist/join payload:', payload);

    try {
      const res = await apiFetch<{
        waitlistEntry: any;
        queuePosition: number;
        message: string;
      }>('/api/waitlist/join', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Refresh category list silently
      if (effectiveShowId) {
        loadShowSeats(effectiveShowId, true);
      }

      return {
        success: true,
        queuePosition: res.queuePosition,
        message: res.message,
      };
    } catch (err: any) {
      console.error('[SeatMapContext] Waitlist join error:', err);
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
        verifyActiveHold,
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
