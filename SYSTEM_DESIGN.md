# System Design: High-Concurrency Ticket Booking Engine

This document details the architectural specifications for seat inventory management, concurrency control, and automated waitlist assignment.

---

## 1. Seat Hold and TTL Mechanism

Seat inventory is modeled as a finite-state machine with three core states: `AVAILABLE`, `HELD`, and `BOOKED`.

```
AVAILABLE ──(Acquire Hold, 10m TTL)──> HELD ──(Complete Checkout)──> BOOKED
    ▲                                    │
    └──────────(TTL Sweeper / Release)───┘
```

### Hold Acquisition
1. **Validation & Transition**: When `POST /api/seats/hold` is called, the system validates that target seat records have `status = AVAILABLE` and `(holdExpiresAt IS NULL OR holdExpiresAt < NOW())`.
2. **Lock Assignment**: The seat is updated to `status = HELD`, assigned to `heldByUserId` (or `holdSessionToken`), and given a timestamp `holdExpiresAt = NOW() + INTERVAL '10 minutes'`.
3. **Real-Time Synchronization**: The server broadcasts a `SEAT_HELD` event over WebSockets to all clients connected to the `showId` channel.

### Background TTL Sweeper
- **Reaper Cycle**: A non-blocking job runs at 15-second intervals.
- **Query Filter**: Executes an indexed query: `status = 'HELD' AND holdExpiresAt <= NOW()`.
- **Reclamation**: Resets records to `status = AVAILABLE`, clearing user bindings and expiration timestamps.
- **Broadcast**: Emits `SEAT_RELEASED` to refresh client maps in real time.

---

## 2. Concurrency Prevention Approach

To guarantee zero double bookings during extreme traffic spikes, the engine employs a multi-tiered concurrency model:

```
[ Request ] ──> [ Tier 1: Mutex Lock ] ──> [ Tier 2: DB Row Lock ] ──> [ Tier 3: Version Check ]
```

1. **In-Process Keyed Mutex**: Requests targeting the same `seatId` are serialized at the application layer using an in-memory lock queue, eliminating Node.js event-loop race conditions.
2. **Pessimistic Database Row Locking**: Multi-statement SQL transactions lock candidate records using `SELECT ... FOR UPDATE`. Concurrent transactions targeting the same rows block until the active transaction resolves.
3. **Optimistic Version Control**: Every `ShowSeat` row maintains an integer `version` field. State changes execute conditional writes:
   `UPDATE show_seats SET status = 'HELD', version = version + 1 WHERE id = :id AND version = :version AND status = 'AVAILABLE'`
   If zero rows match, the transaction aborts and returns an HTTP `409 Conflict`.
4. **All-or-Nothing Multi-Seat Atomicity**: Multi-seat checkout and hold requests execute within single atomic transactions. If any seat in a requested batch fails validation, the entire transaction rolls back.

---

## 3. Waitlist Auto-Assignment Flow

When a seating category reaches capacity, users can join a FIFO waitlist ordered by `priority_order ASC`.

```
[ Ticket Cancelled / Hold Expired ]
                │
                ▼
1. Lock category & query next candidate:
   `SELECT * FROM waitlist WHERE show_id = :s AND category_id = :c AND status = 'WAITING' ORDER BY priority_order ASC LIMIT 1 FOR UPDATE`
                │
                ▼
2. Provision exclusive 15-minute hold:
   - `show_seats.status = HELD` (assigned to candidate `user_id`)
   - Generate cryptographically random `offer_token` (UUIDv4)
   - Insert `waitlist_offers` record (`expires_at = NOW() + 15m`)
   - Update waitlist entry: `status = OFFERED`
                │
                ▼
3. Dispatch notification with claim URL (`/claim-offer?token={offer_token}`)
```

The auto-assignment pipeline is triggered synchronously when:
- A confirmed booking is cancelled (`POST /api/bookings/cancel`).
- A seat hold or pending waitlist offer expires during the background TTL sweep.

---

## 4. Time-Limited Offer Handling

Waitlist offers grant an exclusive 15-minute purchasing window to the assigned candidate.

```
                           ┌─────────────────────────┐
                           │ Waitlist Offer Created  │
                           │   (status = PENDING)    │
                           └────────────┬────────────┘
                                        │
                        ┌───────────────┴───────────────┐
                        ▼                               ▼
              [ Candidate Accepts ]           [ Declines or Expires ]
             `POST .../accept`                `POST .../decline` / TTL Reaper
                        │                               │
                        ▼                               ▼
              `status = ACCEPTED`             `status = EXPIRED/DECLINED`
              Seat = `BOOKED`                           │
              Generate QR Gate Pass                     ▼
                                              [ Cascade Reassignment ]
                                              Immediately provisions offer
                                              to next user in FIFO queue
```

1. **Offer Inspection**: `GET /api/waitlist/offers/:token` verifies that `status = PENDING` and `expiresAt > NOW()`.
2. **Acceptance**: `POST /api/waitlist/offers/:token/accept` converts `waitlist_offers.status` to `ACCEPTED`, updates the waitlist item to `CONVERTED`, transitions the seat to `BOOKED`, and generates the QR gate pass within an ACID transaction.
3. **Decline & Expiration Cascading**: When an offer is declined via `POST /api/waitlist/offers/:token/decline` or expires via the TTL sweeper, its status transitions to `DECLINED` or `EXPIRED`. Rather than returning the seat to public inventory, the system **immediately re-invokes the waitlist pipeline**, generating an offer for the next candidate in line.
