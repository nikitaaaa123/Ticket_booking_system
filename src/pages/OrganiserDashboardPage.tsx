import React, { useState, useEffect } from 'react';
import { Show, Venue, ShowRevenueSummary } from '../types/client.ts';
import { apiFetch } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Calendar,
  PlusCircle,
  TrendingUp,
  DollarSign,
  Users,
  Ticket,
  Eye,
  BarChart3,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const OrganiserDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'shows' | 'create' | 'revenue'>('shows');
  const [shows, setShows] = useState<Show[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [revenueSummary, setRevenueSummary] = useState<ShowRevenueSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create Show Form state
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Concert');
  const [venueId, setVenueId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [bannerImageUrl, setBannerImageUrl] = useState<string>('');
  const [vipPrice, setVipPrice] = useState<number>(120);
  const [standardPrice, setStandardPrice] = useState<number>(55);
  const [balconyPrice, setBalconyPrice] = useState<number>(35);

  const [feedback, setFeedback] = useState<string | null>(null);

  const loadOrganiserData = async () => {
    setIsLoading(true);
    try {
      const [showsRes, venuesRes] = await Promise.all([
        apiFetch<{ shows: Show[] }>('/api/shows/organiser/my-shows').catch(async () => {
          // Fallback to public shows if not an organiser endpoint
          return apiFetch<{ shows: Show[] }>('/api/shows');
        }),
        apiFetch<{ venues: Venue[] }>('/api/venues'),
      ]);
      setShows(showsRes.shows || []);
      setVenues(venuesRes.venues || []);
      if (venuesRes.venues && venuesRes.venues.length > 0) {
        setVenueId(venuesRes.venues[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrganiserData();
  }, [user?.id]);

  const loadRevenue = async (sId: string) => {
    setSelectedShowId(sId);
    try {
      const res = await apiFetch<{ summary: ShowRevenueSummary }>(`/api/shows/${sId}/summary`);
      setRevenueSummary(res.summary);
      setActiveTab('revenue');
    } catch (err: any) {
      alert(`Could not load revenue report: ${err.message}`);
    }
  };

  const handleCreateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueId) {
      alert('Please select a venue');
      return;
    }

    try {
      // Fetch venue categories to construct pricing
      const venueRes = await apiFetch<{ venue?: { categories?: any[]; seats?: any[] }; categories?: any[] }>(`/api/venues/${venueId}`);
      let cats = venueRes.venue?.categories || venueRes.categories || [];

      // Fallback to loaded venues state if empty
      if (cats.length === 0) {
        const found = venues.find((v) => v.id === venueId);
        if (found && (found as any).categories?.length > 0) {
          cats = (found as any).categories;
        }
      }

      if (cats.length === 0) {
        throw new Error('The selected venue has no configured seating categories. Please select a valid venue or configure categories first.');
      }

      const pricing = cats.map((c: any) => {
        let price = standardPrice;
        const name = (c.name || '').toLowerCase();
        if (name.includes('vip') || name.includes('orchestra') || name.includes('front')) {
          price = vipPrice;
        } else if (name.includes('balcony') || name.includes('mezzanine') || name.includes('tier') || name.includes('upper')) {
          price = balconyPrice;
        } else if (name.includes('premium')) {
          price = Math.round((vipPrice + standardPrice) / 2);
        } else {
          price = standardPrice;
        }

        return {
          categoryId: c.id,
          priceCents: Math.max(100, Math.round(price * 100)),
          currency: 'USD',
        };
      });

      await apiFetch('/api/shows', {
        method: 'POST',
        body: JSON.stringify({
          venueId,
          title,
          description,
          category,
          startTime: startTime || new Date(Date.now() + 86400000 * 7).toISOString(),
          endTime: endTime || new Date(Date.now() + 86400000 * 7 + 7200000).toISOString(),
          bannerImageUrl: bannerImageUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop',
          holdDurationMinutes: 10,
          offerDurationMinutes: 15,
          isPublished: true,
          pricing,
        }),
      });

      setFeedback('Show published successfully! Live seating grid generated.');
      setTitle('');
      setDescription('');
      loadOrganiserData();
      setActiveTab('shows');
    } catch (err: any) {
      alert(`Show creation error: ${err.message}`);
    }
  };

  return (
    <div id="organiser-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-800">
            Organiser Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Live Events & Revenue Analytics
          </h1>
        </div>

        <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('shows')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'shows' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            My Shows
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'create' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            + Create New Show
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Shows List */}
      {activeTab === 'shows' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shows.map((show) => (
            <div key={show.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="text-cyan-400 font-bold uppercase">{show.category}</span>
                  <span>{new Date(show.startTime).toLocaleDateString()}</span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">{show.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{show.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => loadRevenue(show.id)}
                  className="px-3.5 py-2 rounded-xl bg-purple-950/80 border border-purple-800 hover:bg-purple-900 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> View Revenue & Occupancy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Report Tab */}
      {activeTab === 'revenue' && revenueSummary && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs text-purple-400 font-bold uppercase">Real-Time Financial Audit</span>
              <h2 className="text-2xl font-extrabold text-white mt-1">{revenueSummary.title}</h2>
              <div className="text-xs text-slate-400 mt-0.5">{revenueSummary.venueName}</div>
            </div>
            <button
              onClick={() => setActiveTab('shows')}
              className="text-xs text-slate-400 hover:text-white"
            >
              ← Back to Shows
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Gross Revenue</span>
              <div className="text-xl sm:text-2xl font-mono font-extrabold text-emerald-400 mt-1">
                ${(revenueSummary.totalRevenueCents / 100).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Occupancy Rate</span>
              <div className="text-xl sm:text-2xl font-mono font-extrabold text-cyan-400 mt-1">
                {revenueSummary.occupancyPercentage}%
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Seats Sold</span>
              <div className="text-xl sm:text-2xl font-mono font-extrabold text-white mt-1">
                {revenueSummary.bookedSeats} / {revenueSummary.totalSeats}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Active Holds</span>
              <div className="text-xl sm:text-2xl font-mono font-extrabold text-amber-400 mt-1">
                {revenueSummary.heldSeats}
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Category Tier</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Sold / Total</th>
                  <th className="py-3 px-4">Available</th>
                  <th className="py-3 px-4">Waitlist Queue</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {revenueSummary.categoryBreakdown.map((cat) => (
                  <tr key={cat.categoryId} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.colorCode }} />
                      {cat.categoryName}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">${(cat.priceCents / 100).toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono">{cat.bookedSeats} / {cat.totalSeats}</td>
                    <td className="py-3 px-4 font-mono text-cyan-400">{cat.availableSeats}</td>
                    <td className="py-3 px-4">
                      {cat.waitlistCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 font-bold">
                          {cat.waitlistCount} waiting
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right">
                      ${(cat.revenueCents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attendee Bookings List */}
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Confirmed Attendee Bookings ({revenueSummary.bookings?.length || 0})
            </h3>
            {revenueSummary.bookings && revenueSummary.bookings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Booking Ref</th>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Seats Reserved</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {revenueSummary.bookings.map((b: any) => (
                      <tr key={b.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-mono font-bold text-cyan-400">
                          {b.bookingReference}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-white">{b.customerName || 'Anonymous'}</div>
                          <div className="text-[11px] text-slate-400">{b.customerEmail}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(b.seatLabels || []).map((lbl: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">
                                {lbl}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-emerald-400 text-right">
                          ${(b.totalAmountCents / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-center text-slate-500 text-xs">
                No customer bookings recorded for this event yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Show Tab */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateShow} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 max-w-3xl">
          <h2 className="text-xl font-bold text-white">Create & Schedule New Event</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Event Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Symphony of the Spheres Live"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="Concert">Concert</option>
                  <option value="Movie">Movie</option>
                  <option value="Theater">Theater</option>
                  <option value="Festival">Festival</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Venue Layout</label>
                <select
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city}) - Cap: {v.totalCapacity}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Event summary and performer lineup..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            {/* Tier Pricing */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">VIP Tier ($)</label>
                <input
                  type="number"
                  value={vipPrice}
                  onChange={(e) => setVipPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Standard ($)</label>
                <input
                  type="number"
                  value={standardPrice}
                  onChange={(e) => setStandardPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Balcony ($)</label>
                <input
                  type="number"
                  value={balconyPrice}
                  onChange={(e) => setBalconyPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
          >
            Publish Event & Initialize Seating Grid
          </button>
        </form>
      )}
    </div>
  );
};
