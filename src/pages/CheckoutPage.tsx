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
  const { activeHold, remainingSeconds, releaseHold, seats } = useSeatMap();

  const [customerName, setCustomerName] = useState<string>(user?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState<string>(user?.email || '');
  const [cardNumber, setCardNumber] = useState<string>('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvc, setCardCvc] = useState<string>('888');
  const [showMeta, setShowMeta] = useState<Show | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load show meta
  useEffect(() => {
    if (!activeHold) return;
    apiFetch<{ show: Show }>(`/api/shows/${activeHold.showId}`)
      .then((res) => setShowMeta(res.show))
      .catch(console.error);
  }, [activeHold]);

  if (!activeHold || remainingSeconds <= 0) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Hold Reservation Expired</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your 10-minute seat hold lock has timed out, and the seats were returned to the inventory pool or reallocated to the waitlist queue.
        </p>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all"
        >
          Return to Seat Selection
        </button>
      </div>
    );
  }

  const heldSeatsDetails = seats.filter((s) => activeHold.heldSeatIds.includes(s.id));
  const subtotalFormatted = `$${(activeHold.totalPriceCents / 100).toFixed(2)}`;
  const serviceFeeCents = Math.round(activeHold.totalPriceCents * 0.05);
  const totalAmountCents = activeHold.totalPriceCents + serviceFeeCents;
  const totalFormatted = `$${(totalAmountCents / 100).toFixed(2)}`;

  // Formatted timer strings
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0');

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail || !customerName) {
      setErrorMsg('Please enter your full name and email for ticket delivery.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await apiFetch<{ booking: Booking }>('/api/bookings/confirm', {
        method: 'POST',
        body: JSON.stringify({
          showId: activeHold.showId,
          seatIds: activeHold.heldSeatIds,
          holdSessionToken: activeHold.holdSessionToken,
          customerEmail,
          customerName,
        }),
      });

      // Clear hold from local storage
      localStorage.removeItem('tbs_active_hold');
      onBookingSuccess(res.booking);
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment and booking confirmation failed.');
      setIsProcessing(false);
    }
  };

  return (
    <div id="checkout-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header with Prominent Countdown Timer */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Change Seat Selection
        </button>

        {/* Live Countdown Badge */}
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono font-bold text-sm ${
            remainingSeconds < 120
              ? 'bg-rose-950/80 text-rose-300 border-rose-600 animate-pulse'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Hold Time Remaining: {minutes}:{seconds}</span>
        </div>
      </div>

      {errorMsg && (
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
                      placeholder="e.g. Jane Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
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
                      placeholder="e.g. jane@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
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
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Expires</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">CVC / CVV</label>
                    <input
                      type="text"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm tracking-wider uppercase shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                'Confirming & Generating Tickets...'
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
          </div>
        </div>
      </div>
    </div>
  );
};
