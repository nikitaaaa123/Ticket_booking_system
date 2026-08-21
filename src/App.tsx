import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { SeatMapProvider } from './context/SeatMapContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { EventBrowsePage } from './pages/EventBrowsePage.tsx';
import { EventDetailPage } from './pages/EventDetailPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { BookingConfirmationPage } from './pages/BookingConfirmationPage.tsx';
import { BookingHistoryPage } from './pages/BookingHistoryPage.tsx';
import { OrganiserDashboardPage } from './pages/OrganiserDashboardPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { WaitlistOfferClaimPage } from './pages/WaitlistOfferClaimPage.tsx';
import { Booking } from './types/client.ts';

function MainApp() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('browse');
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [claimOfferToken, setClaimOfferToken] = useState<string | null>(null);

  // Parse URL query on mount for direct waitlist claim links (e.g. ?claimOffer=token)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const offerToken = params.get('claimOffer') || params.get('offer');
    if (offerToken) {
      setClaimOfferToken(offerToken);
      setCurrentTab('claim-offer');
    }
  }, []);

  const handleSelectShow = (showId: string) => {
    setSelectedShowId(showId);
    setCurrentTab('detail');
  };

  const handleProceedToCheckout = () => {
    setCurrentTab('checkout');
  };

  const handleBookingSuccess = (booking: Booking) => {
    setConfirmedBooking(booking);
    setCurrentTab('confirmation');
  };

  const handleClaimOffer = (token: string) => {
    setClaimOfferToken(token);
    setCurrentTab('claim-offer');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main App Body */}
      <main className="flex-1">
        {currentTab === 'browse' && (
          <EventBrowsePage onSelectShow={handleSelectShow} />
        )}

        {currentTab === 'detail' && selectedShowId && (
          <EventDetailPage
            showId={selectedShowId}
            onBack={() => setCurrentTab('browse')}
            onProceedToCheckout={handleProceedToCheckout}
          />
        )}

        {currentTab === 'checkout' && (
          <CheckoutPage
            onBack={() => setCurrentTab('detail')}
            onBookingSuccess={handleBookingSuccess}
          />
        )}

        {currentTab === 'confirmation' && confirmedBooking && (
          <BookingConfirmationPage
            booking={confirmedBooking}
            onViewHistory={() => setCurrentTab('history')}
            onExploreMore={() => setCurrentTab('browse')}
          />
        )}

        {currentTab === 'history' && (
          <BookingHistoryPage
            onClaimOffer={handleClaimOffer}
            onExploreEvents={() => setCurrentTab('browse')}
          />
        )}

        {currentTab === 'organiser' && <OrganiserDashboardPage />}

        {currentTab === 'admin' && <AdminDashboardPage />}

        {currentTab === 'auth' && (
          <AuthPage onSuccess={() => setCurrentTab('browse')} />
        )}

        {currentTab === 'claim-offer' && claimOfferToken && (
          <WaitlistOfferClaimPage
            offerToken={claimOfferToken}
            onBookingSuccess={handleBookingSuccess}
            onBackToBrowse={() => setCurrentTab('browse')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white">VELOCITY PASS</span>
            <span>&bull; High-Concurrency Real-Time Ticketing Engine</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>WebSocket Live Feeds</span>
            <span>Atomic 10m TTL Holds</span>
            <span>Automated Waitlist Handover</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SeatMapProvider>
        <MainApp />
      </SeatMapProvider>
    </AuthProvider>
  );
}
