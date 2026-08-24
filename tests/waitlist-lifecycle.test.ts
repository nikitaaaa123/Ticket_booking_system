import assert from 'assert';
import { store } from '../backend/src/db/store.ts';
import { SeatHoldService } from '../backend/src/services/seatHold.service.ts';
import { BookingService } from '../backend/src/services/booking.service.ts';
import { WaitlistService } from '../backend/src/services/waitlist.service.ts';

/**
 * End-to-End Waitlist System Test (Phase 5)
 *
 * Validates:
 * 1. Customer joins waitlist for a sold-out category (FIFO queue positioning & deduplication)
 * 2. Another customer joins same waitlist (position #2)
 * 3. Existing booking in that category is cancelled -> triggers auto-allocation:
 *    - Pop #1 customer from FIFO queue
 *    - Generates time-limited offer (token, 15m expiry)
 *    - Seat held with offerToken
 *    - Email dispatched with claim link
 * 4. Offer Acceptance: Customer #1 accepts offer -> converted to confirmed booking with QR pass
 * 5. Offer Expiry TTL: Another seat is freed -> Offered to Customer #2 -> TTL expires ->
 *    Sweeper marks expired -> offers to next candidate or returns to public inventory
 * 6. Empty queue handling: Seat goes back to 'AVAILABLE' in public inventory
 */
