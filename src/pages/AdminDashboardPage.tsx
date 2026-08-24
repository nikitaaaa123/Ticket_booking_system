import React, { useState, useEffect } from 'react';
import { Venue, SeatCategory } from '../types/client.ts';
import { apiFetch } from '../services/api.ts';
import { Layers, Plus, MapPin, Grid, CheckCircle2, AlertCircle } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [categories, setCategories] = useState<SeatCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Venue form
  const [venueName, setVenueName] = useState<string>('');
  const [venueAddress, setVenueAddress] = useState<string>('');
  const [venueCity, setVenueCity] = useState<string>('San Francisco');

  // New Grid row form
  const [rowLabel, setRowLabel] = useState<string>('D');
  const [seatCount, setSeatCount] = useState<number>(12);
  const [selectedCatId, setSelectedCatId] = useState<string>('');

  const loadVenues = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ venues: Venue[] }>('/api/venues');
      setVenues(res.venues || []);
      if (res.venues && res.venues.length > 0 && !selectedVenue) {
        loadVenueDetails(res.venues[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVenueDetails = async (vId: string) => {
    try {
      const res = await apiFetch<{ venue: Venue; categories: SeatCategory[] }>(`/api/venues/${vId}`);
      const cats = res.categories || (res.venue as any)?.categories || [];
      setSelectedVenue(res.venue);
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCatId(cats[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadVenues();
  }, []);

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ venue: Venue }>('/api/venues', {
        method: 'POST',
        body: JSON.stringify({
          name: venueName,
          address: venueAddress,
          city: venueCity,
          categories: [
            { name: 'VIP Front', colorCode: '#F59E0B' },
            { name: 'Standard Orchestra', colorCode: '#3B82F6' },
            { name: 'Balcony', colorCode: '#10B981' },
          ],
        }),
      });

      setFeedback(`Venue "${res.venue.name}" created! Now configure its seat rows below.`);
      setVenueName('');
      setVenueAddress('');
      loadVenues();
      loadVenueDetails(res.venue.id);
    } catch (err: any) {
      alert(`Error creating venue: ${err.message}`);
    }
  };

  const handleAddGridRows = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenue || !selectedCatId) return;

    try {
      await apiFetch(`/api/venues/${selectedVenue.id}/seats/grid`, {
        method: 'POST',
        body: JSON.stringify({
          rows: [
            {
              rowLabel: rowLabel.toUpperCase(),
              categoryId: selectedCatId,
              seatCount: Number(seatCount),
              startNumber: 1,
            },
          ],
        }),
      });

      setFeedback(`Row ${rowLabel.toUpperCase()} with ${seatCount} seats successfully added to ${selectedVenue.name}.`);
      loadVenueDetails(selectedVenue.id);
    } catch (err: any) {
      alert(`Seat grid addition error: ${err.message}`);
    }
  };

  return (
    <div id="admin-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-800">
          Super Admin Console
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Venue Architecture & Seating Layout Studio
        </h1>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">&times;</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Create Venue Form */}
        <form onSubmit={handleCreateVenue} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-400" /> Create Physical Venue
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Venue Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Paramount Theater"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Street Address</label>
              <input
                type="text"
                required
                placeholder="e.g. 1028 Market St"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
              <input
                type="text"
                required
                placeholder="e.g. San Francisco"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
          >
            Provision Venue & Default Tiers
          </button>
        </form>

        {/* Right Column: Seat Grid Layout Builder */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Grid className="w-5 h-5 text-cyan-400" /> Append Seat Rows to Layout
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Venue</label>
              <select
                value={selectedVenue?.id || ''}
                onChange={(e) => loadVenueDetails(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.city}) - Capacity: {v.totalCapacity}
                  </option>
                ))}
              </select>
            </div>

            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Seating Tier / Category</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Row Label (e.g. E, F, G)</label>
                <input
                  type="text"
                  maxLength={2}
                  required
                  value={rowLabel}
                  onChange={(e) => setRowLabel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Seat Count</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={seatCount}
                  onChange={(e) => setSeatCount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddGridRows}
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
          >
            Insert Row into Venue Layout
          </button>
        </div>
      </div>
    </div>
  );
};
