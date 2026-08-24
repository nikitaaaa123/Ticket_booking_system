import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/client.ts';
import { apiFetch } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  guestUserId: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, role?: 'CUSTOMER' | 'ORGANISER' | 'ADMIN') => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  switchDemoUser: (role: 'CUSTOMER' | 'ORGANISER' | 'ADMIN') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('tbs_token') || localStorage.getItem('tbs_token'));
  const [guestUserId] = useState<string>(() => {
    const existing = sessionStorage.getItem('tbs_guest_id');
    if (existing) return existing;
    const newGuest = `guest_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('tbs_guest_id', newGuest);
    return newGuest;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate and load profile on mount if token exists
  useEffect(() => {
    async function loadProfile() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await apiFetch<{ user: User }>('/api/auth/me', { token });
        setUser(res.user);
      } catch (err) {
        console.warn('Session expired or invalid token:', err);
        localStorage.removeItem('tbs_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    sessionStorage.setItem('tbs_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    role: 'CUSTOMER' | 'ORGANISER' | 'ADMIN' = 'CUSTOMER'
  ) => {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, role }),
    });
    sessionStorage.setItem('tbs_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    sessionStorage.removeItem('tbs_token');
    localStorage.removeItem('tbs_token');
    setToken(null);
    setUser(null);
  };

  // Fast demo role switcher
  const switchDemoUser = async (role: 'CUSTOMER' | 'ORGANISER' | 'ADMIN') => {
    const demoCredentials = {
      CUSTOMER: { email: 'customer@ticketbooking.com', pass: 'Password123!', name: 'Demo Customer' },
      ORGANISER: { email: 'organiser@ticketbooking.com', pass: 'Password123!', name: 'Demo Organiser' },
      ADMIN: { email: 'admin@ticketbooking.com', pass: 'Password123!', name: 'Demo Admin' },
    };
    const creds = demoCredentials[role];
    try {
      await login(creds.email, creds.pass);
    } catch {
      // If user doesn't exist, register on the fly
      await register(creds.email, creds.pass, creds.name || `Demo ${role}`, role);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        guestUserId,
        login,
        register,
        logout,
        isLoading,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
