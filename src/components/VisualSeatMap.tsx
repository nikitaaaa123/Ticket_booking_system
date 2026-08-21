import React, { useMemo } from 'react';
import { ShowSeatDetail, CategorySummary } from '../types/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSeatMapWebSocket } from '../hooks/useSeatMapWebSocket.ts';
import { Radio, Users, Sparkles, CheckCircle, Clock } from 'lucide-react';

interface VisualSeatMapProps {
  showId: string;
  seats: ShowSeatDetail[];
  categories: CategorySummary[];
  selectedSeatIds: string[];
  onToggleSeat: (seat: ShowSeatDetail) => void;
  onRefresh: () => void;
}

export const VisualSeatMap: React.FC<VisualSeatMapProps> = ({
  showId,
  seats,
  categories,
  selectedSeatIds,
  onToggleSeat,
  onRefresh,
}) => {
  const { user, guestUserId } = useAuth();
  const currentUserId = user?.id || guestUserId;

  // Real-time WebSocket connection
  const { isConnected, lastEvent } = useSeatMapWebSocket({
    showId,
    onRefreshNeeded: () => {
      onRefresh();
    },
  });

  // Calculate layout grid metrics
  const { rowLabels, maxCols, rowsGrouped } = useMemo(() => {
    const rowsMap = new Map<string, ShowSeatDetail[]>();
    let maxCol = 0;

    seats.forEach((seat) => {
      const rowArr = rowsMap.get(seat.rowLabel) || [];
      rowArr.push(seat);
      rowsMap.set(seat.rowLabel, rowArr);
      if (seat.seatNumber > maxCol) maxCol = seat.seatNumber;
    });

    // Sort rows alphabetically (A, B, C...)
    const sortedRowKeys = Array.from(rowsMap.keys()).sort();

    // Sort seats inside each row by seat number
    sortedRowKeys.forEach((key) => {
      const sorted = rowsMap.get(key)!.sort((a, b) => a.seatNumber - b.seatNumber);
      rowsMap.set(key, sorted);
    });

    return {
      rowLabels: sortedRowKeys,
      maxCols: maxCol,
      rowsGrouped: rowsMap,
    };
  }, [seats]);

  // Color helper based on state
  const getSeatVisualState = (seat: ShowSeatDetail) => {
    const isSelected = selectedSeatIds.includes(seat.id);
    const isHeldByMe = seat.status === 'HELD' && seat.heldByUserId === currentUserId;
    const isHeldByOther = seat.status === 'HELD' && seat.heldByUserId !== currentUserId;
    const isBooked = seat.status === 'BOOKED';

    if (isSelected || isHeldByMe) {
      return {
        bg: 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30 scale-105 ring-2 ring-emerald-400',
        label: 'Selected by you',
        clickable: true,
      };
    }

    if (isBooked) {
      return {
        bg: 'bg-slate-800/80 border-slate-700 text-slate-500 cursor-not-allowed opacity-60',
        label: 'Booked / Unavailable',
        clickable: false,
      };
    }

    if (isHeldByOther) {
      return {
        bg: 'bg-amber-500/20 border-amber-500/50 text-amber-300 cursor-not-allowed animate-pulse',
        label: 'Held by another buyer',
        clickable: false,
      };
    }

    // Available -> Color coded by tier/category
    return {
      bg: 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200 hover:border-slate-400 hover:scale-105 cursor-pointer',
      label: `Available ($${(seat.priceCents / 100).toFixed(2)})`,
      clickable: true,
    };
  };

  return (
    <div id="visual-seat-map-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col items-center">
      {/* Top Header & Live WebSocket Status */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isConnected ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-amber-950/80 text-amber-400 border border-amber-800'
          }`}>
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
            {isConnected ? 'LIVE SEAT FEED CONNECTED' : 'CONNECTING LIVE FEED...'}
          </div>
          {lastEvent && (
            <span className="text-xs text-slate-400">
              Updated just now
            </span>
          )}
        </div>

        {/* Categories Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-700 border border-slate-500 inline-block" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 border border-emerald-400 inline-block" />
            <span>Your Selection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-500/30 border border-amber-500 inline-block" />
            <span>Held (Other)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-800 border border-slate-700 inline-block" />
            <span>Sold Out</span>
          </div>
        </div>
      </div>

      {/* Curved Screen / Stage Indicator */}
      <div className="w-full max-w-2xl my-8 flex flex-col items-center">
        <div className="w-full h-3.5 rounded-t-full bg-gradient-to-r from-blue-500/20 via-cyan-400 to-blue-500/20 shadow-lg shadow-cyan-500/20 border-t-2 border-cyan-400/80" />
        <span className="mt-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
          STAGE / SCREEN
        </span>
      </div>

      {/* Seat Grid Layout */}
      <div className="w-full overflow-x-auto py-4 flex justify-center">
        <div className="min-w-fit flex flex-col gap-3">
          {rowLabels.map((rowLabel) => {
            const rowSeats = rowsGrouped.get(rowLabel) || [];

            return (
              <div key={rowLabel} className="flex items-center gap-2 sm:gap-3">
                {/* Left Row Label */}
                <span className="w-6 text-center font-mono font-bold text-xs text-slate-400">
                  {rowLabel}
                </span>

                {/* Seat Items in Row */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {rowSeats.map((seat, index) => {
                    const visual = getSeatVisualState(seat);
                    const isSelected = selectedSeatIds.includes(seat.id);

                    // Optional aisle spacing if wide venue
                    const isAisle = index === Math.floor(rowSeats.length / 2);

                    return (
                      <React.Fragment key={seat.id}>
                        {isAisle && <div className="w-4 sm:w-6" />}
                        <button
                          id={`seat-btn-${seat.rowLabel}-${seat.seatNumber}`}
                          type="button"
                          disabled={!visual.clickable}
                          onClick={() => onToggleSeat(seat)}
                          title={`Row ${seat.rowLabel}-${seat.seatNumber} (${seat.categoryName}) - ${visual.label}`}
                          style={{
                            borderColor: !isSelected && seat.status === 'AVAILABLE' ? seat.colorCode : undefined,
                          }}
                          className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg border text-xs font-bold transition-all duration-150 flex items-center justify-center ${visual.bg}`}
                        >
                          {seat.seatNumber}

                          {/* Category Dot Tag */}
                          {seat.status === 'AVAILABLE' && !isSelected && (
                            <span
                              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900"
                              style={{ backgroundColor: seat.colorCode }}
                            />
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Right Row Label */}
                <span className="w-6 text-center font-mono font-bold text-xs text-slate-400">
                  {rowLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Price Tags */}
      <div className="w-full mt-8 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60"
          >
            <span
              className="w-3.5 h-3.5 rounded-md flex-shrink-0"
              style={{ backgroundColor: cat.colorCode }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{cat.name}</div>
              <div className="text-xs text-slate-400">
                ${(cat.priceCents / 100).toFixed(2)} &bull; {cat.availableSeats} left
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
