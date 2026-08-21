# 🎟️ Real-Time Ticket Booking & Concurrency Platform

A full-stack, enterprise-grade ticket booking platform built with **TypeScript**, **Node.js/Express**, **React 19**, and **Tailwind CSS**. The system is engineered to handle extreme traffic surges (ticket drops) with zero double bookings using multi-layered concurrency locks, atomic seat holds with automated TTL sweeps, real-time WebSocket seat sync, dynamic waitlist auto-assignment, and digital QR gate pass delivery.

---

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [Folder Structure](#-folder-structure)
- [Setup & Installation](#-setup--installation)
  - [Prerequisites](#prerequisites)
  - [Local Development Setup](#local-development-setup)
  - [Database Migration & Seeding](#database-migration--seeding)
  - [Running the Test Suite](#running-the-test-suite)
- [Environment Variables (.env.example)](#-environment-variables-envexample)
  - [Backend Configuration](#backend-configuration)
  - [Frontend Configuration](#frontend-configuration)
- [System Architecture & Core Logic](#-system-architecture--core-logic)
  - [1. Seat Hold & TTL Expiration Mechanics](#1-seat-hold--ttl-expiration-mechanics)
  - [2. Waitlist Auto-Assignment & Offer Handover Flow](#2-waitlist-auto-assignment--offer-handover-flow)
- [Database Schema & Data Model](#-database-schema--data-model)
- [Complete API Documentation](#-complete-api-documentation)
  - [Authentication](#authentication-endpoints)
  - [Venues](#venue-endpoints)
  - [Shows & Events](#show--event-endpoints)
  - [Seats & Real-Time Holds](#seat--hold-endpoints)
  - [Bookings & Checkouts](#booking-endpoints)
  - [Waitlist & Offer Management](#waitlist-endpoints)
  - [WebSocket Real-Time Gateway](#websocket-real-time-gateway)
- [Deployment Guide & Checklist](#-deployment-guide--checklist)

---

## 🌟 Project Overview

When high-demand tickets go on sale, thousands of concurrent requests compete for the same physical seats. Traditional web applications often suffer from race conditions resulting in double bookings, orphaned locks, and frustrated users.

This platform solves these challenges through:
1. **Multi-Layered Concurrency Control**: Combines in-memory distributed mutex locks with atomic database row-level locking (`SELECT ... FOR UPDATE`) and optimistic version counters (`version` field) to guarantee that only one transaction can acquire or hold a seat.
2. **Atomic 10-Minute Seat Holds**: Customers reserve selected seats for 10 minutes to complete checkout. An active background cron sweep reclaims abandoned holds every 15 seconds.
3. **Live Seat Map Synchronization**: Real-time WebSockets broadcast seat status changes (`AVAILABLE` ⇄ `HELD` ⇄ `BOOKED`) across all active browser sessions instantaneously.
4. **FIFO Waitlist Auto-Assignment**: When booked seats are cancelled or expired, the system automatically checks the waitlist queue, holds the seat exclusively for the next user, generates a secure 15-minute offer token, and dispatches an email notification.
5. **Instant Offer Handover**: If a waitlist user declines or lets their 15-minute offer expire, the seat cascades immediately to the next person in line.
6. **Digital Admission Passes**: Confirmed bookings generate unique reference codes and cryptographically verifiable QR codes for venue entry scanning.

---

## 🛠️ Tech Stack

### **Backend**
- **Runtime**: Node.js & TypeScript
- **Framework**: Express.js
- **Database & ORM**: PostgreSQL via Prisma ORM
- **Real-Time Communication**: Native WebSockets (`ws`)
- **Security & Cryptography**: JSON Web Tokens (JWT), `bcryptjs`, UUIDv4
- **Ticketing & QR Generation**: `qrcode`
- **Email & Notifications**: Nodemailer (Console / SMTP / Resend drivers)
- **Background Sweeper**: Node.js Interval-based TTL Reaper with optimistic concurrency safety

### **Frontend**
- **Framework**: React 19 (Hooks, Context, State Management)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS v4
- **Animations**: Motion (`motion/react`)
- **Icons**: Lucide React
- **Client Architecture**: Modular single-page application with real-time WebSocket state management, responsive SVG seat map grid, and dynamic role simulation.

---

## 📂 Folder Structure

```
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Prisma ORM models, relations, and indexes
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts            # Typed environment variables & defaults
│   │   ├── controllers/          # Request parsing & HTTP response formatting
│   │   │   ├── auth.controller.ts
│   │   │   ├── bookings.controller.ts
│   │   │   ├── seats.controller.ts
│   │   │   ├── shows.controller.ts
│   │   │   ├── venues.controller.ts
│   │   │   └── waitlist.controller.ts
│   │   ├── db/
│   │   │   ├── prisma.ts         # Prisma client singleton
│   │   │   └── memory-db.ts      # Fast zero-latency storage engine with relational semantics
│   │   ├── jobs/
│   │   │   └── ttl-sweeper.job.ts# Periodic background hold & offer expiration reaper
│   │   ├── middlewares/
│   │   │   └── auth.middleware.ts# JWT authentication & RBAC authorization
│   │   ├── routes/               # Express route definitions
│   │   │   ├── auth.routes.ts
│   │   │   ├── booking.routes.ts
│   │   │   ├── seat.routes.ts
│   │   │   ├── show.routes.ts
│   │   │   ├── venue.routes.ts
│   │   │   └── waitlist.routes.ts
│   │   ├── services/             # Core business logic & transaction boundaries
│   │   │   ├── booking.service.ts
│   │   │   ├── email.service.ts
│   │   │   ├── seat.service.ts
│   │   │   ├── show.service.ts
│   │   │   ├── venue.service.ts
│   │   │   ├── waitlist.service.ts
│   │   │   └── websocket.service.ts
│   │   └── types/                # Backend data models, enums & interfaces
│   └── .env.example              # Backend environment template
├── src/                          # React 19 Frontend Application
│   ├── components/               # Modular UI Components
│   │   ├── AdminStudio.tsx       # Venue & seat grid layout creator
│   │   ├── BookingConfirmation.tsx# QR ticket generator & pass viewer
│   │   ├── BookingHistoryModal.tsx# User orders, active passes, and cancellation
│   │   ├── CheckoutModal.tsx     # Atomic checkout & payment simulation
│   │   ├── EventDiscovery.tsx    # Filterable catalog of upcoming shows
│   │   ├── Navbar.tsx            # Header with role switching (Customer/Organiser/Admin)
│   │   ├── OfferClaimModal.tsx   # 15-minute waitlist offer claim & seat handover
│   │   ├── OrganiserHub.tsx      # Show creation, tier pricing, and sales analytics
│   │   ├── SeatMap.tsx           # Interactive visual seat grid with live holds & categories
│   │   ├── ShowDetails.tsx       # Show overview, pricing tiers, and hold timers
│   │   └── WaitlistModal.tsx     # Sold-out category waitlist registration
│   ├── services/
│   │   └── api.ts                # Axios/Fetch API client & WebSocket connector
│   ├── types.ts                  # Shared frontend TypeScript definitions
│   ├── App.tsx                   # Main state orchestrator & screen router
│   ├── index.css                 # Tailwind CSS v4 styling rules
│   └── main.tsx                  # Vite React entrypoint
├── tests/                        # Automated Concurrency & Lifecycle Test Suite
│   ├── booking-lifecycle.test.ts # Hold -> Confirm -> Cancel -> Pass flow
│   ├── race-condition.test.ts    # 50 concurrent requests competing for 1 seat
│   └── waitlist-lifecycle.test.ts# Sold-out -> Waitlist -> Cancellation -> Offer handover
├── server.ts                     # Unified Express + Vite development and production server
├── vite.config.ts                # Vite build & plugin configuration
└── package.json                  # Dependencies, scripts, and build tasks
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm** or **bun** / **yarn**
- **PostgreSQL**: `v14.0` or higher (optional for local memory mode; required for persistent production databases)

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/ticket-booking-platform.git
   cd ticket-booking-platform
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the project root based on `.env.example`:
   ```bash
   cp backend/.env.example .env
   ```

4. **Start the unified development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

### Database Migration & Seeding

When using a PostgreSQL database:

1. **Set your `DATABASE_URL` in `.env`**:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/ticket_booking_db?schema=public"
   ```

2. **Push schema migrations**:
   ```bash
   npx prisma db push
   # OR generate a named migration:
   npx prisma migrate dev --name init_ticketing_schema
   ```

3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

### Running the Test Suite

The repository includes end-to-end integration and concurrency stress test suites:

```bash
# 1. Stress test: Run 50 concurrent buyers competing for the identical seat simultaneously
npm run test:race

# 2. Test complete booking lifecycle (Hold -> Payment -> Booking -> QR Gate Pass -> Cancellation)
npm run test:booking

# 3. Test automated waitlist allocation & offer handover on seat cancellation
npm run test:waitlist
```

---

## ⚙️ Environment Variables (.env.example)

### Backend Configuration (`backend/.env.example` or root `.env`)

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticket_booking_db?schema=public"

# Authentication & Cryptography
JWT_SECRET="your-super-secret-jwt-signing-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# Public Hostnames & CORS
APP_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"

# Hold & Waitlist Timing Engine
DEFAULT_SEAT_HOLD_TTL_MINUTES=10
DEFAULT_WAITLIST_OFFER_TTL_MINUTES=15
SWEEP_INTERVAL_SECONDS=15

# Email Dispatcher
EMAIL_PROVIDER="console" # Options: 'console' | 'smtp' | 'resend'
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="Ticket Booking System <no-reply@ticketbooking.com>"
RESEND_API_KEY=""
```

### Frontend Configuration (`.env.example`)

```env
# Optional: Set when frontend and backend run on different domains.
# Leave blank when running behind the unified Express/Vite server.
VITE_API_BASE_URL=
VITE_WS_BASE_URL=
```

---

## 🧠 System Architecture & Core Logic

### 1. Seat Hold & TTL Expiration Mechanics

```
User selects seat ──> POST /api/seats/hold
                          │
                          ▼
            [Concurrency Lock Acquired]
                          │
               ┌──────────┴──────────┐
               │ Status == AVAILABLE?│
               └──────────┬──────────┘
                    Yes   │   No ──> Return 409 Conflict ("Seat already held")
                          ▼
        Status = HELD, holdExpiresAt = now() + 10m
        Broadcast SEAT_HELD via WebSocket
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
[Customer Completes Checkout]    [User Abandons / Timeout]
  POST /api/bookings/confirm       Background Sweeper (Every 15s)
  Status = BOOKED                  Detects: now() > holdExpiresAt
  Generate QR Gate Pass            Status = AVAILABLE
  Notify via Email                 Broadcast SEAT_RELEASED
```

- **Holding a Seat**: When a user clicks a seat on the visual map, the client sends a `POST /api/seats/hold` request.
- **Atomic State Transition**: Inside a database transaction or lock wrapper, the system verifies `status === 'AVAILABLE'`. If valid, it writes `status = 'HELD'`, assigns `heldByUserId` (or `holdSessionToken` for guest sessions), and sets `holdExpiresAt = now() + 10 minutes`.
- **WebSocket Broadcast**: The server dispatches a `SEAT_HELD` event to all clients viewing that show so their seat map updates without manual page refreshes.
- **Reaper / TTL Sweeper**: Every 15 seconds, a background job queries all `ShowSeat` records where `status = 'HELD'` and `holdExpiresAt < now()`. Expired seats are reverted to `AVAILABLE` and announced via `SEAT_RELEASED`.

---

### 2. Waitlist Auto-Assignment & Offer Handover Flow

```
Show Category Sold Out ──> User joins FIFO Waitlist (status = WAITING)
                                      │
                 [A Ticket is Cancelled or Released]
                                      │
                                      ▼
                        [Query Next WAITING User]
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │ Found eligible candidate?                         │
            └─────────────────────────┬─────────────────────────┘
                                Yes   │   No ──> Seat returned to general pool
                                      ▼
             1. Status = HELD exclusively for Candidate
             2. Generate unique UUID Offer Token
             3. expiresAt = now() + 15 minutes
             4. Waitlist entry marked OFFERED
             5. Dispatch Email with Claim URL:
                /claim-offer?token={OFFER_TOKEN}
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          │                                                       │
          ▼                                                       ▼
[Candidate Accepts Offer]                               [Declines or 15m Expires]
  POST /api/waitlist/offers/:token/accept                 Sweeper detects expiration
  Status = BOOKED, Waitlist = CONVERTED                  Status = EXPIRED / DECLINED
  Generate QR Ticket Gate Pass                            Cascade: Immediately offer
                                                          seat to NEXT user in queue!
```

---

## 🗄️ Database Schema & Data Model

### Entity-Relationship Diagram

```
┌──────────────┐       1:N       ┌──────────────┐       1:N       ┌──────────────┐
│    venues    │────────────────>│seat_categories│────────────────>│    seats     │
└──────────────┘                 └──────────────┘                 └──────────────┘
       │                                │                                │
       │ 1:N                            │ 1:N                            │ 1:N
       ▼                                ▼                                ▼
┌──────────────┐       1:N       ┌──────────────┐       1:N       ┌──────────────┐
│    shows     │────────────────>│ show_pricing │       ┌────────>│  show_seats  │
└──────────────┘                 └──────────────┘       │         └──────────────┘
       │                                                │                │
       │ 1:N                                            │ 1:N            │ 1:N
       ├─────────────────────────────────┐              │                │
       ▼                                 ▼              │                ▼
┌──────────────┐       1:N       ┌──────────────┐       │         ┌──────────────┐
│   bookings   │────────────────>│booking_seats ├───────┘         │waitlist_offer│
└──────────────┘                 └──────────────┘                 └──────────────┘
       ▲                                                                 ▲
       │ 1:N                                                             │ 1:N
┌──────────────┐                         1:N                             │
│    users     │─────────────────────────────────────────────────────────┘
└──────────────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│   waitlist   │
└──────────────┘
```

### Table Definitions

| Table Name | Description | Key Columns | Indexes & Constraints |
| :--- | :--- | :--- | :--- |
| `users` | Customer, Organiser & Admin accounts | `id`, `email`, `password_hash`, `full_name`, `role`, `created_at` | Unique: `email` |
| `venues` | Physical auditoriums and concert halls | `id`, `name`, `address`, `city`, `total_capacity`, `created_by` | Foreign Key: `created_by -> users.id` |
| `seat_categories` | Pricing tiers per venue (VIP, Standard, Balcony) | `id`, `venue_id`, `name`, `color_code` | Unique: `(venue_id, name)` |
| `seats` | Physical seat positions in venue grid | `id`, `venue_id`, `category_id`, `row_label`, `seat_number`, `grid_row`, `grid_col` | Unique: `(venue_id, row_label, seat_number)` |
| `shows` | Event instances scheduled at venues | `id`, `venue_id`, `organiser_id`, `title`, `start_time`, `hold_duration_minutes` | Foreign Keys: `venue_id`, `organiser_id` |
| `show_pricing` | Tier pricing for a specific show | `id`, `show_id`, `category_id`, `price_cents`, `currency` | Unique: `(show_id, category_id)` |
| `show_seats` | Dynamic state of each seat for a specific show | `id`, `show_id`, `seat_id`, `status` (`AVAILABLE`/`HELD`/`BOOKED`), `held_by_user_id`, `hold_expires_at`, `version` | Unique: `(show_id, seat_id)`<br>Indexes: `(show_id, status)`, `(status, hold_expires_at)` |
| `bookings` | Customer confirmed orders | `id`, `booking_reference`, `user_id`, `show_id`, `status`, `total_amount_cents`, `qr_code_data` | Unique: `booking_reference` |
| `booking_seats` | Normalized seats associated with a booking | `id`, `booking_id`, `show_seat_id`, `seat_id`, `price_paid_cents` | Unique: `(booking_id, show_seat_id)` |
| `waitlist` | FIFO queue for sold-out seat categories | `id`, `show_id`, `category_id`, `user_id`, `priority_order`, `status` | Unique: `(show_id, category_id, user_id)`<br>Index: `(show_id, category_id, status, priority_order)` |
| `waitlist_offers`| Time-limited exclusive reservation offers | `id`, `waitlist_id`, `show_seat_id`, `offer_token`, `expires_at`, `status` | Unique: `offer_token`<br>Index: `(status, expires_at)` |

---

## 📖 Complete API Documentation

### Authentication Endpoints

#### `POST /api/auth/register`
Creates a new customer, organiser, or administrator account.
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "sarah.connor@example.com",
    "password": "Password123!",
    "fullName": "Sarah Connor",
    "phoneNumber": "+1-555-0199",
    "role": "CUSTOMER" // "CUSTOMER" | "ORGANISER" | "ADMIN"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "7b8f9e21-4d1a-4d2c-8f12-3b8c4d9a1011",
      "email": "sarah.connor@example.com",
      "fullName": "Sarah Connor",
      "role": "CUSTOMER"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates a user and returns a signed JWT token.
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "email": "sarah.connor@example.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "7b8f9e21-4d1a-4d2c-8f12-3b8c4d9a1011",
      "email": "sarah.connor@example.com",
      "fullName": "Sarah Connor",
      "role": "CUSTOMER"
    }
  }
  ```

#### `GET /api/auth/me`
Fetches profile information for the authenticated user.
- **Auth Required**: Yes (`Bearer <token>`)
- **Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "7b8f9e21-4d1a-4d2c-8f12-3b8c4d9a1011",
      "email": "sarah.connor@example.com",
      "fullName": "Sarah Connor",
      "role": "CUSTOMER"
    }
  }
  ```

---

### Venue Endpoints

#### `GET /api/venues`
List all venues with their total capacities and seat categories.
- **Auth Required**: No
- **Response (200 OK)**:
  ```json
  {
    "venues": [
      {
        "id": "v101-grand-hall",
        "name": "Grand Symphony Hall",
        "city": "San Francisco, CA",
        "totalCapacity": 120,
        "categories": [
          { "id": "cat-vip", "name": "VIP Orchestra", "colorCode": "#8B5CF6" },
          { "id": "cat-std", "name": "Standard Floor", "colorCode": "#3B82F6" }
        ]
      }
    ]
  }
  ```

#### `POST /api/venues`
Provisions a new venue.
- **Auth Required**: Yes (Role: `ADMIN`)
- **Request Body**:
  ```json
  {
    "name": "Metro Arena",
    "address": "500 Stadium Way",
    "city": "Austin, TX"
  }
  ```

#### `POST /api/venues/:id/seats/grid`
Generates a structured row/column seat grid layout for a venue.
- **Auth Required**: Yes (Role: `ADMIN`)
- **Request Body**:
  ```json
  {
    "rows": [
      { "rowLabel": "A", "seatCount": 12, "categoryId": "cat-vip" },
      { "rowLabel": "B", "seatCount": 12, "categoryId": "cat-std" }
    ]
  }
  ```

---

### Show & Event Endpoints

#### `GET /api/shows`
Fetches a list of upcoming published events, complete with venue information and pricing tiers.
- **Auth Required**: No
- **Response (200 OK)**:
  ```json
  {
    "shows": [
      {
        "id": "show-interstellar",
        "title": "Interstellar Live Symphony",
        "category": "Concert",
        "startTime": "2026-09-15T19:30:00.000Z",
        "venue": {
          "name": "Grand Symphony Hall",
          "city": "San Francisco, CA"
        },
        "pricing": [
          { "categoryId": "cat-vip", "categoryName": "VIP Orchestra", "priceCents": 12500 },
          { "categoryId": "cat-std", "categoryName": "Standard Floor", "priceCents": 6500 }
        ],
        "availableSeatsCount": 42
      }
    ]
  }
  ```

#### `POST /api/shows`
Creates and publishes a new show with tier-specific pricing.
- **Auth Required**: Yes (Role: `ORGANISER` or `ADMIN`)
- **Request Body**:
  ```json
  {
    "venueId": "v101-grand-hall",
    "title": "Hans Zimmer Soundtrack Odyssey",
    "description": "Experience iconic film scores live.",
    "category": "Concert",
    "startTime": "2026-10-20T20:00:00Z",
    "endTime": "2026-10-20T22:30:00Z",
    "holdDurationMinutes": 10,
    "offerDurationMinutes": 15,
    "pricing": [
      { "categoryId": "cat-vip", "priceCents": 15000 },
      { "categoryId": "cat-std", "priceCents": 7500 }
    ]
  }
  ```

#### `GET /api/shows/:id/summary`
Retrieves sales, revenue, and occupancy metrics for a show.
- **Auth Required**: Yes (Role: `ORGANISER` or `ADMIN`)
- **Response (200 OK)**:
  ```json
  {
    "showId": "show-interstellar",
    "totalSeats": 120,
    "bookedSeats": 95,
    "heldSeats": 6,
    "availableSeats": 19,
    "occupancyRate": 79.17,
    "totalRevenueCents": 745000,
    "waitlistCount": 8
  }
  ```

---

### Seat & Hold Endpoints

#### `GET /api/seats/show/:showId`
Returns the complete visual seat map for a show with real-time status (`AVAILABLE`, `HELD`, `BOOKED`) and hold expiration timestamps.
- **Auth Required**: Optional
- **Response (200 OK)**:
  ```json
  {
    "showId": "show-interstellar",
    "seats": [
      {
        "id": "ss-a1",
        "seatId": "seat-a1",
        "rowLabel": "A",
        "seatNumber": 1,
        "gridRow": 1,
        "gridCol": 1,
        "categoryName": "VIP Orchestra",
        "colorCode": "#8B5CF6",
        "priceCents": 12500,
        "status": "HELD",
        "isHeldByMe": true,
        "holdExpiresAt": "2026-08-21T07:18:57.000Z"
      }
    ]
  }
  ```

#### `POST /api/seats/hold`
Atomically holds one or more selected seats for 10 minutes.
- **Auth Required**: Optional (Accepts JWT or client session token)
- **Request Body**:
  ```json
  {
    "showId": "show-interstellar",
    "showSeatIds": ["ss-a1", "ss-a2"],
    "sessionToken": "guest-session-uuid" // Optional for guest checkouts
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "heldSeats": ["ss-a1", "ss-a2"],
    "holdExpiresAt": "2026-08-21T07:18:57.000Z",
    "holdDurationSeconds": 600
  }
  ```
- **Error (409 Conflict)**:
  ```json
  {
    "error": "One or more selected seats are no longer available"
  }
  ```

#### `POST /api/seats/release`
Releases previously held seats back into the available pool.
- **Auth Required**: Optional
- **Request Body**:
  ```json
  {
    "showId": "show-interstellar",
    "showSeatIds": ["ss-a1", "ss-a2"]
  }
  ```

---

### Booking Endpoints

#### `POST /api/bookings/confirm`
Completes checkout, processes payment, converts held seats to `BOOKED`, and generates the QR admission ticket.
- **Auth Required**: Optional (Accepts JWT or customer details)
- **Request Body**:
  ```json
  {
    "showId": "show-interstellar",
    "showSeatIds": ["ss-a1", "ss-a2"],
    "customerDetails": {
      "fullName": "Sarah Connor",
      "email": "sarah.connor@example.com"
    },
    "paymentDetails": {
      "paymentMethod": "CARD",
      "paymentToken": "tok_visa_success"
    }
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "booking": {
      "id": "b-90210",
      "bookingReference": "TKT-8F92-419B",
      "showTitle": "Interstellar Live Symphony",
      "venueName": "Grand Symphony Hall",
      "startTime": "2026-09-15T19:30:00.000Z",
      "totalAmountCents": 25000,
      "seats": [
        { "row": "A", "number": 1, "category": "VIP Orchestra", "priceCents": 12500 },
        { "row": "A", "number": 2, "category": "VIP Orchestra", "priceCents": 12500 }
      ],
      "qrCodeData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "status": "CONFIRMED"
    }
  }
  ```

#### `GET /api/bookings/my-bookings`
Fetches past and upcoming bookings for the authenticated user.
- **Auth Required**: Yes (`Bearer <token>`)

#### `POST /api/bookings/cancel`
Cancels a confirmed booking, frees the physical seats, and triggers the waitlist auto-assignment pipeline.
- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body**:
  ```json
  {
    "bookingId": "b-90210"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Booking cancelled. Refund issued and seats returned to waitlist."
  }
  ```

---

### Waitlist Endpoints

#### `POST /api/waitlist/join`
Adds a customer to the FIFO queue for a sold-out category.
- **Auth Required**: Optional
- **Request Body**:
  ```json
  {
    "showId": "show-interstellar",
    "categoryId": "cat-vip",
    "email": "waitlist.buyer@example.com",
    "requestedSeatsCount": 1
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "waitlistEntry": {
      "id": "w-501",
      "queuePosition": 1,
      "status": "WAITING"
    }
  }
  ```

#### `GET /api/waitlist/offers/:token`
Inspects details of a 15-minute waitlist seat offer.
- **Auth Required**: No (Public link token)
- **Response (200 OK)**:
  ```json
  {
    "offer": {
      "token": "offer-uuid-8712a",
      "showTitle": "Interstellar Live Symphony",
      "seatLabel": "Row A, Seat 1",
      "categoryName": "VIP Orchestra",
      "priceCents": 12500,
      "expiresAt": "2026-08-21T07:23:57.000Z",
      "secondsRemaining": 894
    }
  }
  ```

#### `POST /api/waitlist/offers/:token/accept`
Accepts the exclusive offer and completes the booking transaction.
- **Auth Required**: Optional
- **Response (200 OK)**: Confirmed booking with QR code.

#### `POST /api/waitlist/offers/:token/decline`
Declines the offer, releasing the seat immediately to the next person in line.
- **Auth Required**: Optional
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Offer declined. Seat offered to the next waitlisted customer."
  }
  ```

---

### WebSocket Real-Time Gateway

- **Connection URL**: `ws://<host>/ws/shows/:showId`
- **Protocol**: Real-time event streaming over WebSockets.

#### Broadcast Event Payloads

##### `SEAT_HELD`
```json
{
  "type": "SEAT_HELD",
  "showId": "show-interstellar",
  "showSeatIds": ["ss-a1"],
  "holdExpiresAt": "2026-08-21T07:18:57.000Z"
}
```

##### `SEAT_RELEASED`
```json
{
  "type": "SEAT_RELEASED",
  "showId": "show-interstellar",
  "showSeatIds": ["ss-a1"]
}
```

##### `SEAT_BOOKED`
```json
{
  "type": "SEAT_BOOKED",
  "showId": "show-interstellar",
  "showSeatIds": ["ss-a1"]
}
```

---

## 🚢 Deployment Guide & Checklist

Deploying the application to cloud environments (Render, Railway, Fly.io, Vercel + Neon):

### 1. Database Provisioning (PostgreSQL)
- Create a PostgreSQL database on **Neon**, **Supabase**, **Railway**, or **AWS RDS**.
- Copy the connection string: `postgresql://user:pass@host:5432/dbname?sslmode=require`.

### 2. Environment Variables to Set
- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL=postgresql://...`
- `JWT_SECRET=generate-a-cryptographically-random-32-character-secret`
- `APP_URL=https://your-custom-domain.com`
- `FRONTEND_URL=https://your-custom-domain.com`
- `EMAIL_PROVIDER=smtp` (or `resend`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`

### 3. Build & Start Commands
- **Build Command**:
  ```bash
  npm run build
  ```
- **Start Command**:
  ```bash
  npm start
  ```
- **Database Migration Step in CI/CD**:
  ```bash
  npx prisma migrate deploy
  ```
