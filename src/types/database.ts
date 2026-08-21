export type UserRole = 'CUSTOMER' | 'ORGANISER' | 'ADMIN';
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'REFUNDED';
export type WaitlistStatus = 'WAITING' | 'OFFERED' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'DECLINED';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  totalCapacity: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeatCategory {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  colorCode: string;
  createdAt: string;
}

export interface Seat {
  id: string;
  venueId: string;
  categoryId: string;
  rowLabel: string;
  seatNumber: number;
  gridRow: number;
  gridCol: number;
  isAccessible: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ShowPricing {
  id: string;
  showId: string;
  categoryId: string;
  priceCents: number;
  currency: string;
}

export interface Show {
  id: string;
  venueId: string;
  organiserId: string;
  title: string;
  description?: string;
  bannerImageUrl?: string;
  category: string;
  startTime: string;
  endTime: string;
  holdDurationMinutes: number;
  offerDurationMinutes: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  venue?: Venue;
  pricing?: (ShowPricing & { categoryName?: string; colorCode?: string })[];
}

export interface ShowSeat {
  id: string;
  showId: string;
  seatId: string;
  categoryId: string;
  status: SeatStatus;
  heldByUserId?: string | null;
  holdExpiresAt?: string | null;
  holdSessionToken?: string | null;
  version: number;
  updatedAt: string;
  seat?: Seat;
  category?: SeatCategory;
  priceCents?: number;
}

export interface BookingSeat {
  id: string;
  bookingId: string;
  showSeatId: string;
  seatId: string;
  pricePaidCents: number;
  seatRowLabel: string;
  seatNumber: number;
  categoryName: string;
}

export interface Booking {
  id: string;
  bookingReference: string;
  userId: string;
  showId: string;
  status: BookingStatus;
  totalAmountCents: number;
  currency: string;
  paymentStatus: string;
  paymentReference?: string;
  qrCodeData: string;
  confirmedAt: string;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  show?: Show;
  seats?: BookingSeat[];
  user?: Pick<User, 'id' | 'email' | 'fullName'>;
}

export interface WaitlistEntry {
  id: string;
  showId: string;
  categoryId: string;
  userId: string;
  requestedSeatsCount: number;
  status: WaitlistStatus;
  priorityOrder: number;
  createdAt: string;
  updatedAt: string;
  category?: SeatCategory;
  user?: Pick<User, 'id' | 'email' | 'fullName'>;
}

export interface WaitlistOffer {
  id: string;
  waitlistId: string;
  showId: string;
  showSeatId: string;
  userId: string;
  offerToken: string;
  status: OfferStatus;
  expiresAt: string;
  offeredAt: string;
  respondedAt?: string | null;
  show?: Show;
  showSeat?: ShowSeat;
}

// WebSocket / Real-time Seat Update Message Schema
export type RealtimeSeatEvent = 
  | { type: 'SEAT_HELD'; showId: string; seatIds: string[]; heldByUserId: string; expiresAt: string }
  | { type: 'SEAT_RELEASED'; showId: string; seatIds: string[] }
  | { type: 'SEAT_BOOKED'; showId: string; seatIds: string[] }
  | { type: 'WAITLIST_OFFER_CREATED'; showId: string; userId: string; offerToken: string; expiresAt: string };
