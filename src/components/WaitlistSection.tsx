import React, { useState } from 'react';
import { CategorySummary } from '../types/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Users, Clock, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';

interface WaitlistSectionProps {
  categories: CategorySummary[];
  onJoinWaitlist: (
    categoryId: string,
    requestedCount: number,
    email?: string,
    name?: string
  ) => Promise<{ success: boolean; queuePosition?: number; message?: string }>;
}

export const WaitlistSection: React.FC<WaitlistSectionProps> = ({
  categories,
  onJoinWaitlist,
}) => {
  const { user } = useAuth();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [seatCount, setSeatCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string; position?: number } | null>(null);

  const soldOutCategories = categories.filter((c) => c.isSoldOut || c.availableSeats === 0);

  if (soldOutCategories.length === 0) {
    return null;
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;

    setIsSubmitting(true);
    setFeedback(null);

    const emailToUse = user ? user.email : guestEmail;
    const nameToUse = user ? user.fullName : guestName;

    if (!emailToUse) {
      setFeedback({ success: false, message: 'Please provide an email to receive seat alerts.' });
      setIsSubmitting(false);
      return;
    }

    const res = await onJoinWaitlist(selectedCatId, seatCount, emailToUse, nameToUse);

    setFeedback({
      success: res.success,
      message: res.message || (res.success ? 'Successfully joined queue!' : 'Failed to join waitlist'),
      position: res.queuePosition,
    });
    setIsSubmitting(false);

    if (res.success) {
      // Clear form
      setTimeout(() => {
        setSelectedCatId(null);
      }, 4000);
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
          <h3 className="text-lg font-bold text-white">Sold-Out Tier Waitlist</h3>
          <p className="text-xs text-slate-400">
            Get instantly notified with a direct 15-minute priority claim pass when a ticket frees up.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border ${
            feedback.success
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {feedback.success ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          )}
          <div>
            <div className="font-semibold">{feedback.message}</div>
            {feedback.position && (
              <div className="text-xs mt-1 text-emerald-400 font-mono">
                Queue Position: #{feedback.position} in line
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sold Out Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {soldOutCategories.map((cat) => {
          const isSelected = selectedCatId === cat.id;

          return (
            <div
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                  : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.colorCode }}
                  />
                  <span className="font-bold text-sm">{cat.name}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800">
                  Sold Out
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Tier Price: ${(cat.priceCents / 100).toFixed(2)}</span>
                <span className="text-amber-400 font-medium">Join Queue &rarr;</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Join Waitlist Form */}
      {selectedCatId && (
        <form onSubmit={handleJoin} className="bg-slate-800/60 p-5 rounded-xl border border-slate-700 space-y-4">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            Joining Waitlist for: {categories.find((c) => c.id === selectedCatId)?.name}
          </div>

          {!user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Your Full Name</label>
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
                <label className="block text-xs text-slate-400 mb-1">Email for Alert</label>
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
          )}

          {user && (
            <div className="text-xs text-slate-400">
              Notification will be sent to: <span className="text-white font-medium">{user.email}</span>
            </div>
          )}

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
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? 'Joining Queue...' : 'Confirm Waitlist Spot'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
