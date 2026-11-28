import { apiFetch } from './client';
import { API_CONFIG } from './config';
import { Booking } from './types';

export const bookingApi = {
  async createBooking(
    payload: { equipmentId: string; startDate: string; endDate: string },
    idempotencyKey?: string
  ): Promise<Booking> {
    const res = await apiFetch<{ success: boolean; data: { booking: Booking } | Booking }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    const data = res.data as any;
    return data.booking || data;
  },

  async checkAvailability(
    equipmentId: string,
    startDate: string,
    endDate: string
  ): Promise<{ available: boolean }> {
    const query = new URLSearchParams({ equipmentId, startDate, endDate });
    const res = await apiFetch<{ success: boolean; data: { available: boolean } }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings/availability?${query.toString()}`,
      { method: 'GET', skipAuth: true }
    );
    return res.data;
  },

  async getMyBookings(): Promise<Booking[]> {
    const res = await apiFetch<{ success: boolean; data: { bookings?: Booking[] } | Booking[] }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings/my-bookings`,
      { method: 'GET' }
    );
    const data = res.data as any;
    return data.bookings || (Array.isArray(data) ? data : []);
  },

  async getOwnerRequests(): Promise<Booking[]> {
    const res = await apiFetch<{ success: boolean; data: { bookings?: Booking[] } | Booking[] }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings/owner/requests`,
      { method: 'GET' }
    );
    const data = res.data as any;
    return data.bookings || (Array.isArray(data) ? data : []);
  },

  async getBookingById(bookingId: string): Promise<Booking> {
    const res = await apiFetch<{ success: boolean; data: { booking?: Booking } | Booking }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings/${encodeURIComponent(bookingId)}`,
      { method: 'GET' }
    );
    const data = res.data as any;
    return data.booking || data;
  },

  async approveBooking(bookingId: string): Promise<Booking> {
    const res = await apiFetch<{ success: boolean; data: Booking }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings/${encodeURIComponent(bookingId)}/approve`,
      {
        method: 'PATCH',
        body: JSON.stringify({}),
      }
    );
    return res.data;
  },

  async rejectBooking(bookingId: string, reason: string): Promise<Booking> {
    const res = await apiFetch<{ success: boolean; data: Booking }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings/${encodeURIComponent(bookingId)}/reject`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },

  async cancelBooking(bookingId: string, reason: string): Promise<Booking> {
    const res = await apiFetch<{ success: boolean; data: Booking }>(
      `${API_CONFIG.booking.baseUrl}/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },
};
