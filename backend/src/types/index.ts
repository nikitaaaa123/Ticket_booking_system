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

export interface UserJWTPayload {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
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
}

export interface BookingItem {
  id: string;
  bookingId: string;
  showSeatId: string;
  seatLabel: string;
  categoryId: string;
  priceCents: number;
}

export interface Booking {
  id: string;
  bookingReference: string;
  userId: string;
  showId: string;
  customerEmail?: string;
  customerName?: string;
  status: BookingStatus;
  totalAmountCents: number;
  currency: string;
  paymentStatus?: string;
  paymentReference?: string;
  qrCodeDataURL?: string;
  qrCodeData?: string;
  items: BookingItem[];
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistEntry {
  id: string;
  showId: string;
  categoryId: string;
  userId: string;
  customerEmail?: string;
  customerName?: string;
  requestedSeatsCount: number;
  status: WaitlistStatus;
  priorityOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistOffer {
  id: string;
  waitlistId: string;
  showId: string;
  showSeatId: string;
  userId: string;
  customerEmail?: string;
  customerName?: string;
  offerToken: string;
  status: OfferStatus;
  expiresAt: string;
  offeredAt: string;
  respondedAt?: string | null;
}

// Request & Response DTOs
export interface RegisterRequestDTO {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role?: UserRole;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
}

export interface CreateVenueRequestDTO {
  name: string;
  address: string;
  city: string;
  categories?: {
    name: string;
    description?: string;
    colorCode: string;
  }[];
}

export interface CreateCategoryRequestDTO {
  name: string;
  description?: string;
  colorCode: string;
}

export interface DefineSeatGridRequestDTO {
  rows: {
    rowLabel: string;
    categoryId: string;
    seatCount: number;
    startNumber?: number;
    accessibleSeatNumbers?: number[];
  }[];
}

export interface CreateShowRequestDTO {
  venueId: string;
  title: string;
  description?: string;
  bannerImageUrl?: string;
  category: string;
  startTime: string;
  endTime: string;
  holdDurationMinutes?: number;
  offerDurationMinutes?: number;
  isPublished?: boolean;
  pricing: {
    categoryId: string;
    priceCents: number;
    currency?: string;
  }[];
}

export interface UpdateShowRequestDTO {
  title?: string;
  description?: string;
  bannerImageUrl?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  holdDurationMinutes?: number;
  offerDurationMinutes?: number;
  isPublished?: boolean;
  pricing?: {
    categoryId: string;
    priceCents: number;
    currency?: string;
  }[];
}

export interface ShowRevenueSummaryDTO {
  showId: string;
  title: string;
  startTime: string;
  venueName: string;
  totalSeats: number;
  availableSeats: number;
  heldSeats: number;
  bookedSeats: number;
  totalBookings: number;
  totalRevenueCents: number;
  currency: string;
  occupancyPercentage: number;
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    colorCode: string;
    priceCents: number;
    totalSeats: number;
    bookedSeats: number;
    heldSeats: number;
    availableSeats: number;
    revenueCents: number;
    waitlistCount: number;
  }[];
}

export type RealtimeSeatEventType = 'SEAT_HELD' | 'SEAT_RELEASED' | 'SEAT_BOOKED' | 'WAITLIST_OFFER';

export interface RealtimeSeatEvent {
  type: RealtimeSeatEventType | string;
  showId: string;
  seatIds?: string[];
  heldByUserId?: string;
  expiresAt?: string;
  reason?: string;
  timestamp?: string;
}

export interface ConfirmBookingRequestDTO {
  showId: string;
  seatIds: string[];
  holdSessionToken?: string;
  customerEmail?: string;
  customerName?: string;
  guestUserId?: string;
}

export interface CancelBookingRequestDTO {
  bookingId: string;
  reason?: string;
}

export interface JoinWaitlistRequestDTO {
  showId: string;
  categoryId: string;
  requestedSeatsCount?: number;
  customerEmail?: string;
  customerName?: string;
  guestUserId?: string;
}

export interface AcceptOfferRequestDTO {
  customerEmail?: string;
  customerName?: string;
}

export interface DeclineOfferRequestDTO {
  reason?: string;
}



