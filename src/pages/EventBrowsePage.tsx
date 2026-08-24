import React, { useState, useEffect } from 'react';
import { Show } from '../types/client.ts';
import { apiFetch } from '../services/api.ts';
import { Search, Calendar, MapPin, Ticket, Sparkles, Filter, Users } from 'lucide-react';

interface EventBrowsePageProps {
  onSelectShow: (showId: string) => void;
}

export const EventBrowsePage: React.FC<EventBrowsePageProps> = ({ onSelectShow }) => {
  const [shows, setShows] = useState<Show[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShows() {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (selectedCategory !== 'ALL') queryParams.append('category', selectedCategory);
        if (searchQuery) queryParams.append('search', searchQuery);

        const data = await apiFetch<{ shows: Show[]; total: number }>(
          `/api/shows?${queryParams.toString()}`
        );
        setShows(data.shows || []);

        // Extract distinct categories
        const distinct = Array.from(
          new Set((data.shows || []).map((s) => s.category).filter(Boolean))
        );
        setCategories(['ALL', ...distinct]);
      } catch (err: any) {
        setError(err.message || 'Failed to load events.');
      } finally {
        setIsLoading(false);
      }
    }

    const timer = setTimeout(loadShows, 150);
    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery]);

  return (
    <div id="event-browse-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 p-8 sm:p-12 mb-10">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" /> High-Concurrency Real-Time Ticketing
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Reserve Your Live Experience with Microsecond Precision.
          </h1>
          <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
            Live interactive seat map, atomic 10-minute hold reservation locks, automated waitlist reallocation, and instant QR gate passes.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-8 relative z-10 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search movie, concert, or festival title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'Movie', 'Concert', 'Theater'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          Featured Experiences <span className="text-xs text-slate-500 font-normal">({shows.length} available)</span>
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-slate-900/60 border border-slate-800" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-slate-900 border border-rose-800/40 rounded-2xl text-rose-300 text-sm">
          {error}
        </div>
      ) : shows.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400">
          No shows matching your search criteria. Try modifying your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shows.map((show) => {
            const formattedDate = new Date(show.startTime).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });

            const isSoldOut = show.availableSeats === 0;

            return (
              <div
                key={show.id}
                onClick={() => onSelectShow(show.id)}
                className="group flex flex-col bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-1"
              >
                {/* Banner Thumbnail */}
                <div className="relative h-48 w-full bg-slate-950 overflow-hidden">
                  <img
                    src={
                      show.bannerImageUrl ||
                      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop'
                    }
                    alt={show.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                  {/* Badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-950/80 backdrop-blur-md text-cyan-400 border border-cyan-800/60">
                      {show.category}
                    </span>
                    {isSoldOut && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-950/90 text-amber-300 border border-amber-800">
                        Waitlist Only
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                      {show.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {show.description || 'Experience this world-class live performance.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{show.venue?.name || 'Grand Stage Theater'}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Starting from</span>
                        <span className="text-base font-extrabold text-white">
                          ${((show.minPriceCents || 2500) / 100).toFixed(2)}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-blue-600 group-hover:bg-cyan-500 text-white group-hover:text-slate-950 text-xs font-bold transition-all shadow-md"
                      >
                        {isSoldOut ? 'Join Waitlist' : 'Select Seats →'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