async function runWaitlistLifecycleTest() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 5: Complete Waitlist System Test');
  console.log('====================================================\n');

  await store.initPromise;
  if (store.showSeats.size === 0) {
    await store.seedInitialData(true);
  }
  store.waitlist.clear();
  store.waitlistOffers.clear();
  const showId = 'show-interstellar-1';
  const categoryId = 'cat-vip-1'; // VIP category

  const userAlice = { id: 'u-alice-1', email: 'alice@example.com', name: 'Alice Smith' };
  const userBob = { id: 'u-bob-2', email: 'bob@example.com', name: 'Bob Jones' };
  const userCharlie = { id: 'u-charlie-3', email: 'charlie@example.com', name: 'Charlie Brown' };

  // Step 1: Alice & Bob join the waitlist for VIP seats
  console.log('📋 Step 1: Customers joining waitlist for VIP category...');
  const aliceJoin = await WaitlistService.joinWaitlist({
    showId,
    categoryId,
    userId: userAlice.id,
    customerEmail: userAlice.email,
    customerName: userAlice.name,
  });
  assert.strictEqual(aliceJoin.success, true);
  assert.strictEqual(aliceJoin.queuePosition, 1, 'Alice must be #1 in FIFO queue');
  console.log(`   - Alice joined: Position #${aliceJoin.queuePosition}`);

  // Test Deduplication: Alice joins again
  const aliceDup = await WaitlistService.joinWaitlist({
    showId,
    categoryId,
    userId: userAlice.id,
    customerEmail: userAlice.email,
  });
  assert.strictEqual(aliceDup.success, true);
  assert.strictEqual(aliceDup.queuePosition, 1, 'Alice duplicate join must return current position without adding second queue item');
  console.log(`   - Deduplication verified: Alice remains position #${aliceDup.queuePosition}`);

  // Bob joins
  const bobJoin = await WaitlistService.joinWaitlist({
    showId,
    categoryId,
    userId: userBob.id,
    customerEmail: userBob.email,
    customerName: userBob.name,
  });
  assert.strictEqual(bobJoin.success, true);
  assert.strictEqual(bobJoin.queuePosition, 2, 'Bob must be #2 in FIFO queue');
  console.log(`   - Bob joined: Position #${bobJoin.queuePosition}`);

  // Charlie joins
  const charlieJoin = await WaitlistService.joinWaitlist({
    showId,
    categoryId,
    userId: userCharlie.id,
    customerEmail: userCharlie.email,
    customerName: userCharlie.name,
  });
  assert.strictEqual(charlieJoin.success, true);
  assert.strictEqual(charlieJoin.queuePosition, 3, 'Charlie must be #3 in FIFO queue');
  console.log(`   - Charlie joined: Position #${charlieJoin.queuePosition}`);

  // Step 2: Simulate an existing confirmed booking for a VIP seat
  console.log('\n🎟️ Step 2: Simulating existing booking cancellation to trigger waitlist reallocation...');
  const vipSeats = Array.from(store.showSeats.values()).filter(
    (s) => s.showId === showId && s.categoryId === categoryId
  );
  const targetSeat = vipSeats[0];

  // Hold and book target seat for a preliminary user
  await SeatHoldService.holdSeats(showId, [targetSeat.id], 'u-temp-buyer');
  const tempHold = store.showSeats.get(targetSeat.id)!;
  const originalBooking = await BookingService.confirmBooking({
    showId,
    seatIds: [targetSeat.id],
    userId: 'u-temp-buyer',
    holdSessionToken: tempHold.holdSessionToken!,
    customerEmail: 'temp@example.com',
  });
  assert.strictEqual(originalBooking.success, true);
  const bookingId = originalBooking.booking!.id;
  console.log(`   - Initial booking created: ${originalBooking.booking!.bookingReference}`);

  // Cancel the booking -> This should trigger automatic waitlist allocation to Alice (#1)!
  console.log('\n🚫 Step 3: Cancelling booking and verifying auto-offer to Alice (#1 in queue)...');
  const cancelResult = await BookingService.cancelBooking(bookingId, 'u-temp-buyer', 'Cannot attend');
  assert.strictEqual(cancelResult.success, true);

  // Verify Alice received the offer
  const activeOffers = Array.from(store.waitlistOffers.values()).filter(
    (o) => o.showId === showId && o.showSeatId === targetSeat.id && o.status === 'PENDING'
  );
  assert.strictEqual(activeOffers.length, 1, 'Must have exactly 1 active offer for the freed seat');
  const aliceOffer = activeOffers[0];
  assert.strictEqual(aliceOffer.userId, userAlice.id, 'Offer must be assigned to Alice (FIFO head)');
  assert(aliceOffer.offerToken.startsWith('wlo_'), 'Offer token must start with wlo_');
  console.log(`   - Offer successfully generated for Alice!`);
  console.log(`     Token: ${aliceOffer.offerToken}`);
  console.log(`     Expires at: ${aliceOffer.expiresAt}`);

  // Verify seat state is HELD by Alice with offerToken
  const heldSeat = store.showSeats.get(targetSeat.id)!;
  assert.strictEqual(heldSeat.status, 'HELD');
  assert.strictEqual(heldSeat.heldByUserId, userAlice.id);
  assert.strictEqual(heldSeat.holdSessionToken, aliceOffer.offerToken);
  console.log(`   - Seat ${heldSeat.id} successfully locked with offer hold`);

  // Step 4: Validate Offer Details Endpoint
  console.log('\n🔍 Step 4: Testing offer validation & retrieval...');
  const offerDetails = await WaitlistService.getOfferDetails(aliceOffer.offerToken);
  assert.strictEqual(offerDetails.success, true);
  assert.strictEqual(offerDetails.offer!.showTitle, 'Interstellar: 10th Anniversary in 70mm Dolby Atmos');
  assert(offerDetails.offer!.remainingSeconds > 0, 'Remaining time must be positive');
  console.log(`   - Validated offer details for ${offerDetails.offer!.seatLabel}: ${offerDetails.offer!.priceFormatted}`);

  // Step 5: Alice accepts the offer
  console.log('\n✅ Step 5: Alice accepts offer and confirms booking...');
  const acceptResult = await WaitlistService.acceptOffer(aliceOffer.offerToken, {
    customerEmail: userAlice.email,
    customerName: userAlice.name,
  });
  assert.strictEqual(acceptResult.success, true, 'Accepting offer must succeed');
  assert(acceptResult.booking!.bookingReference.startsWith('BK-'));
  console.log(`   - Booking confirmed! Ref: ${acceptResult.booking!.bookingReference}`);

  // Verify offer is ACCEPTED and waitlist is CONVERTED
  const updatedOffer = store.waitlistOffers.get(aliceOffer.id)!;
  assert.strictEqual(updatedOffer.status, 'ACCEPTED');
  const aliceEntry = store.waitlist.get(aliceOffer.waitlistId)!;
  assert.strictEqual(aliceEntry.status, 'CONVERTED');

  // Verify Seat is now BOOKED by Alice
  const bookedSeat = store.showSeats.get(targetSeat.id)!;
  assert.strictEqual(bookedSeat.status, 'BOOKED');
  console.log(`   - Seat ${bookedSeat.id} is now permanently 'BOOKED' by Alice`);

  // Step 6: Test Offer Expiry TTL with Bob & Charlie
  console.log('\n⏳ Step 6: Testing Offer Expiry TTL & Automatic Handover to Next in Line...');
  const secondSeat = vipSeats[1];
  // Free the second seat directly to trigger waitlist
  await WaitlistService.processWaitlistForFreedSeat(showId, secondSeat.id);

  // Bob (#2) should now have received an offer
  const bobOffers = Array.from(store.waitlistOffers.values()).filter(
    (o) => o.userId === userBob.id && o.status === 'PENDING'
  );
  assert.strictEqual(bobOffers.length, 1, 'Bob must have received pending offer');
  const bobOffer = bobOffers[0];
  console.log(`   - Bob received offer for seat ${secondSeat.id}`);

  // Simulate Bob letting the offer expire (set expiry to past)
  bobOffer.expiresAt = new Date(Date.now() - 5000).toISOString();
  store.waitlistOffers.set(bobOffer.id, bobOffer);

  // Trigger TTL Sweeper
  console.log('   - Sweeping expired offers...');
  const sweepResult = await WaitlistService.sweepExpiredOffers();
  assert(sweepResult.expiredCount >= 1, 'Must sweep at least 1 expired offer');
  console.log(`   - Swept ${sweepResult.expiredCount} expired offer(s)`);

  // Bob's offer must be EXPIRED
  const expiredBobOffer = store.waitlistOffers.get(bobOffer.id)!;
  assert.strictEqual(expiredBobOffer.status, 'EXPIRED');

  // Charlie (#3) should now automatically have received the offer!
  const charlieOffers = Array.from(store.waitlistOffers.values()).filter(
    (o) => o.userId === userCharlie.id && o.status === 'PENDING'
  );
  assert.strictEqual(charlieOffers.length, 1, 'Charlie must now have received the reallocated offer');
  const charlieOffer = charlieOffers[0];
  console.log(`   - Seat was automatically handed over to Charlie (#3 in queue)!`);
  console.log(`     Charlie offer token: ${charlieOffer.offerToken}`);

  // Step 7: Charlie declines offer -> Queue is now empty -> Seat returns to AVAILABLE
  console.log('\n🚫 Step 7: Charlie declines offer -> Verifying empty queue behavior...');
  const declineResult = await WaitlistService.declineOffer(charlieOffer.offerToken, 'Changed my mind');
  assert.strictEqual(declineResult.success, true);

  // Verify seat returned to AVAILABLE in public inventory
  const finalSeatState = store.showSeats.get(secondSeat.id)!;
  assert.strictEqual(finalSeatState.status, 'AVAILABLE', 'Seat must return to AVAILABLE when queue is empty');
  assert.strictEqual(finalSeatState.heldByUserId, null);
  console.log(`   - Empty queue verified: Seat ${secondSeat.id} successfully returned to public 'AVAILABLE' pool`);

  console.log('\n====================================================');
  console.log('✅ ALL PHASE 5 WAITLIST TESTS COMPLETED SUCCESSFULLY');
  console.log('====================================================\n');
}

runWaitlistLifecycleTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 5 waitlist test failed:', err);
    process.exit(1);
  });
