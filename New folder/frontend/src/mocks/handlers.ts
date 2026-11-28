import { http, HttpResponse, graphql } from 'msw';

// In-memory mock database
const mockUsers = [
  {
    userId: 'USR101',
    name: 'Ramesh Patel',
    email: 'ramesh@agrirent.in',
    phone: '9876543210',
    role: 'USER',
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    userId: 'USR102',
    name: 'Suresh Kumar',
    email: 'suresh@agrirent.in',
    phone: '9876543211',
    role: 'USER',
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-12T10:00:00Z',
  },
  {
    userId: 'ADM001',
    name: 'AgriRent Support Admin',
    email: 'admin@agrirent.in',
    phone: '9876543299',
    role: 'ADMIN',
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    createdAt: '2026-01-01T10:00:00Z',
  },
];

const mockEquipmentList = [
  {
    equipmentId: 'EQ201',
    ownerId: 'USR101',
    title: 'Mahindra 575 DI 45HP Tractor',
    category: 'TRACTOR',
    condition: 'EXCELLENT',
    pricing: { perDay: 2500, securityDeposit: 5000 },
    location: { address: 'Village Mogar', district: 'Anand', state: 'Gujarat', pincode: '388001' },
    specs: { hp: 45, fuelType: 'DIESEL' },
    photos: ['https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=600&q=80'],
    status: 'AVAILABLE',
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    equipmentId: 'EQ202',
    ownerId: 'USR102',
    title: 'Preet 987 Self-Propelled Combine Harvester',
    category: 'HARVESTER',
    condition: 'EXCELLENT',
    pricing: { perDay: 9500, securityDeposit: 15000 },
    location: { address: 'Karnal Bypass', district: 'Karnal', state: 'Haryana', pincode: '132001' },
    specs: { hp: 101, fuelType: 'DIESEL' },
    photos: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80'],
    status: 'AVAILABLE',
    createdAt: '2026-02-05T10:00:00Z',
  },
  {
    equipmentId: 'EQ203',
    ownerId: 'USR101',
    title: 'Shaktiman 7-Feet Regular Light Rotary Tiller',
    category: 'TILLER',
    condition: 'GOOD',
    pricing: { perDay: 1800, securityDeposit: 3500 },
    location: { address: 'Station Road', district: 'Anand', state: 'Gujarat', pincode: '388001' },
    specs: { hp: 40, fuelType: 'DIESEL' },
    photos: ['https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=600&q=80'],
    status: 'AVAILABLE',
    createdAt: '2026-02-08T10:00:00Z',
  },
];

let mockBookings: any[] = [
  {
    bookingId: 'BK301',
    renterId: 'USR102',
    ownerId: 'USR101',
    equipmentId: 'EQ201',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    status: 'PENDING_OWNER',
    rentalAmount: 5000,
    platformFee: 250,
    securityDeposit: 5000,
    totalAmount: 10250,
    currency: 'INR',
    createdAt: new Date().toISOString(),
  },
];

let mockKYCSubmissions: any[] = [
  {
    kycId: 'KYC901',
    userId: 'USR102',
    documentType: 'AADHAAR',
    documentReference: 'XXXX-XXXX-9842',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];

let mockClaims: any[] = [];
let mockReviews: any[] = [
  {
    reviewId: 'REV701',
    bookingId: 'BK300',
    reviewerId: 'USR102',
    targetUserId: 'USR101',
    rating: 5,
    feedback: 'Tractor was delivered in top condition with full tank. Very honest owner!',
    status: 'PUBLISHED',
    createdAt: '2026-02-15T12:00:00Z',
  },
];

// Helper to make test JWT
const createMockJwt = (user: any) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      userId: user.userId,
      role: user.role,
      kycStatus: user.kycStatus,
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  );
  return `${header}.${payload}.mockSignature`;
};

