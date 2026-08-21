-- =============================================================================
-- Ticket Booking System - Database Schema (PostgreSQL DDL)
-- Complete schema supporting Seat Holds, TTL expiry, Concurrency Protection,
-- Waitlist FIFO queues, and Booking QR verification.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ORGANISER', 'ADMIN');
CREATE TYPE seat_status AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');
CREATE TYPE booking_status AS ENUM ('CONFIRMED', 'CANCELLED', 'REFUNDED');
CREATE TYPE waitlist_status AS ENUM ('WAITING', 'OFFERED', 'CONVERTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE offer_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'DECLINED');

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- -----------------------------------------------------------------------------
-- 2. VENUES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    total_capacity INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. SEAT CATEGORIES TABLE (e.g. VIP, Premium, Standard, Balcony)
-- -----------------------------------------------------------------------------
CREATE TABLE seat_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(10) NOT NULL DEFAULT '#3B82F6', -- Hex color for visual seat map
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_venue_category UNIQUE (venue_id, name)
);

CREATE INDEX idx_seat_categories_venue ON seat_categories(venue_id);

-- -----------------------------------------------------------------------------
-- 4. SEATS TABLE (Physical layout inside a venue)
-- -----------------------------------------------------------------------------
CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE RESTRICT,
    row_label VARCHAR(10) NOT NULL,      -- e.g. "A", "B", "VIP-1"
    seat_number INT NOT NULL,            -- e.g. 1, 2, 3...
    grid_row INT NOT NULL,               -- Visual UI coordinate Y
    grid_col INT NOT NULL,               -- Visual UI coordinate X
    is_accessible BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_venue_row_seat UNIQUE (venue_id, row_label, seat_number)
);

CREATE INDEX idx_seats_venue ON seats(venue_id);
CREATE INDEX idx_seats_category ON seats(category_id);

-- -----------------------------------------------------------------------------
-- 5. SHOWS / EVENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE shows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    organiser_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    banner_image_url TEXT,
    category VARCHAR(100) NOT NULL, -- e.g. 'Movie', 'Concert', 'Theater'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    hold_duration_minutes INT NOT NULL DEFAULT 10,  -- Configurable hold TTL (default 10 mins)
    offer_duration_minutes INT NOT NULL DEFAULT 15, -- Waitlist offer TTL (default 15 mins)
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shows_venue ON shows(venue_id);
CREATE INDEX idx_shows_organiser ON shows(organiser_id);
CREATE INDEX idx_shows_start_time ON shows(start_time);

-- -----------------------------------------------------------------------------
-- 6. SHOW PRICING (Per category pricing per show)
-- -----------------------------------------------------------------------------
CREATE TABLE show_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE CASCADE,
    price_cents INT NOT NULL CHECK (price_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    CONSTRAINT uq_show_category_pricing UNIQUE (show_id, category_id)
);

CREATE INDEX idx_show_pricing_show ON show_pricing(show_id);

-- -----------------------------------------------------------------------------
-- 7. SHOW SEATS TABLE (Per-show seat status, holding, and concurrency locking)
-- -----------------------------------------------------------------------------
CREATE TABLE show_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE RESTRICT,
    status seat_status NOT NULL DEFAULT 'AVAILABLE',
    
    -- Seat Hold tracking
    held_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    hold_expires_at TIMESTAMPTZ,
    hold_session_token VARCHAR(255), -- Secure token generated for customer's checkout session
    
    -- Optimistic Concurrency / Invalidation Version
    version INT NOT NULL DEFAULT 1,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_show_seat UNIQUE (show_id, seat_id)
);

-- CRITICAL PERFORMANCE & CONCURRENCY INDEXES:
-- 1. Index for fast seat map rendering per show
CREATE INDEX idx_show_seats_show_status ON show_seats(show_id, status);
-- 2. Fast background TTL sweep for expired holds
CREATE INDEX idx_show_seats_held_expiry ON show_seats(status, hold_expires_at) WHERE status = 'HELD';
-- 3. Fast lookup during checkout verification and release
CREATE INDEX idx_show_seats_held_user ON show_seats(show_id, held_by_user_id);
-- 4. Category-level availability count for waitlist trigger
CREATE INDEX idx_show_seats_show_cat_status ON show_seats(show_id, category_id, status);

-- -----------------------------------------------------------------------------
-- 8. BOOKINGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_reference VARCHAR(32) NOT NULL UNIQUE, -- e.g. "TKT-2026-X9K2LA"
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
    status booking_status NOT NULL DEFAULT 'CONFIRMED',
    total_amount_cents INT NOT NULL CHECK (total_amount_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'REFUNDED'
    payment_reference VARCHAR(255),
    qr_code_data TEXT NOT NULL,         -- Payload string or data URL for ticket verification
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_show ON bookings(show_id);
CREATE INDEX idx_bookings_reference ON bookings(booking_reference);

-- -----------------------------------------------------------------------------
-- 9. BOOKING SEATS (Link table between Booking and ShowSeats)
-- -----------------------------------------------------------------------------
CREATE TABLE booking_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE RESTRICT,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE RESTRICT,
    price_paid_cents INT NOT NULL,
    seat_row_label VARCHAR(10) NOT NULL,
    seat_number INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_booking_show_seat UNIQUE (booking_id, show_seat_id)
);

CREATE INDEX idx_booking_seats_booking ON booking_seats(booking_id);
CREATE INDEX idx_booking_seats_show_seat ON booking_seats(show_seat_id);

-- -----------------------------------------------------------------------------
-- 10. WAITLIST TABLE (FIFO Queue per Show and Seat Category)
-- -----------------------------------------------------------------------------
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES seat_categories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_seats_count INT NOT NULL DEFAULT 1,
    status waitlist_status NOT NULL DEFAULT 'WAITING',
    priority_order SERIAL, -- Auto-incrementing priority guarantees strict FIFO ordering
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_show_cat_user_active_waitlist UNIQUE (show_id, category_id, user_id)
);

CREATE INDEX idx_waitlist_fifo_queue ON waitlist(show_id, category_id, status, priority_order ASC);
CREATE INDEX idx_waitlist_user ON waitlist(user_id);

-- -----------------------------------------------------------------------------
-- 11. WAITLIST OFFERS TABLE (Time-limited reservation offered on cancellation)
-- -----------------------------------------------------------------------------
CREATE TABLE waitlist_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    waitlist_id UUID NOT NULL REFERENCES waitlist(id) ON DELETE CASCADE,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offer_token VARCHAR(255) NOT NULL UNIQUE,
    status offer_status NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    offered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ,
    CONSTRAINT uq_offer_show_seat_pending UNIQUE (show_seat_id, status)
);

CREATE INDEX idx_waitlist_offers_token ON waitlist_offers(offer_token);
CREATE INDEX idx_waitlist_offers_expiry ON waitlist_offers(status, expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_waitlist_offers_user ON waitlist_offers(user_id);
