import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.ts';
import { WaitlistOfferDetails, Booking } from '../types/client.ts';
import {
  Clock,
  Ticket,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface WaitlistOfferClaimPageProps {
  offerToken: string;
  onBookingSuccess: (booking: Booking) => void;
  onBackToBrowse: () => void;
}

export const WaitlistOfferClaimPage: React.FC<WaitlistOfferClaimPageProps> = ({
  offerToken,
  onBookingSuccess,
  onBackToBrowse,
}) => {
  const [offer, setOffer] = useState<WaitlistOfferDetails | null>(null);
  const [remainingSecs, setRemainingSecs] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [declined, setDeclined] = useState<boolean>(false);

  useEffect(() => {
    async function loadOffer() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiFetch<{ offer: WaitlistOfferDetails }>(
          `/api/waitlist/offers/${offerToken}`
        );
        setOffer(res.offer);
        setRemainingSecs(res.offer.remainingSeconds);
        setCustomerName(res.offer.customerName || '');
        setCustomerEmail(res.offer.customerEmail || '');
      } catch (err: any) {
        setErrorMsg(err.message || 'Offer expired or not found.');
      } finally {
        setIsLoading(false);
      }
    }
    loadOffer();
  }, [offerToken]);

  // Live offer countdown
  useEffect(() => {
    if (!offer || remainingSecs <= 0) return;
    const interval = setInterval(() => {
      setRemainingSecs((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMsg('This exclusive ticket offer has expired and was reallocated to the next person.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [offer, remainingSecs]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ booking: Booking }>(
        `/api/waitlist/offers/${offerToken}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            customerEmail,
            customerName,
          }),
        }
      );
      onBookingSuccess(res.booking);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to claim offer.');
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to pass on this ticket? It will immediately be offered to the next fan in line.')) {
      return;
    }
    setIsProcessing(true);
    try {
      await apiFetch(`/api/waitlist/offers/${offerToken}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Customer passed' }),
      });
      setDeclined(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Decline failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center text-slate-400">
        Validating your exclusive waitlist claim pass...
      </div>
    );
  }

  if (declined) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <CheckCircle className="w-12 h-12 text-blue-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Offer Declined</h2>
        <p className="text-xs text-slate-400">
          Thank you for letting us know. We have immediately passed this reserved seat to the next person waiting in line.
        </p>
        <button
          onClick={onBackToBrowse}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
        >
          Explore Other Shows
        </button>
      </div>
    );
  }

  if (errorMsg || !offer) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Offer No Longer Available</h2>
        <p className="text-xs text-slate-400">{errorMsg || 'This offer has expired or already been claimed.'}</p>
        <button
          onClick={onBackToBrowse}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
        >
          Browse Upcoming Events
        </button>
      </div>
    );
  }

  const mins = Math.floor(remainingSecs / 60);
  const secs = (remainingSecs % 60).toString().padStart(2, '0');

  return (
    <div id="waitlist-claim-page" className="max-w-2xl mx-auto px-4 py-10">
      {/* Expiry Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-amber-300 text-xs font-semibold">
          <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Priority Window Closes In:</span>
        </div>
        <div className="font-mono font-extrabold text-base text-amber-400">
          {mins}:{secs}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="border-b border-slate-800 pb-4">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-cyan-400 border border-cyan-800">
            Exclusive Waitlist Offer
          </span>
          <h1 className="text-2xl font-extrabold text-white mt-2 tracking-tight">
            A Seat Opened Up For You!
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            You reached the front of the queue for <strong className="text-white">{offer.showTitle}</strong>.
          </p>
        </div>

        {/* Offer Details */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Event</span>
            <span className="font-bold text-white">{offer.showTitle}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Reserved Seat</span>
            <span className="font-bold text-cyan-400">{offer.seatLabel} ({offer.categoryName})</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Venue</span>
            <span className="text-slate-200">{offer.venueName}</span>
          </div>
          <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800 font-extrabold text-sm">
            <span>Ticket Price</span>
            <span className="text-white font-mono">{offer.priceFormatted}</span>
          </div>
        </div>

        {/* Accept Form */}
        <form onSubmit={handleAccept} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Your Full Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email for QR Ticket</label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing || remainingSecs <= 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? 'Confirming Ticket...' : `Claim & Book For ${offer.priceFormatted}`}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDecline}
            className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
          >
            I cannot make it (Pass to next person in queue)
          </button>
        </div>
      </div>
    </div>
  );
};
