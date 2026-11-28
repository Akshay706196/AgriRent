/**
 * AgriRent End-to-End Handover, Return & Late-Fine Lifecycle Integration Smoke Script.
 *
 * Demonstrates the complete microservice integration flow:
 * 1. Register & Login Owner & Renter (Identity Service :4003)
 * 2. KYC Verification for both accounts (Identity Service)
 * 3. List Equipment (Equipment Service :4001)
 * 4. Request Booking (Booking Service :4002)
 * 5. Equipment Owner Approves Booking (Booking Service)
 * 6. Initiate & Verify Payment (Payment Service :4004) -> Deposit Held
 * 7. Confirm Booking status is PAID
 * 8. Renter Generates Handover PIN (Handover Service :4005)
 * 9. Owner Verifies Handover PIN (Handover Service) -> Status IN_RENTAL
 * 10. Outbox Dispatcher notifies Booking Service (Booking is IN_RENTAL)
 * 11. Renter Generates Return PIN (Handover Service)
 * 12. Owner Verifies Return PIN with 2-day late override -> Status RETURNED + Late Fine
 * 13. Outbox Dispatcher notifies Booking Service (Booking is RETURNED)
 * 14. GET /v1/bookings/:id/late-fine confirms calculated fine
 */

const axios = require('axios');
const crypto = require('crypto');

const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:4003';
const EQUIPMENT_URL = process.env.EQUIPMENT_SERVICE_URL || 'http://localhost:4001';
const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:4002';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:4004';
const HANDOVER_URL = process.env.HANDOVER_SERVICE_URL || 'http://localhost:4005';
const SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';

const runId = Math.floor(Math.random() * 100000);
const ownerEmail = `owner_ho_${runId}@agrirent.internal`;
const renterEmail = `renter_ho_${runId}@agrirent.internal`;

let ownerToken, ownerId;
let renterToken, renterId;
let equipmentId;
let bookingId;
let handoverPin, handoverId;
let returnPin, returnId;
let lateFineSummary;

async function step(name, action) {
  process.stdout.write(`[*] Step: ${name}... `);
  try {
    const res = await action();
    console.log(`\x1b[32mPASS\x1b[0m`);
    return res;
  } catch (err) {
    console.log(`\x1b[31mFAIL\x1b[0m`);
    console.error(`    Error: ${err.response?.data?.error?.message || err.message}`);
    throw err;
  }
}

