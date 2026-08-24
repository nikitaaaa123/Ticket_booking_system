import React, { useState, useEffect, useCallback } from 'react';
import { CategorySummary } from '../types/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../services/api.ts';
import { Users, Clock, AlertCircle, CheckCircle2, ChevronRight, ArrowRight, Loader2, Check } from 'lucide-react';

interface WaitlistSectionProps {
  showId?: string;
  categories: CategorySummary[];
  onJoinWaitlist: (
    categoryId: string,
    requestedCount: number,
    email?: string,
    name?: string,
    showId?: string
  ) => Promise<{ success: boolean; queuePosition?: number; message?: string }>;
}

interface JoinedTierInfo {
  queuePosition?: number;
  status: string;
}

export const WaitlistSection: React.FC<WaitlistSectionProps> = ({
  showId,
  categories,
  onJoinWaitlist,
}) => {
  const { user } = useAuth();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [seatCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [joiningCatId, setJoiningCatId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string; position?: number } | null>(null);
  const [joinedTiers, setJoinedTiers] = useState<Map<string, JoinedTierInfo>>(new Map());

  const soldOutCategories = categories.filter((c) => c.isSoldOut || c.availableSeats === 0);

  // Load user's existing waitlist entries to show live queue status
  useEffect(() => {
    if (!user) return;
    apiFetch<{ waitlist: any[] }>('/api/waitlist/my-waitlist')
      .then((res) => {
        if (res.waitlist && Array.isArray(res.waitlist)) {
          const map = new Map<string, JoinedTierInfo>();
          res.waitlist.forEach((item) => {
            if (item.status === 'WAITING' || item.status === 'OFFERED') {
              map.set(item.categoryId, {
                queuePosition: item.queuePosition || 1,
                status: item.status,
              });
            }
          });
          setJoinedTiers(map);
        }
      })
      .catch((err) => {
        console.debug('[Waitlist] Could not fetch existing queue entries:', err.message);
      });
  }, [user]);

  if (soldOutCategories.length === 0) {
    return null;
  }

  // Quick 1-click join for logged-in users, or open form for guests
  const handleTierClick = async (catId: string) => {
    if (joinedTiers.has(catId)) {
      const existing = joinedTiers.get(catId);
      setFeedback({
        success: true,
        message: `You are already registered on the waitlist for this tier.`,
        position: existing?.queuePosition,
      });
      return;
    }

    if (user && user.email) {
      setJoiningCatId(catId);
      setFeedback(null);
      try {
        console.log('[WaitlistSection] handleTierClick dispatching onJoinWaitlist:', {
          showId,
          categoryId: catId,
          seatCount,
          email: user.email,
          name: user.fullName,
        });
        const res = await onJoinWaitlist(catId, seatCount, user.email, user.fullName, showId);
        if (res.success) {
          setJoinedTiers((prev) => {
            const next = new Map(prev);
            next.set(catId, { queuePosition: res.queuePosition || 1, status: 'WAITING' });
            return next;
          });
          setFeedback({
            success: true,
            message: res.message || 'Successfully joined the waitlist queue!',
            position: res.queuePosition,
          });
          setSelectedCatId(null);
        } else {
          setFeedback({
            success: false,
            message: res.message || 'Failed to join waitlist. Please try again.',
          });
        }
      } catch (err: any) {
        setFeedback({
          success: false,
          message: err.message || 'An unexpected error occurred while joining the queue.',
        });
      } finally {
        setJoiningCatId(null);
      }
    } else {
      setSelectedCatId(catId);
      setFeedback(null);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;

    setIsSubmitting(true);
    setFeedback(null);

    const emailToUse = guestEmail.trim();
    const nameToUse = guestName.trim() || 'Guest Customer';

    if (!emailToUse) {
      setFeedback({ success: false, message: 'Please provide a valid email address to receive seat notifications.' });
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('[WaitlistSection] handleGuestSubmit dispatching onJoinWaitlist:', {
        showId,
        categoryId: selectedCatId,
        seatCount,
        email: emailToUse,
        name: nameToUse,
      });
      const res = await onJoinWaitlist(selectedCatId, seatCount, emailToUse, nameToUse, showId);
      if (res.success) {
        setJoinedTiers((prev) => {
          const next = new Map(prev);
          next.set(selectedCatId, { queuePosition: res.queuePosition || 1, status: 'WAITING' });
          return next;
        });
        setFeedback({
          success: true,
          message: res.message || 'Successfully joined the waitlist queue!',
          position: res.queuePosition,
        });
        setSelectedCatId(null);
      } else {
        setFeedback({
          success: false,
          message: res.message || 'Failed to join waitlist. Please verify your details.',
        });
      }
    } catch (err: any) {
      setFeedback({
        success: false,
        message: err.message || 'An error occurred while communicating with the waitlist server.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="waitlist-card" className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Sold-Out Tier Waitlist Queue</h3>
          <p className="text-xs text-slate-400">
            Join the FIFO priority queue. You will receive an instant 15-minute claim pass the moment a seat opens up.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-start justify-between gap-3 text-sm border ${
            feedback.success
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
              : 'bg-rose-950/80 border-rose-700 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.success ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            )}
            <div>
              <div className="font-semibold text-xs sm:text-sm">{feedback.message}</div>
              {feedback.position !== undefined && (
                <div className="text-xs mt-1 text-emerald-300 font-mono font-bold">
                  Your Queue Position: #{feedback.position} in line
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sold Out Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {soldOutCategories.map((cat) => {
          const isSelected = selectedCatId === cat.id;
          const joinedInfo = joinedTiers.get(cat.id);
          const isJoining = joiningCatId === cat.id;

          return (
            <div
              key={cat.id}
              className={`p-4 rounded-xl border transition-all ${
                joinedInfo
                  ? 'bg-emerald-950/30 border-emerald-700/60 text-white'
                  : isSelected
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                  : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.colorCode }}
                  />
                  <span className="font-bold text-sm text-white">{cat.name}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800">
                  Sold Out
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                <span className="text-slate-400 font-medium">
                  Tier: ${(cat.priceCents / 100).toFixed(2)}
                </span>

                {joinedInfo ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-900/80 border border-emerald-600 text-emerald-300 font-bold text-xs">
                    <Check className="w-3.5 h-3.5" />
                    Joined • #{joinedInfo.queuePosition || 1} in line
                  </span>
                ) : (
                  <button
                    id={`join-waitlist-btn-${cat.id}`}
                    type="button"
                    disabled={isJoining}
                    onClick={() => handleTierClick(cat.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md hover:shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        Join Queue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Join Waitlist Form for Guests */}
      {selectedCatId && !user && (
        <form onSubmit={handleGuestSubmit} className="bg-slate-800/80 p-5 rounded-xl border border-amber-500/50 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Enter details for: {categories.find((c) => c.id === selectedCatId)?.name}
            </div>
            <button
              type="button"
              onClick={() => setSelectedCatId(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Your Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Email for Alert</label>
              <input
                type="email"
                required
                placeholder="e.g. john@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setSelectedCatId(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Joining Queue...
                </>
              ) : (
                <>
                  Confirm Waitlist Spot
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
