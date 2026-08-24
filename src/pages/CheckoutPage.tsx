import React, { useState, useEffect } from 'react';
import { useSeatMap } from '../context/SeatMapContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { Booking, Show } from '../types/client.ts';
import {
  Clock,
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Ticket,
  Mail,
  User as UserIcon,
} from 'lucide-react';

interface CheckoutPageProps {
  onBack: () => void;
  onBookingSuccess: (booking: Booking) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  onBack,
  onBookingSuccess,
}) => {
  const { user } = useAuth();
  const { activeHold, remainingSeconds, releaseHold, verifyActiveHold, seats } = useSeatMap();

  const [customerName, setCustomerName] = useState<string>(user?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState<string>(user?.email || '');
  const [cardNumber, setCardNumber] = useState<string>('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvc, setCardCvc] = useState<string>('888');
  const [showMeta, setShowMeta] = useState<Show | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isHoldExpired, setIsHoldExpired] = useState<boolean>(false);

  // Sync and verify active hold with backend server on mount and when activeHold changes
  useEffect(() => {
    if (!activeHold) {
      setIsHoldExpired(true);
      return;
    }

    verifyActiveHold().then((res) => {
      if (!res.valid) {
        setIsHoldExpired(true);
        setErrorMsg(res.message || 'Seat hold expired — please select the seat again.');
      } else {
        setIsHoldExpired(false);
      }
    });
  }, [activeHold?.holdSessionToken, verifyActiveHold]);

  // Automatically update state when countdown hits zero
  useEffect(() => {
    if (remainingSeconds <= 0 && activeHold) {
      setIsHoldExpired(true);
      setErrorMsg('Seat hold expired — please select the seat again.');
    }
  }, [remainingSeconds, activeHold]);

  // Load show meta
  useEffect(() => {
    if (!activeHold) return;
    apiFetch<{ show: Show }>(`/api/shows/${activeHold.showId}`)
      .then((res) => setShowMeta(res.show))
      .catch(console.error);
  }, [activeHold?.showId]);

  const isExpired = isHoldExpired || !activeHold || remainingSeconds <= 0;

  if (!activeHold && isExpired) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Seat hold expired — please select the seat again</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your 10-minute seat hold lock has timed out, and the seats were automatically returned to the inventory pool or reallocated to the waitlist queue.
        </p>
        <button
          onClick={onBack}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Seat Selection
        </button>
      </div>
    );
  }

  const heldSeatsDetails = activeHold ? seats.filter((s) => activeHold.heldSeatIds.includes(s.id)) : [];
  const subtotalFormatted = activeHold ? `$${(activeHold.totalPriceCents / 100).toFixed(2)}` : '$0.00';
  const serviceFeeCents = activeHold ? Math.round(activeHold.totalPriceCents * 0.05) : 0;
  const totalAmountCents = activeHold ? activeHold.totalPriceCents + serviceFeeCents : 0;
  const totalFormatted = `$${(totalAmountCents / 100).toFixed(2)}`;

  // Formatted timer strings
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0');

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHold || isExpired) {
      setErrorMsg('Seat hold expired — please select the seat again.');
      setIsHoldExpired(true);
      return;
    }

    const trimmedEmail = customerEmail.trim();
    const trimmedName = customerName.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!trimmedName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    // Pre-verify hold immediately before committing payment
    try {
      const verifyRes = await verifyActiveHold();
      if (!verifyRes.valid) {
        setIsHoldExpired(true);
        setErrorMsg('Seat hold expired — please select the seat again.');
        setIsProcessing(false);
        return;
      }
    } catch (err: any) {
      setIsHoldExpired(true);
      setErrorMsg('Seat hold expired — please select the seat again.');
      setIsProcessing(false);
      return;
    }

    try {
      const res = await apiFetch<{ booking: Booking; emailDelivery?: any }>('/api/bookings/confirm', {
        method: 'POST',
        body: JSON.stringify({
          showId: activeHold.showId,
          seatIds: activeHold.heldSeatIds,
          holdSessionToken: activeHold.holdSessionToken,
          customerEmail: trimmedEmail,
          customerName: trimmedName,
        }),
      });

      // Clear hold from local session
      sessionStorage.removeItem('tbs_active_hold');
      localStorage.removeItem('tbs_active_hold');
      onBookingSuccess(res.booking);
    } catch (err: any) {
      const isHoldExpiredError =
        err.message?.toLowerCase().includes('expired') ||
        err.error === 'HoldExpired' ||
        err.status === 410;

      if (isHoldExpiredError) {
        setIsHoldExpired(true);
        setErrorMsg('Seat hold expired — please select the seat again.');
      } else {
        setErrorMsg(err.message || 'Payment and booking confirmation failed.');
      }
      setIsProcessing(false);
    }
  };

  return (
    <div id="checkout-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header with Prominent Countdown Timer */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Seat Selection
        </button>

        {/* Live Synchronized Countdown Badge */}
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono font-bold text-sm transition-all ${
            isExpired
              ? 'bg-rose-950/90 text-rose-300 border-rose-600 ring-2 ring-rose-500/40'
              : remainingSeconds < 120
              ? 'bg-amber-950/80 text-amber-300 border-amber-600 animate-pulse'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>
            {isExpired ? 'Hold Status: EXPIRED' : `Hold Time Remaining: ${minutes}:${seconds}`}
          </span>
        </div>
      </div>

      {/* Prominent Expired Alert Banner */}
      {isExpired && (
        <div className="mb-6 p-5 rounded-2xl bg-rose-950/90 border-2 border-rose-600 text-rose-200 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <div>
              <div className="font-extrabold text-white">Seat hold expired — please select the seat again</div>
              <div className="text-xs text-rose-300 mt-0.5">
                The 10-minute hold window has elapsed. The seat lock was released back to the general inventory pool.
              </div>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs whitespace-nowrap transition-all shadow-md"
          >
            Select Seats Again
          </button>
        </div>
      )}

      {errorMsg && !isExpired && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Payment & Delivery Information Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleConfirmOrder} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Ticket Delivery & Checkout
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your QR gate pass and receipt will be emailed immediately upon confirmation.
              </p>
            </div>

            {/* Recipient Information */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                1. Recipient Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      disabled={isExpired}
                      placeholder="e.g. Jane Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address (For QR Tickets)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      disabled={isExpired}
                      placeholder="e.g. jane@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Payment Module */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  2. Payment Method
                </h3>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit Encrypted
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                  <span className="font-semibold flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-cyan-400" /> Card Payment
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">Instant Authorization</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Card Number</label>
                  <input
                    type="text"
                    disabled={isExpired}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Expires</label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">CVC / CVV</label>
                    <input
                      type="text"
                      disabled={isExpired}
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action: Immediately disabled upon expiration */}
            <button
              type="submit"
              disabled={isProcessing || isExpired}
              className={`w-full py-4 rounded-2xl font-extrabold text-sm tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 ${
                isExpired
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-cyan-500/20 cursor-pointer'
              }`}
            >
              {isProcessing ? (
                'Confirming & Generating Tickets...'
              ) : isExpired ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Hold Expired — Please Select Seats Again
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Pay {totalFormatted} & Confirm Booking
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right 1 Column: Order Summary & Held Seats Breakdown */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Ticket className="w-4 h-4 text-cyan-400" /> Order Summary
            </h3>

            {showMeta && (
              <div>
                <div className="text-sm font-extrabold text-white">{showMeta.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{showMeta.venue?.name}</div>
              </div>
            )}

            {/* Held Seats */}
            <div className="space-y-2 py-2 border-y border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Reserved Seats</div>
              {heldSeatsDetails.map((seat) => (
                <div key={seat.id} className="flex justify-between text-xs text-slate-300">
                  <span>Row {seat.rowLabel} • Seat {seat.seatNumber} ({seat.categoryName})</span>
                  <span className="font-mono text-cyan-400">${(seat.priceCents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Calculation */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Tickets Subtotal</span>
                <span className="text-white font-mono">{subtotalFormatted}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Service & Processing Fee (5%)</span>
                <span className="text-white font-mono">${(serviceFeeCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                <span>Total Due</span>
                <span className="text-cyan-400 font-mono text-base">{totalFormatted}</span>
              </div>
            </div>

            {isExpired && (
              <div className="pt-2">
                <button
                  onClick={onBack}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Return to Seat Selection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
