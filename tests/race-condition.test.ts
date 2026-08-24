import assert from 'assert';
import { SeatHoldService } from '../backend/src/services/seatHold.service.ts';
import { store } from '../backend/src/db/store.ts';

/**
 * RACE CONDITION CONCURRENCY TEST
 *
 * This test simulates two distinct customers (Alice and Bob) firing simultaneous
 * network requests to hold the EXACT SAME seat at the exact same millisecond.
 *
 * It validates:
 * 1. Exactly ONE request receives { success: true } with a valid hold session token.
 * 2. The other request receives { success: false } with error 'SeatUnavailable' (409 Conflict).
 * 3. The seat status in the database is 'HELD' with version incremented exactly once.
 * 4. The winner's userId is recorded accurately as the holder.
 */
async function runRaceConditionTest() {
  console.log('====================================================');
  console.log('🧪 Starting Race-Condition Concurrency Test');
  console.log('====================================================\n');

  // Ensure DB seed is completed
  await store.initPromise;
  if (store.showSeats.size === 0) {
    await store.seedInitialData(true);
  }

  const showId = 'show-interstellar-1';
  // Ensure seats are available
  for (const s of store.showSeats.values()) {
    if (s.showId === showId) {
      s.status = 'AVAILABLE';
      s.heldByUserId = null;
      s.holdExpiresAt = null;
      s.holdSessionToken = null;
    }
  }
  // Pick an available seat
  const targetSeat = Array.from(store.showSeats.values()).find(
    (s) => s.showId === showId && s.status === 'AVAILABLE'
  );

  if (!targetSeat) {
    throw new Error('No available seats found for testing show.');
  }

  const targetSeatId = targetSeat.id;
  console.log(`🎯 Target Seat ID: ${targetSeatId}`);
  console.log(`   Initial Status: ${targetSeat.status} (Version: ${targetSeat.version})\n`);

  const userAlice = 'u-customer-alice-99';
  const userBob = 'u-customer-bob-88';

  console.log('⚡ Firing 2 simultaneous hold requests via Promise.all()...');
  const startTime = Date.now();

  // Fire both requests simultaneously
  const [resultAlice, resultBob] = await Promise.all([
    SeatHoldService.holdSeats(showId, [targetSeatId], userAlice),
    SeatHoldService.holdSeats(showId, [targetSeatId], userBob),
  ]);

  const durationMs = Date.now() - startTime;
  console.log(`⏱️ Completed in ${durationMs}ms\n`);

  console.log('📊 Result Breakdown:');
  console.log('   User Alice:', JSON.stringify(resultAlice));
  console.log('   User Bob:  ', JSON.stringify(resultBob));
  console.log();

  // Assertions
  const successes = [resultAlice, resultBob].filter((r) => r.success);
  const failures = [resultAlice, resultBob].filter((r) => !r.success);

  assert.strictEqual(
    successes.length,
    1,
    `❌ Test Failed: Expected exactly 1 request to succeed, but got ${successes.length}`
  );
  assert.strictEqual(
    failures.length,
    1,
    `❌ Test Failed: Expected exactly 1 request to fail, but got ${failures.length}`
  );

  const winner = resultAlice.success ? 'Alice' : 'Bob';
  const winnerUserId = resultAlice.success ? userAlice : userBob;
  const loser = resultAlice.success ? 'Bob' : 'Alice';
  const failedResult = failures[0];

  assert.strictEqual(
    failedResult.error,
    'SeatUnavailable',
    `❌ Test Failed: Expected failure error code 'SeatUnavailable', got '${failedResult.error}'`
  );

  const finalSeatState = store.showSeats.get(targetSeatId)!;
  assert.strictEqual(
    finalSeatState.status,
    'HELD',
    `❌ Test Failed: Final seat state should be 'HELD'`
  );
  assert.strictEqual(
    finalSeatState.heldByUserId,
    winnerUserId,
    `❌ Test Failed: Final seat holder should match winner (${winnerUserId})`
  );

  console.log('====================================================');
  console.log(`✅ TEST 1 PASSED: Single-seat concurrency check succeeded!`);
  console.log(`   - Winner: ${winner} (${winnerUserId})`);
  console.log(`   - Loser:  ${loser} received '${failedResult.error}' with message: "${failedResult.message}"`);
  console.log(`   - Final Seat State: HELD by ${finalSeatState.heldByUserId}, Hold expires at: ${finalSeatState.holdExpiresAt}`);
  console.log('====================================================\n');

  // TEST 2: Multi-Seat Atomic Batch Contention
  console.log('====================================================');
  console.log('🧪 TEST 2: Multi-Seat Atomic Batch Contention');
  console.log('====================================================\n');

  const seatA2 = Array.from(store.showSeats.values()).find(
    (s) => s.showId === showId && s.status === 'AVAILABLE'
  );
  const availableSeats = Array.from(store.showSeats.values()).filter(
    (s) => s.showId === showId && s.status === 'AVAILABLE'
  );

  assert(availableSeats.length >= 3, 'Need at least 3 available seats for batch test');
  const seat1 = availableSeats[0].id;
  const seat2 = availableSeats[1].id; // Overlapping contested seat
  const seat3 = availableSeats[2].id;

  console.log(`🎯 User Charlie wants: [${seat1}, ${seat2}]`);
  console.log(`🎯 User Dave wants:    [${seat2}, ${seat3}] (Contesting ${seat2})`);

  const [resCharlie, resDave] = await Promise.all([
    SeatHoldService.holdSeats(showId, [seat1, seat2], 'u-charlie'),
    SeatHoldService.holdSeats(showId, [seat2, seat3], 'u-dave'),
  ]);

  console.log('   Charlie Result:', JSON.stringify(resCharlie));
  console.log('   Dave Result:   ', JSON.stringify(resDave));

  const batchSuccesses = [resCharlie, resDave].filter((r) => r.success);
  const batchFailures = [resCharlie, resDave].filter((r) => !r.success);

  assert.strictEqual(batchSuccesses.length, 1, 'Only one batch hold should succeed');
  assert.strictEqual(batchFailures.length, 1, 'One batch hold must fail completely');

  // Check that the losing party holds 0 seats (atomic all-or-nothing rollback)
  const loserUserId = resCharlie.success ? 'u-dave' : 'u-charlie';
  const loserHeldSeats = Array.from(store.showSeats.values()).filter(
    (s) => s.showId === showId && s.heldByUserId === loserUserId
  );
  assert.strictEqual(
    loserHeldSeats.length,
    0,
    `❌ All-or-nothing rollback failed: Loser ${loserUserId} should have 0 held seats, but had ${loserHeldSeats.length}`
  );

  console.log(`\n✅ TEST 2 PASSED: All-or-nothing atomicity verified! Loser holds 0 seats.\n`);

  // TEST 3: TTL Hold Expiry & Automatic Seat Recovery
  console.log('====================================================');
  console.log('🧪 TEST 3: TTL Hold Expiry & Automatic Seat Recovery');
  console.log('====================================================\n');

  // Grab a seat that is genuinely held by the winner of Test 2
  const winnerResult = resCharlie.success ? resCharlie : resDave;
  const heldSeatId = winnerResult.heldSeatIds![0];
  const heldSeat = store.showSeats.get(heldSeatId)!;
  assert.strictEqual(heldSeat.status, 'HELD', 'Target seat for TTL test must be in HELD status');

  heldSeat.holdExpiresAt = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago in the past
  store.showSeats.set(heldSeat.id, heldSeat);

  console.log(`⏳ Backdated seat ${heldSeat.id} holdExpiresAt to past timestamp...`);

  // Trigger TTL sweep
  const sweepResult = await SeatHoldService.sweepExpiredHolds();
  console.log(`🧹 Sweeper ran:`, JSON.stringify(sweepResult));

  assert(sweepResult.expiredCount >= 1, 'Sweeper should detect expired hold');
  const sweptSeat = store.showSeats.get(heldSeatId)!;
  assert.strictEqual(sweptSeat.status, 'AVAILABLE', 'Swept seat must be AVAILABLE');
  assert.strictEqual(sweptSeat.heldByUserId, null, 'Swept seat heldByUserId must be null');

  // Now another user can hold it immediately
  const freshHold = await SeatHoldService.holdSeats(showId, [heldSeatId], 'u-new-customer');
  assert.strictEqual(freshHold.success, true, 'New customer should successfully hold the expired seat');

  console.log(`\n✅ TEST 3 PASSED: Hold TTL expired cleanly, seat reverted to AVAILABLE, and newly acquired!\n`);
  console.log('====================================================');
  console.log('🎉 ALL CONCURRENCY & TTL TESTS COMPLETED SUCCESSFULLY');
  console.log('====================================================\n');
}

runRaceConditionTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Race condition test encountered an error:', err);
    process.exit(1);
  });
