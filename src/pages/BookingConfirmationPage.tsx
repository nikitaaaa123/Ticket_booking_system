import React from 'react';
import { Booking } from '../types/client.ts';
import {
  CheckCircle,
  QrCode,
  Calendar,
  MapPin,
  Mail,
  Download,
  ArrowRight,
  Ticket,
  Printer,
  Sparkles,
} from 'lucide-react';

interface BookingConfirmationPageProps {
  booking: Booking;
  onViewHistory: () => void;
  onExploreMore: () => void;
}

export const BookingConfirmationPage: React.FC<BookingConfirmationPageProps> = ({
  booking,
  onViewHistory,
  onExploreMore,
}) => {
  const formattedConfirmedDate = booking.confirmedAt
    ? new Date(booking.confirmedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString();

  return (
    <div id="booking-confirmation-page" className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Success Badge */}
      <div className="text-center space-y-3 mb-8">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
          <CheckCircle className="w-9 h-9" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Order Confirmed & Guaranteed
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          You're Going Live!
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          We have sent your confirmation receipt and digital gate passes to{' '}
          <strong className="text-white">{booking.customerEmail}</strong>.
        </p>
      </div>

      {/* Digital Ticket Pass Card */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Top Ticket Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-6 sm:p-8 text-white border-b border-indigo-800/60">
          <div className="flex items-center justify-between text-xs text-indigo-300 font-mono mb-2">
            <span>OFFICIAL ADMISSION PASS</span>
            <span>REF: {booking.bookingReference}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {booking.showTitle || 'Event Performance'}
          </h2>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-indigo-200">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>
                {booking.showStartTime
                  ? new Date(booking.showStartTime).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Showtime Confirmed'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>{booking.venueName || 'Main Stage Venue'}</span>
            </div>
          </div>
        </div>

        {/* Ticket Perforation Notch Decor */}
        <div className="relative h-6 bg-slate-900 flex items-center justify-between px-[-12px]">
          <div className="w-6 h-6 rounded-full bg-slate-950 -ml-3" />
          <div className="flex-1 border-t-2 border-dashed border-slate-800 mx-3" />
          <div className="w-6 h-6 rounded-full bg-slate-950 -mr-3" />
        </div>

        {/* Bottom Ticket Body with QR Code */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Left info */}
          <div className="space-y-4 flex-1 text-center sm:text-left">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Assigned Seats
              </span>
              <div className="text-base font-extrabold text-white mt-0.5">
                {booking.items && booking.items.length > 0
                  ? booking.items.map((i) => i.seatLabel).join(', ')
                  : 'Standard Admission'}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Ticket Holder
              </span>
              <div className="text-sm font-semibold text-slate-200">
                {booking.customerName || 'Valued Guest'}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Total Paid
              </span>
              <div className="text-sm font-mono font-bold text-cyan-400">
                ${(booking.totalAmountCents / 100).toFixed(2)} {booking.currency}
              </div>
            </div>
          </div>

          {/* Right QR Code Box */}
          <div className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-lg">
            {booking.qrCodeDataURL ? (
              <img
                src={booking.qrCodeDataURL}
                alt="Ticket Entry QR Code"
                className="w-36 h-36 object-contain"
              />
            ) : (
              <div className="w-36 h-36 bg-slate-100 flex items-center justify-center text-slate-400">
                <QrCode className="w-20 h-20" />
              </div>
            )}
            <span className="text-[10px] font-mono font-bold text-slate-800 mt-2">
              Scan at Venue Gate
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          onClick={onViewHistory}
          className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
        >
          <Ticket className="w-4 h-4 text-cyan-400" /> View All My Bookings
        </button>

        <button
          onClick={onExploreMore}
          className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
        >
          Browse More Events <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