export const handlers = [
  // 1. Identity & KYC
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body: any = await request.json();
    const user = mockUsers.find(
      (u) => u.email === body.identifier || u.phone === body.identifier
    ) || mockUsers[0];

    const token = createMockJwt(user);
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: 86400,
        user,
      },
    });
  }),

  http.post('*/api/v1/auth/register', async ({ request }) => {
    const body: any = await request.json();
    const newUser = {
      userId: `USR${Math.floor(100 + Math.random() * 900)}`,
      name: body.name || 'New Farmer',
      email: body.email,
      phone: body.phone,
      role: body.role || 'USER',
      status: 'ACTIVE',
      kycStatus: 'NOT_SUBMITTED',
      createdAt: new Date().toISOString(),
    };
    mockUsers.push(newUser);
    const token = createMockJwt(newUser);
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: 86400,
        user: newUser,
      },
    });
  }),

  http.get('*/api/v1/auth/me', () => {
    return HttpResponse.json({
      success: true,
      data: mockUsers[0],
    });
  }),

  http.post('*/api/v1/kyc/submit', async ({ request }) => {
    const body: any = await request.json();
    const sub = {
      kycId: `KYC${Math.floor(100 + Math.random() * 900)}`,
      userId: 'USR101',
      documentType: body.documentType,
      documentReference: 'XXXX-XXXX-' + body.documentReference.slice(-4),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    mockKYCSubmissions.push(sub);
    return HttpResponse.json({ success: true, data: sub });
  }),

  http.get('*/api/v1/kyc/me', () => {
    return HttpResponse.json({
      success: true,
      data: mockKYCSubmissions[0] || {
        kycId: 'KYC901',
        userId: 'USR101',
        documentType: 'AADHAAR',
        documentReference: 'XXXX-XXXX-9842',
        status: 'VERIFIED',
      },
    });
  }),

  http.get('*/api/v1/kyc/admin/pending', () => {
    return HttpResponse.json({
      success: true,
      data: mockKYCSubmissions.filter((k) => k.status === 'PENDING'),
    });
  }),

  http.patch('*/api/v1/kyc/admin/:id/approve', ({ params }) => {
    const sub = mockKYCSubmissions.find((k) => k.kycId === params.id);
    if (sub) sub.status = 'VERIFIED';
    return HttpResponse.json({ success: true, data: sub });
  }),

  http.patch('*/api/v1/kyc/admin/:id/reject', async ({ params, request }) => {
    const body: any = await request.json();
    const sub = mockKYCSubmissions.find((k) => k.kycId === params.id);
    if (sub) {
      sub.status = 'REJECTED';
      sub.rejectionReason = body.reason;
    }
    return HttpResponse.json({ success: true, data: sub });
  }),

  http.get('*/api/v1/admin/users/:userId', ({ params }) => {
    const user = mockUsers.find((u) => u.userId === params.userId) || mockUsers[0];
    return HttpResponse.json({ success: true, data: user });
  }),

  http.patch('*/api/v1/admin/users/:userId/block', ({ params }) => {
    const user = mockUsers.find((u) => u.userId === params.userId);
    if (user) user.status = 'BLOCKED';
    return HttpResponse.json({ success: true, data: { message: 'User blocked' } });
  }),

  http.patch('*/api/v1/admin/users/:userId/restore', ({ params }) => {
    const user = mockUsers.find((u) => u.userId === params.userId);
    if (user) user.status = 'ACTIVE';
    return HttpResponse.json({ success: true, data: { message: 'User restored' } });
  }),

  // 2. Equipment
  http.get('*/api/v1/equipment/my-equipment', () => {
    return HttpResponse.json({
      success: true,
      count: mockEquipmentList.length,
      data: mockEquipmentList,
    });
  }),

  http.get('*/api/v1/equipment/:id/availability', () => {
    return HttpResponse.json({ success: true, data: { isAvailable: true } });
  }),

  http.get('*/api/v1/equipment/:id', ({ params }) => {
    const eq = mockEquipmentList.find((e) => e.equipmentId === params.id) || mockEquipmentList[0];
    return HttpResponse.json({ success: true, data: eq });
  }),

  http.get('*/api/v1/equipment', () => {
    return HttpResponse.json({
      success: true,
      count: mockEquipmentList.length,
      total: mockEquipmentList.length,
      data: mockEquipmentList,
    });
  }),

  http.post('*/api/v1/equipment', async ({ request }) => {
    const body: any = await request.json();
    const newEq = {
      equipmentId: `EQ${Math.floor(200 + Math.random() * 800)}`,
      ownerId: 'USR101',
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      ...body,
    };
    mockEquipmentList.push(newEq);
    return HttpResponse.json({ success: true, data: newEq });
  }),

  http.patch('*/api/v1/equipment/:id', async ({ params, request }) => {
    const body: any = await request.json();
    const eq = mockEquipmentList.find((e) => e.equipmentId === params.id);
    if (eq) Object.assign(eq, body);
    return HttpResponse.json({ success: true, data: eq });
  }),

  http.delete('*/api/v1/equipment/:id', ({ params }) => {
    const idx = mockEquipmentList.findIndex((e) => e.equipmentId === params.id);
    if (idx !== -1) mockEquipmentList.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  // 3. Booking
  http.get('*/api/v1/bookings/availability', () => {
    return HttpResponse.json({ success: true, data: { available: true } });
  }),

  http.get('*/api/v1/bookings/my-bookings', () => {
    return HttpResponse.json({ success: true, data: { bookings: mockBookings } });
  }),

  http.get('*/api/v1/bookings/owner/requests', () => {
    return HttpResponse.json({ success: true, data: { bookings: mockBookings } });
  }),

  http.get('*/api/v1/bookings/:id', ({ params }) => {
    const b = mockBookings.find((item) => item.bookingId === params.id) || mockBookings[0];
    return HttpResponse.json({ success: true, data: { booking: b } });
  }),

  http.post('*/api/v1/bookings', async ({ request }) => {
    const body: any = await request.json();
    const newBooking = {
      bookingId: `BK${Math.floor(300 + Math.random() * 700)}`,
      renterId: 'USR102',
      ownerId: 'USR101',
      equipmentId: body.equipmentId,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'PENDING_OWNER',
      rentalAmount: 5000,
      platformFee: 250,
      securityDeposit: 5000,
      totalAmount: 10250,
      currency: 'INR',
      createdAt: new Date().toISOString(),
    };
    mockBookings.push(newBooking);
    return HttpResponse.json({ success: true, data: { booking: newBooking } });
  }),

  http.patch('*/api/v1/bookings/:id/approve', ({ params }) => {
    const b = mockBookings.find((item) => item.bookingId === params.id);
    if (b) b.status = 'APPROVED';
    return HttpResponse.json({ success: true, data: b });
  }),

  http.patch('*/api/v1/bookings/:id/reject', async ({ params, request }) => {
    const body: any = await request.json();
    const b = mockBookings.find((item) => item.bookingId === params.id);
    if (b) {
      b.status = 'REJECTED';
      b.rejectionReason = body.reason;
    }
    return HttpResponse.json({ success: true, data: b });
  }),

  http.patch('*/api/v1/bookings/:id/cancel', async ({ params, request }) => {
    const body: any = await request.json();
    const b = mockBookings.find((item) => item.bookingId === params.id);
    if (b) {
      b.status = 'CANCELLED';
      b.cancelReason = body.reason;
    }
    return HttpResponse.json({ success: true, data: b });
  }),

  // 4. Payment
  http.post('*/v1/payments', async ({ request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      paymentId: `PAY-${Date.now()}`,
      bookingId: body.bookingId,
      status: 'PENDING_VERIFICATION',
      gateway: 'simulator',
      amount: 10250,
      currency: 'INR',
    });
  }),

  http.post('*/v1/payments/:id/verifications', async ({ params, request }) => {
    const body: any = await request.json();
    const isFail = body.gatewayTransactionReference?.includes('FAIL');

    if (isFail) {
      return HttpResponse.json({
        paymentId: params.id,
        status: 'FAILED',
        depositHoldId: '',
      });
    }

    // Mark corresponding booking PAID
    if (mockBookings[0]) {
      mockBookings[0].status = 'PAID';
    }

    return HttpResponse.json({
      paymentId: params.id,
      status: 'CONFIRMED',
      depositHoldId: `DEP-${Date.now()}`,
    });
  }),

  http.get('*/v1/bookings/:id/payment-status', ({ params }) => {
    const b = mockBookings.find((item) => item.bookingId === params.id);
    const isPaid = b?.status && ['PAID', 'IN_RENTAL', 'RETURNED', 'COMPLETED'].includes(b.status);
    return HttpResponse.json({
      bookingId: params.id,
      paymentStatus: isPaid ? 'CONFIRMED' : 'PENDING_VERIFICATION',
      depositStatus: isPaid ? 'HELD' : 'PENDING',
      depositHoldAmount: 5000,
    });
  }),

  // 5. Handover & Return
  http.post('*/v1/bookings/:id/handover-pins', () => {
    return HttpResponse.json({
      pinId: `PIN-${Date.now()}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      dev_pin: '839201',
    });
  }),

  http.post('*/v1/bookings/:id/return-pins', () => {
    return HttpResponse.json({
      pinId: `PIN-${Date.now()}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      dev_pin: '492810',
    });
  }),

  http.post('*/v1/bookings/:id/handovers', ({ params }) => {
    const b = mockBookings.find((item) => item.bookingId === params.id);
    if (b) b.status = 'IN_RENTAL';
    return HttpResponse.json({
      handoverId: `HO-${Date.now()}`,
      status: 'HANDED_OVER',
      handedOverAt: new Date().toISOString(),
    });
  }),

  http.post('*/v1/bookings/:id/returns', ({ params }) => {
    const b = mockBookings.find((item) => item.bookingId === params.id);
    if (b) b.status = 'RETURNED';
    return HttpResponse.json({
      returnId: `RET-${Date.now()}`,
      status: 'RETURNED',
      returnedAt: new Date().toISOString(),
      lateFine: { fineAmount: 0, overdueHours: 0 },
    });
  }),

  http.get('*/v1/bookings/:id/late-fine', () => {
    return HttpResponse.json({
      bookingId: 'BK301',
      isOverdue: false,
      overdueHours: 0,
      billableOverdueDays: 0,
      dailyOverdueRate: 2500,
      fineAmount: 0,
    });
  }),

  // 6. Claims & Reviews
  http.post('*/v1/bookings/:id/claims', async ({ params, request }) => {
    const body: any = await request.json();
    const claim = {
      claimId: `CLM${Math.floor(400 + Math.random() * 600)}`,
      bookingId: params.id,
      claimantId: 'USR101',
      reason: body.reason,
      claimedAmount: body.claimedAmount,
      status: 'OPEN',
      evidence: [{ photos: body.evidence?.photos || [], notes: body.evidence?.notes }],
      createdAt: new Date().toISOString(),
    };
    mockClaims.push(claim);
    return HttpResponse.json(claim);
  }),

  http.get('*/v1/claims', () => {
    return HttpResponse.json({
      items: mockClaims.length > 0 ? mockClaims : [
        {
          claimId: 'CLM401',
          bookingId: 'BK301',
          claimantId: 'USR101',
          reason: 'Hydraulic cylinder damaged during field plowing',
          claimedAmount: 3200,
          status: 'OPEN',
          evidence: [
            {
              photos: ['https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=600&q=80'],
              notes: 'Bent rod on secondary cylinder',
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
      hasMore: false,
    });
  }),

  http.post('*/v1/claims/:id/decisions', async ({ params, request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      decisionId: `DEC-${Date.now()}`,
      claimId: params.id,
      decision: body.decision,
      approvedAmount: body.approvedAmount,
      reason: body.reason,
      decidedBy: 'ADM001',
      decidedAt: new Date().toISOString(),
    });
  }),

  http.post('*/v1/claims/:id/disputes', async ({ params, request }) => {
    const body: any = await request.json();
    return HttpResponse.json({
      disputeId: `DSP-${Date.now()}`,
      claimId: params.id,
      status: 'OPEN',
      reason: body.reason,
      createdAt: new Date().toISOString(),
    });
  }),

  http.post('*/v1/bookings/:id/claim-waivers', ({ params }) => {
    return HttpResponse.json({
      bookingId: params.id,
      status: 'WAIVED',
      waivedAt: new Date().toISOString(),
    });
  }),

  http.post('*/v1/bookings/:id/reviews', async ({ params, request }) => {
    const body: any = await request.json();
    const rev = {
      reviewId: `REV${Math.floor(700 + Math.random() * 300)}`,
      bookingId: params.id,
      reviewerId: 'USR102',
      targetUserId: body.targetUserId,
      rating: body.rating,
      feedback: body.feedback,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
    };
    mockReviews.push(rev);
    return HttpResponse.json(rev);
  }),

  http.get('*/v1/reviews', () => {
    return HttpResponse.json({ items: mockReviews, hasMore: false });
  }),

  http.get('*/v1/users/:id/review-summary', () => {
    return HttpResponse.json({
      userId: 'USR101',
      averageRating: 4.8,
      reviewCount: 14,
    });
  }),

  http.get('*/v1/bookings/:id/settlement-status', ({ params }) => {
    return HttpResponse.json({
      bookingId: params.id,
      caseStatus: 'SETTLED',
      windowClosed: true,
      depositHeld: 5000,
      lateFine: 0,
      totalDamageDeduction: 0,
      claimsCount: mockClaims.length,
      openClaimsCount: 0,
      openDisputesCount: 0,
      eligibleForSettlement: true,
      evaluatedAt: new Date().toISOString(),
    });
  }),

  // 7. GraphQL endpoint
  http.post('*/graphql', async ({ request }) => {
    return HttpResponse.json({
      data: {
        bookingOverview: {
          bookingId: 'BK301',
          settlementStatus: {
            bookingId: 'BK301',
            caseStatus: 'SETTLED',
            windowClosed: true,
            claimWindowClosesAt: '2026-11-05T18:00:00Z',
            waivedAt: null,
            depositHeld: 5000,
            lateFine: 0,
            totalDamageDeduction: 0,
            claimsCount: mockClaims.length,
            openClaimsCount: 0,
            openDisputesCount: 0,
            eligibleForSettlement: true,
            evaluatedAt: new Date().toISOString(),
          },
          claims: mockClaims.length > 0 ? mockClaims : [],
          reviews: mockReviews,
        },
      },
    });
  }),
];