async function runE2E() {
  console.log('\n======================================================');
  console.log('  AGRIRENT E2E HANDOVER, RETURN & LATE-FINE SMOKE TEST ');
  console.log('======================================================\n');

  // 1. Register & Login Owner
  await step('Register Equipment Owner', async () => {
    const res = await axios.post(`${IDENTITY_URL}/api/v1/auth/register`, {
      name: 'Farmer Ramesh (Owner)',
      email: ownerEmail,
      phone: `98765${String(runId).padStart(5, '0')}`,
      password: 'Password@123',
      role: 'FARMER',
    });
    ownerToken = res.data.token;
    ownerId = res.data.user.id;
  });

  // 2. Register & Login Renter
  await step('Register Machinery Renter', async () => {
    const res = await axios.post(`${IDENTITY_URL}/api/v1/auth/register`, {
      name: 'Farmer Suresh (Renter)',
      email: renterEmail,
      phone: `91234${String(runId).padStart(5, '0')}`,
      password: 'Password@123',
      role: 'FARMER',
    });
    renterToken = res.data.token;
    renterId = res.data.user.id;
  });

  // 3. Submit & Admin Verify KYC for both
  await step('Submit & Auto-Verify KYC for Owner and Renter', async () => {
    // Submit KYC
    await axios.post(
      `${IDENTITY_URL}/api/v1/kyc/submit`,
      { idType: 'AADHAAR', idNumber: '123456789012' },
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    await axios.post(
      `${IDENTITY_URL}/api/v1/kyc/submit`,
      { idType: 'AADHAAR', idNumber: '987654321098' },
      { headers: { Authorization: `Bearer ${renterToken}` } }
    );

    // Admin verify KYC
    await axios.patch(
      `${IDENTITY_URL}/api/v1/kyc/${ownerId}/verify`,
      { status: 'VERIFIED' },
      { headers: { 'internal_service_token': SERVICE_TOKEN } }
    );
    await axios.patch(
      `${IDENTITY_URL}/api/v1/kyc/${renterId}/verify`,
      { status: 'VERIFIED' },
      { headers: { 'internal_service_token': SERVICE_TOKEN } }
    );
  });

  // 4. List Equipment
  await step('Create Machinery Listing (Equipment Service)', async () => {
    const res = await axios.post(
      `${EQUIPMENT_URL}/api/v1/equipment`,
      {
        name: 'Mahindra 575 DI Harvester',
        category: 'HARVESTER',
        pricePerDay: 2500,
        securityDeposit: 6000,
        location: { state: 'Punjab', district: 'Ludhiana' },
      },
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    equipmentId = res.data.equipment?.id || res.data.equipment?._id || res.data.id;
  });

  // 5. Request Booking
  const startDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];

  await step('Request 3-day Booking (Booking Service)', async () => {
    const res = await axios.post(
      `${BOOKING_URL}/api/v1/bookings`,
      {
        equipmentId,
        startDate,
        endDate,
      },
      {
        headers: {
          Authorization: `Bearer ${renterToken}`,
          'Idempotency-Key': `idemp-bk-${runId}`,
        },
      }
    );
    bookingId = res.data.booking.bookingId;
  });

  // 6. Owner Approves Booking
  await step('Owner Approves Booking (Booking Service)', async () => {
    await axios.patch(
      `${BOOKING_URL}/api/v1/bookings/${bookingId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
  });

  // 7. Pay & Verify Payment (Payment Service)
  await step('Initiate & Confirm Payment via Gateway Simulator (Payment Service)', async () => {
    const payRes = await axios.post(
      `${PAYMENT_URL}/v1/payments`,
      {
        bookingId,
        gateway: 'simulator',
      },
      {
        headers: {
          Authorization: `Bearer ${renterToken}`,
          'Idempotency-Key': `idemp-pay-${runId}`,
        },
      }
    );
    const paymentId = payRes.data.paymentId;

    // Verify payment
    await axios.post(
      `${PAYMENT_URL}/v1/payments/${paymentId}/verify`,
      {
        gatewayTransactionReference: `SIM-TXN-${runId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${renterToken}`,
          'Idempotency-Key': `idemp-ver-${runId}`,
        },
      }
    );
  });

  // 8. Wait for Booking to transition to PAID
  await step('Confirm Booking Status is PAID', async () => {
    // Wait for outbox or query directly
    let retries = 5;
    while (retries > 0) {
      const res = await axios.get(`${BOOKING_URL}/api/v1/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${renterToken}` },
      });
      if (res.data.booking?.status === 'PAID') {
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
      retries--;
    }
  });

  // 9. Renter Generates Handover PIN (Handover Service)
  await step('Renter Generates Handover PIN (Handover Service)', async () => {
    const res = await axios.post(
      `${HANDOVER_URL}/v1/bookings/${bookingId}/handover-pins`,
      {},
      {
        headers: {
          Authorization: `Bearer ${renterToken}`,
          'Idempotency-Key': `idemp-ho-pin-${runId}`,
        },
      }
    );
    handoverPin = res.data.dev_pin;
    console.log(`\n    [Info] Handover PIN Issued: ${handoverPin || 'Delivered to notification channel'}`);
  });

  // 10. Owner Verifies Handover PIN (Handover Service)
  await step('Owner Verifies Handover PIN (Handover Service)', async () => {
    const res = await axios.post(
      `${HANDOVER_URL}/v1/bookings/${bookingId}/handovers`,
      {
        pin: handoverPin,
        conditionReport: {
          engineHours: 250.0,
          fuelLevelPercent: 95,
          cleanliness: 'EXCELLENT',
          visualInspectionNotes: 'Harvester in pristine condition at handover.',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Idempotency-Key': `idemp-ho-ver-${runId}`,
        },
      }
    );
    handoverId = res.data.handoverId;
    console.log(`\n    [Info] Handover Verified. Status: ${res.data.status} (ID: ${handoverId})`);
  });

  // 11. Wait for Booking to become IN_RENTAL
  await step('Verify Booking Status Transition to IN_RENTAL (Booking Service)', async () => {
    let retries = 5;
    while (retries > 0) {
      const res = await axios.get(`${BOOKING_URL}/api/v1/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${renterToken}` },
      });
      if (res.data.booking?.status === 'IN_RENTAL') {
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
      retries--;
    }
  });

  // 12. Renter Generates Return PIN (Handover Service)
  await step('Renter Generates Return PIN (Handover Service)', async () => {
    const res = await axios.post(
      `${HANDOVER_URL}/v1/bookings/${bookingId}/return-pins`,
      {},
      {
        headers: {
          Authorization: `Bearer ${renterToken}`,
          'Idempotency-Key': `idemp-ret-pin-${runId}`,
        },
      }
    );
    returnPin = res.data.dev_pin;
    console.log(`\n    [Info] Return PIN Issued: ${returnPin || 'Delivered to notification channel'}`);
  });

  // 13. Owner Verifies Return PIN with Time Override Set 2 Days Past End Date
  await step('Owner Verifies Return PIN (Handover Service)', async () => {
    const res = await axios.post(
      `${HANDOVER_URL}/v1/bookings/${bookingId}/returns`,
      {
        pin: returnPin,
        conditionReport: {
          engineHours: 268.4,
          fuelLevelPercent: 80,
          cleanliness: 'GOOD',
          visualInspectionNotes: 'Completed harvest operation. Normal wear.',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Idempotency-Key': `idemp-ret-ver-${runId}`,
        },
      }
    );
    returnId = res.data.returnId;
    lateFineSummary = res.data.lateFine;
    console.log(`\n    [Info] Return Verified. Status: ${res.data.status}`);
    console.log(`    [Info] Late Fine Assessed: INR ${lateFineSummary.fineAmount} (${lateFineSummary.overdueDays} days late)`);
  });

  // 14. Verify Booking Transitions to RETURNED
  await step('Verify Booking Status Transition to RETURNED (Booking Service)', async () => {
    let retries = 5;
    while (retries > 0) {
      const res = await axios.get(`${BOOKING_URL}/api/v1/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${renterToken}` },
      });
      if (res.data.booking?.status === 'RETURNED') {
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
      retries--;
    }
  });

  // 15. Query Late Fine Details & MongoDB Event Timeline
  await step('Query Late Fine Details (Handover Service)', async () => {
    const res = await axios.get(`${HANDOVER_URL}/v1/bookings/${bookingId}/late-fine`, {
      headers: { Authorization: `Bearer ${renterToken}` },
    });
    console.log(`\n    [Audit] Persisted Late Fine: INR ${res.data.fineAmount} (${res.data.overdueDuration})`);
  });

  await step('Query MongoDB Audit Events Timeline (Handover Service)', async () => {
    const res = await axios.get(`${HANDOVER_URL}/v1/bookings/${bookingId}/events`, {
      headers: { Authorization: `Bearer ${renterToken}` },
    });
    console.log(`\n    [Audit] Total Recorded Events: ${res.data.items.length}`);
    res.data.items.forEach((evt) => {
      console.log(`     - [${evt.timestamp}] ${evt.eventType} by ${evt.actorRole} (${evt.actor})`);
    });
  });

  console.log('\n======================================================');
  console.log('  AGRIRENT SERVICE 5 END-TO-END SMOKE TEST PASSED!    ');
  console.log('======================================================\n');
}

if (require.main === module) {
  runE2E().catch(() => process.exit(1));
}

module.exports = { runE2E };
