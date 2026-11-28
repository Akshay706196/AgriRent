import { apiFetch } from './client';
import { API_CONFIG } from './config';
import { PaymentOrder, PaymentStatusSummary, SettlementBreakdown } from './types';

export const paymentApi = {
  async initiatePayment(
    bookingId: string,
    idempotencyKey?: string,
    gateway: string = 'simulator'
  ): Promise<PaymentOrder> {
    const res = await apiFetch<PaymentOrder>(
      `${API_CONFIG.payment.baseUrl}/v1/payments`,
      {
        method: 'POST',
        body: JSON.stringify({ bookingId, gateway }),
        idempotencyKey,
      }
    );
    return res;
  },

  async verifyPayment(
    paymentId: string,
    gatewayTransactionReference: string,
    idempotencyKey?: string
  ): Promise<{ paymentId: string; status: string; depositHoldId: string }> {
    const res = await apiFetch<{ paymentId: string; status: string; depositHoldId: string }>(
      `${API_CONFIG.payment.baseUrl}/v1/payments/${encodeURIComponent(paymentId)}/verifications`,
      {
        method: 'POST',
        body: JSON.stringify({ gatewayTransactionReference }),
        idempotencyKey,
      }
    );
    return res;
  },

  async getPaymentStatus(bookingId: string): Promise<PaymentStatusSummary> {
    const res = await apiFetch<PaymentStatusSummary>(
      `${API_CONFIG.payment.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/payment-status`,
      { method: 'GET', skipAuth: true }
    );
    return res;
  },

  async getPaymentDetails(paymentId: string): Promise<PaymentOrder> {
    const res = await apiFetch<PaymentOrder>(
      `${API_CONFIG.payment.baseUrl}/v1/payments/${encodeURIComponent(paymentId)}`,
      { method: 'GET' }
    );
    return res;
  },

  async getSettlementDetails(bookingId: string, settlementId: string): Promise<SettlementBreakdown> {
    const res = await apiFetch<SettlementBreakdown>(
      `${API_CONFIG.payment.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/settlements/${encodeURIComponent(settlementId)}`,
      { method: 'GET' }
    );
    return res;
  },

  async getPaymentEvents(paymentId: string): Promise<{ items: any[] }> {
    const res = await apiFetch<{ items: any[] }>(
      `${API_CONFIG.payment.baseUrl}/v1/payments/${encodeURIComponent(paymentId)}/events`,
      { method: 'GET' }
    );
    return res;
  },
};
