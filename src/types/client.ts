export type UserRole = 'CUSTOMER' | 'ORGANISER' | 'ADMIN';
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'REFUNDED';
export type WaitlistStatus = 'WAITING' | 'OFFERED' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'DECLINED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  totalCapacity: number;
}

export interface SeatCategory {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  colorCode: string;
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
  venue?: Venue;
  pricing?: ShowPricing[];
  totalSeats?: number;
  availableSeats?: number;
  minPriceCents?: number;
}

export interface ShowSeatDetail {
  id: string;
  showId: string;
  seatId: string;
  categoryId: string;
  categoryName: string;
  colorCode: string;
  rowLabel: string;
  seatNumber: number;
  gridRow: number;
  gridCol: number;
  isAccessible: boolean;
  status: SeatStatus;
  priceCents: number;
  currency: string;
  heldByUserId?: string | null;
  holdExpiresAt?: string | null;
  holdSessionToken?: string | null;
}

export interface CategorySummary {
  id: string;
  name: string;
  colorCode: string;
  priceCents: number;
  currency: string;
  totalSeats: number;
  availableSeats: number;
  heldSeats: number;
  bookedSeats: number;
  isSoldOut: boolean;
  waitlistCount?: number;
  userWaitlistPosition?: number | null;
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
  showTitle?: string;
  showStartTime?: string;
  venueName?: string;
  customerEmail?: string;
  customerName?: string;
  status: BookingStatus;
  totalAmountCents: number;
  currency: string;
  qrCodeDataURL?: string;
  items: BookingItem[];
  emailDelivery?: {
    sent: boolean;
    message: string;
    statusCode?: number;
    error?: string;
  };
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  confirmedAt?: string;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  showId: string;
  showTitle?: string;
  showStartTime?: string;
  venueName?: string;
  categoryId: string;
  categoryName?: string;
  colorCode?: string;
  userId: string;
  customerEmail?: string;
  customerName?: string;
  requestedSeatsCount: number;
  status: WaitlistStatus;
  priorityOrder: number;
  queuePosition?: number | null;
  activeOfferToken?: string | null;
  activeOfferExpiresAt?: string | null;
  createdAt: string;
}

export interface WaitlistOfferDetails {
  id: string;
  offerToken: string;
  showId: string;
  showTitle: string;
  venueName: string;
  venueAddress: string;
  startTime: string;
  seatId: string;
  seatLabel: string;
  categoryId: string;
  categoryName: string;
  priceCents: number;
  priceFormatted: string;
  expiresAt: string;
  remainingSeconds: number;
  status: OfferStatus;
  customerEmail?: string;
  customerName?: string;
}

export interface ShowRevenueSummary {
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
