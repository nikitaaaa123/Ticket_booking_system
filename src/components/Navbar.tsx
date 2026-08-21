import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Ticket,
  User,
  LogOut,
  Calendar,
  Layers,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  Clock,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout, switchDemoUser } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('browse')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              VELOCITY <span className="text-cyan-400 font-mono text-xs px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">PASS</span>
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => onSelectTab('browse')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              currentTab === 'browse'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Events
          </button>

          {user && (
            <button
              onClick={() => onSelectTab('history')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'history'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              My Bookings & Waitlist
            </button>
          )}

          {(user?.role === 'ORGANISER' || user?.role === 'ADMIN') && (
            <button
              onClick={() => onSelectTab('organiser')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'organiser'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Organiser Hub
            </button>
          )}

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                currentTab === 'admin'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Admin Studio
            </button>
          )}
        </nav>

        {/* User Profile & Demo Switcher */}
        <div className="flex items-center gap-3">
          {/* Fast Role Switcher for instant evaluator testing */}
          <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-[11px]">
            <span className="px-2 text-slate-500 font-mono text-[10px] uppercase">Simulate:</span>
            <button
              onClick={() => switchDemoUser('CUSTOMER')}
              className={`px-2 py-1 rounded transition-colors ${
                user?.role === 'CUSTOMER' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Customer
            </button>
            <button
              onClick={() => switchDemoUser('ORGANISER')}
              className={`px-2 py-1 rounded transition-colors ${
                user?.role === 'ORGANISER' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Organiser
            </button>
            <button
              onClick={() => switchDemoUser('ADMIN')}
              className={`px-2 py-1 rounded transition-colors ${
                user?.role === 'ADMIN' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">{user.fullName}</div>
                <div className="text-[10px] text-cyan-400 font-mono">{user.role}</div>
              </div>
              <button
                onClick={logout}
                title="Log out"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSelectTab('auth')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-colors"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
