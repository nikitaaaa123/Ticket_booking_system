import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Show } from '../types/client.ts';
import { apiFetch } from '../services/api.ts';
import { useSeatMap } from '../context/SeatMapContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { VisualSeatMap } from '../components/VisualSeatMap.tsx';
import { WaitlistSection } from '../components/WaitlistSection.tsx';
import {
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  Lock,
  Ticket,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface EventDetailPageProps {
  showId: string;
  onBack: () => void;
  onProceedToCheckout: () => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  showId,
  onBack,
  onProceedToCheckout,
}) => {
  const { user } = useAuth();
  const [show, setShow] = useState<Show | null>(null);
  const [isLoadingShow, setIsLoadingShow] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    seats,
    categories,
    selectedSeatIds,
    activeHold,
    remainingSeconds,
    isLoading: isSeatLoading,
    error: seatError,
    toggleSeatSelection,
    clearSelection,
    requestHold,
    releaseHold,
    loadShowSeats,
    handleSeatEvent,
    joinWaitlist,
  } = useSeatMap();

  // Load show metadata on mount
  useEffect(() => {
    async function fetchShow() {
      setIsLoadingShow(true);
      try {
        const data = await apiFetch<{ show: Show }>(`/api/shows/${showId}`);
        setShow(data.show);
      } catch (err: any) {
        setErrorMsg(err.message || 'Could not load event');
      } finally {
        setIsLoadingShow(false);
      }
    }

    fetchShow();
    loadShowSeats(showId);
  }, [showId, loadShowSeats]);

  // Selected seats summary
  const selectedSeatsSummary = useMemo(() => {
    const effectiveSeatIds = selectedSeatIds.length > 0 
      ? selectedSeatIds 
      : (activeHold?.heldSeatIds || []);
    
    const selected = seats.filter((s) => effectiveSeatIds.includes(s.id));
    const totalCents = selected.length > 0 
      ? selected.reduce((sum, s) => sum + s.priceCents, 0)
      : (activeHold?.totalPriceCents || 0);

    return {
      items: selected,
      totalFormatted: `$${(totalCents / 100).toFixed(2)}`,
      totalCents,
      count: effectiveSeatIds.length,
    };
  }, [seats, selectedSeatIds, activeHold]);

  const handleHoldAndContinue = async () => {
    if (activeHold) {
      onProceedToCheckout();
      return;
    }
    const success = await requestHold();
    if (success) {
      onProceedToCheckout();
    }
  };

  const handleSilentRefresh = useCallback(() => {
    loadShowSeats(showId, true);
  }, [showId, loadShowSeats]);

  const formattedDate = show
    ? new Date(show.startTime).toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const canProceed = (selectedSeatIds.length > 0 || Boolean(activeHold)) && !isSeatLoading;

  return (
    <div id="event-detail-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to all events
      </button>

      {/* Event Header Banner */}
      {show && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 mb-8 flex flex-col md:flex-row gap-6 items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-cyan-400 border border-cyan-800">
                {show.category}
              </span>
              <span className="text-xs text-slate-400">• Live Real-Time Seating</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {show.title}
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
              {show.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{show.venue?.name || 'Grand Concert Hall'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{show.holdDurationMinutes || 10} min hold lock TTL</span>
              </div>
            </div>
          </div>

          {/* Active Hold Status Alert */}
          {activeHold && (
            <div className="w-full md:w-auto p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-sm">
                {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-300">Seats Reserved on Hold!</div>
                <div className="text-[11px] text-emerald-400">Complete checkout before timer expires.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {seatError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{seatError}</span>
        </div>
      )}

      {/* Main Grid: Visual Seat Map (Left) + Selection Summary & Waitlist (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Visual Seat Map Component */}
        <div className="lg:col-span-2 space-y-8">
          <VisualSeatMap
            showId={showId}
            seats={seats}
            categories={categories}
            selectedSeatIds={selectedSeatIds}
            onToggleSeat={toggleSeatSelection}
            onSeatEvent={handleSeatEvent}
            onRefresh={handleSilentRefresh}
          />

          {/* Waitlist Component if any category is sold out */}
          <WaitlistSection
            showId={showId}
            categories={categories}
            onJoinWaitlist={joinWaitlist}
          />
        </div>

        {/* Right 1 Column: Sticky Selection Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-cyan-400" /> Selected Seats
              </h3>
              {selectedSeatIds.length > 0 && !activeHold && (
                <button
                  onClick={clearSelection}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Selected Seats List */}
            {selectedSeatsSummary.items.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Click on any available seat on the map to add to your order.
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {selectedSeatsSummary.items.map((seat) => (
                  <div
                    key={seat.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        Row {seat.rowLabel} • Seat {seat.seatNumber}
                      </div>
                      <div className="text-[11px] text-slate-400">{seat.categoryName}</div>
                    </div>
                    <div className="font-mono font-bold text-cyan-400">
                      ${(seat.priceCents / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total Price Calculation */}
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Seats Selected</span>
                <span className="font-bold text-white">{selectedSeatsSummary.count}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-200">Subtotal</span>
                <span className="font-mono font-extrabold text-lg text-white">
                  {selectedSeatsSummary.totalFormatted}
                </span>
              </div>
            </div>

            {/* Hold & Checkout CTA Button */}
            <button
              id="lock-and-hold-seats-btn"
              type="button"
              disabled={!canProceed}
              onClick={handleHoldAndContinue}
              className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                canProceed
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-cyan-500/20 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSeatLoading ? (
                'Securing Seats...'
              ) : activeHold ? (
                'Proceed to Checkout →'
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Lock & Hold Seats ({show?.holdDurationMinutes || 10}m)
                </>
              )}
            </button>

            {/* Security Guarantee Notice */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                Atomic hold locks prevent double-booking. Your seats are guaranteed exclusively for you while the timer runs.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
