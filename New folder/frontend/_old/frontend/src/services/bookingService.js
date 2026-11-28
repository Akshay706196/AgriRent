import { bookingApi } from './apiClient';

export const bookingService = {
  /**
   * Checks availability of equipment over [startDate, endDate).
   * Endpoint: GET /api/v1/bookings/availability
   */
  async checkAvailability(equipmentId, startDate, endDate) {
    const response = await bookingApi.get('/api/v1/bookings/availability', {
      params: { equipmentId, startDate, endDate },
    });
    // Returns { equipmentId, startDate, endDate, available, conflictingBookingsCount }
    return response.data;
  },

  /**
   * Creates a rental booking request.
   * Endpoint: POST /api/v1/bookings
   */
  async createBooking(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await bookingApi.post('/api/v1/bookings', payload, { headers });
    return response.data;
  },

  /**
   * Retrieves current renter's bookings.
   * Endpoint: GET /api/v1/bookings/my-bookings
   */
  async getMyBookings(params = {}) {
    const response = await bookingApi.get('/api/v1/bookings/my-bookings', { params });
    // Returns { data: [...], pagination: { total, page, limit, pages } }
    return response.data;
  },

  /**
   * Retrieves incoming requests for machinery owned by current user.
   * Endpoint: GET /api/v1/bookings/owner/requests
   */
  async getOwnerRequests(params = {}) {
    const response = await bookingApi.get('/api/v1/bookings/owner/requests', { params });
    return response.data;
  },

  /**
   * Retrieves booking details by bookingId.
   * Endpoint: GET /api/v1/bookings/:bookingId
   */
  async getBookingById(bookingId) {
    const response = await bookingApi.get(`/api/v1/bookings/${encodeURIComponent(bookingId)}`);
    return response.data;
  },

  /**
   * Owner approves a booking request.
   * Endpoint: PATCH /api/v1/bookings/:bookingId/approve
   */
  async approveBooking(bookingId) {
    const response = await bookingApi.patch(`/api/v1/bookings/${encodeURIComponent(bookingId)}/approve`);
    return response.data;
  },

  /**
   * Owner rejects a booking request with reason.
   * Endpoint: PATCH /api/v1/bookings/:bookingId/reject
   */
  async rejectBooking(bookingId, reason = '') {
    const response = await bookingApi.patch(`/api/v1/bookings/${encodeURIComponent(bookingId)}/reject`, { reason });
    return response.data;
  },

  /**
   * Cancels an eligible booking (Renter or Owner).
   * Endpoint: PATCH /api/v1/bookings/:bookingId/cancel
   */
  async cancelBooking(bookingId, reason = '') {
    const response = await bookingApi.patch(`/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel`, { reason });
    return response.data;
  },
};
