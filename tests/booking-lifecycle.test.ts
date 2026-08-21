import assert from 'assert';
import { store } from '../backend/src/db/store.ts';
import { SeatHoldService } from '../backend/src/services/seatHold.service.ts';
import { BookingService } from '../backend/src/services/booking.service.ts';
import { QRService } from '../backend/src/services/qr.service.ts';

/**
 * End-to-End Booking Lifecycle Test
 *
 * Validates:
 * 1. Holding seats with TTL
 * 2. Confirming the booking & generating booking reference (e.g. 'BK-...')
 * 3. Marking ShowSeats status as 'BOOKED'
 * 4. Generating valid Base64 QR Code Pass
 * 5. Querying customer booking history
 * 6. Cancelling booking, releasing seats back to 'AVAILABLE', and validating inventory recovery
 */
async function runBookingLifecycleTest() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 4: Booking Lifecycle & Cancellation Test');
  console.log('====================================================\n');

  await store.initPromise;
  const showId = 'show-interstellar-1';
  const customerId = 'u-cust-1';
  const customerEmail = 'sarah.connor@example.com';
  const customerName = 'Sarah Connor';

  // Step 1: Find two available seats
  const availableSeats = Array.from(store.showSeats.values()).filter(
    (s) => s.showId === showId && s.status === 'AVAILABLE'
  );
  assert(availableSeats.length >= 2, 'Need at least 2 available seats');

  const seatIds = [availableSeats[0].id, availableSeats[1].id];
  console.log(`🎟️ Target Seats for Booking: ${seatIds.join(', ')}`);

  // Step 2: Hold seats
  const holdResult = await SeatHoldService.holdSeats(showId, seatIds, customerId);
  assert.strictEqual(holdResult.success, true, 'Seats must be held successfully');
  console.log(`🔒 Step 1: Held seats with Session Token: ${holdResult.holdSessionToken}`);

  // Step 3: Confirm booking
  const confirmResult = await BookingService.confirmBooking({
    showId,
    seatIds,
    userId: customerId,
    holdSessionToken: holdResult.holdSessionToken,
    customerEmail,
    customerName,
  });

  assert.strictEqual(confirmResult.success, true, 'Booking must be confirmed');
  const booking = confirmResult.booking!;
  assert(booking.bookingReference.startsWith('BK-'), 'Reference must start with BK-');
  assert.strictEqual(booking.status, 'CONFIRMED', 'Booking status must be CONFIRMED');
  assert.strictEqual(booking.items.length, 2, 'Booking must contain 2 items');
  assert(booking.qrCodeDataURL.startsWith('data:image/png;base64,'), 'Must contain valid QR Data URL');

  console.log(`\n🎉 Step 2: Booking Confirmed!`);
  console.log(`   - Reference: ${booking.bookingReference}`);
  console.log(`   - Total Amount: $${(booking.totalAmountCents / 100).toFixed(2)}`);
  console.log(`   - QR Code Data URL length: ${booking.qrCodeDataURL.length} chars`);
  console.log(`   - Seat Labels: ${booking.seatLabels.join(', ')}`);

  // Verify ShowSeats are now marked BOOKED
  for (const sId of seatIds) {
    const seatInDb = store.showSeats.get(sId)!;
    assert.strictEqual(seatInDb.status, 'BOOKED', `Seat ${sId} in DB must be BOOKED`);
  }
  console.log(`   - DB Status Verification: All seats successfully marked 'BOOKED'`);

  // Step 4: Check Customer Booking History
  const myBookings = BookingService.getCustomerBookings(customerId);
  assert(myBookings.some((b) => b.id === booking.id), 'Booking must appear in history');
  console.log(`\n📜 Step 3: Verified Booking History: ${myBookings.length} booking(s) retrieved.`);

  // Step 5: Cancel Booking
  console.log(`\n🚫 Step 4: Testing Booking Cancellation...`);
  const cancelResult = await BookingService.cancelBooking(booking.id, customerId, 'Schedule conflict');
  assert.strictEqual(cancelResult.success, true, 'Cancellation must succeed');
  console.log(`   - Cancellation response: "${cancelResult.message}"`);

  // Verify DB state
  const cancelledBooking = store.bookings.get(booking.id)!;
  assert.strictEqual(cancelledBooking.status, 'CANCELLED');
  assert.strictEqual(cancelledBooking.cancellationReason, 'Schedule conflict');

  for (const sId of seatIds) {
    const seatInDb = store.showSeats.get(sId)!;
    assert.strictEqual(seatInDb.status, 'AVAILABLE', `Seat ${sId} in DB must be reverted to AVAILABLE`);
    assert.strictEqual(seatInDb.heldByUserId, null);
  }
  console.log(`   - DB Status Verification: All seats successfully returned to 'AVAILABLE'`);

  console.log('\n====================================================');
  console.log('✅ ALL PHASE 4 TESTS COMPLETED SUCCESSFULLY');
  console.log('====================================================\n');
}

runBookingLifecycleTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 4 test failed:', err);
    process.exit(1);
  });
