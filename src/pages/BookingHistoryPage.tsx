import React, { useState, useEffect } from 'react';
import { Booking, WaitlistEntry } from '../types/client.ts';
import { apiFetch } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Ticket,
  Calendar,
  MapPin,
  QrCode,
  XCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface BookingHistoryPageProps {
  onClaimOffer?: (token: string) => void;
  onExploreEvents?: () => void;
}

export const BookingHistoryPage: React.FC<BookingHistoryPageProps> = ({
  onClaimOffer,
  onExploreEvents,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'waitlist'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedBookingForQR, setSelectedBookingForQR] = useState<Booking | null>(null);
  const [cancellationBookingId, setCancellationBookingId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('Schedule conflict');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, waitlistRes] = await Promise.all([
        apiFetch<{ bookings: Booking[] }>('/api/bookings/my-bookings').catch(() => ({
          bookings: [],
        })),
        apiFetch<{ waitlist: WaitlistEntry[] }>('/api/waitlist/my-waitlist').catch(() => ({
          waitlist: [],
        })),
      ]);

      setBookings(bookingsRes.bookings || []);
      setWaitlistEntries(waitlistRes.waitlist || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await apiFetch('/api/bookings/cancel', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          reason: cancellationReason,
        }),
      });

      setActionFeedback('Booking cancelled successfully. Seats were returned or reallocated to the waitlist queue.');
      setCancellationBookingId(null);
      loadData();
    } catch (err: any) {
      setActionFeedback(`Cancellation failed: ${err.message}`);
    }
  };

  return (
    <div id="booking-history-page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            My Orders & Waitlist Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access your confirmed admission gate passes and track your live waitlist queue standings.
          </p>
        </div>

        <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'bookings'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Confirmed Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'waitlist'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Waitlist ({waitlistEntries.length})
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="mb-6 p-4 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-300 text-xs flex items-center justify-between">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Bookings View */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading your bookings...</div>
          ) : bookings.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
              <Ticket className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-base font-bold text-white">No active bookings yet</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Explore our featured concerts, cinema experiences, and live theater events.
              </p>
              {onExploreEvents && (
                <button
                  onClick={onExploreEvents}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors"
                >
                  Browse Shows Now
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bookings.map((booking) => {
                const isCancelled = booking.status === 'CANCELLED';

                return (
                  <div
                    key={booking.id}
                    className={`bg-slate-900 border rounded-3xl p-6 flex flex-col justify-between transition-all ${
                      isCancelled ? 'border-slate-800/60 opacity-60' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono font-bold text-xs text-cyan-400">
                          {booking.bookingReference}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCancelled
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-800'
                              : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white tracking-tight">{booking.showTitle}</h3>

                      <div className="mt-4 space-y-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {booking.showStartTime
                              ? new Date(booking.showStartTime).toLocaleString('en-US', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : 'Confirmed Date'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{booking.venueName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ticket className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-semibold text-white">
                            Seats:{' '}
                            {booking.items && booking.items.length > 0
                              ? booking.items.map((i) => i.seatLabel).join(', ')
                              : 'Standard'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Total Paid</span>
                        <span className="text-sm font-mono font-extrabold text-white">
                          ${(booking.totalAmountCents / 100).toFixed(2)}
                        </span>
                      </div>

                      {!isCancelled && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedBookingForQR(booking)}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
                          >
                            <QrCode className="w-3.5 h-3.5" /> View Pass
                          </button>

                          <button
                            onClick={() => setCancellationBookingId(booking.id)}
                            className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-xs font-semibold transition-colors border border-rose-900/40"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Waitlist View */}
      {activeTab === 'waitlist' && (
        <div className="space-y-4">
          {waitlistEntries.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-base font-bold text-white">You are not in any waitlists</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                If a high-demand show tier sells out, join its waitlist to receive priority 15-minute seat offers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {waitlistEntries.map((entry) => {
                const hasActiveOffer = entry.activeOfferToken && entry.status === 'OFFERED';

                return (
                  <div
                    key={entry.id}
                    className={`bg-slate-900 border rounded-3xl p-6 flex flex-col justify-between ${
                      hasActiveOffer
                        ? 'border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${entry.colorCode}20`,
                            color: entry.colorCode,
                            border: `1px solid ${entry.colorCode}50`,
                          }}
                        >
                          {entry.categoryName} Tier
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            hasActiveOffer
                              ? 'bg-amber-950 text-amber-300 border border-amber-600 animate-pulse'
                              : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white">{entry.showTitle}</h3>

                      <div className="mt-4 space-y-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{entry.showStartTime ? new Date(entry.showStartTime).toLocaleString() : 'Upcoming'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-white">
                            {entry.queuePosition
                              ? `Position #${entry.queuePosition} in line`
                              : 'Queue Status: ' + entry.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Joined on {new Date(entry.createdAt).toLocaleDateString()}
                      </span>

                      {hasActiveOffer && onClaimOffer && (
                        <button
                          onClick={() => onClaimOffer(entry.activeOfferToken!)}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md flex items-center gap-1.5"
                        >
                          Claim Offered Seat &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {selectedBookingForQR && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {selectedBookingForQR.bookingReference}
              </span>
              <button
                onClick={() => setSelectedBookingForQR(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl mx-auto inline-block shadow-inner">
              <img
                src={selectedBookingForQR.qrCodeDataURL}
                alt="Gate Pass QR"
                className="w-48 h-48 object-contain"
              />
            </div>

            <div>
              <div className="font-bold text-white text-sm">{selectedBookingForQR.showTitle}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Seats: {selectedBookingForQR.items.map((i) => i.seatLabel).join(', ')}
              </div>
            </div>

            <button
              onClick={() => setSelectedBookingForQR(null)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellationBookingId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Cancel This Booking?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cancelling will permanently release your assigned seats. Seats will automatically be reallocated to the next customer on the waitlist queue.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for cancellation
              </label>
              <input
                type="text"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCancellationBookingId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:text-white"
              >
                Keep Booking
              </button>
              <button
                onClick={() => handleCancelBooking(cancellationBookingId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
