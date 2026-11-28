import { apiFetch } from './client';
import { API_CONFIG } from './config';
import { PinIssueResponse, ConditionReport, LateFineSummary, ConditionComparison } from './types';

export const handoverApi = {
  async generateHandoverPin(bookingId: string, idempotencyKey?: string): Promise<PinIssueResponse> {
    const res = await apiFetch<PinIssueResponse>(
      `${API_CONFIG.handover.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/handover-pins`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        idempotencyKey,
      }
    );
    return res;
  },

  async generateReturnPin(bookingId: string, idempotencyKey?: string): Promise<PinIssueResponse> {
    const res = await apiFetch<PinIssueResponse>(
      `${API_CONFIG.handover.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/return-pins`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        idempotencyKey,
      }
    );
    return res;
  },

  async verifyHandover(
    bookingId: string,
    pin: string,
    conditionReport?: ConditionReport,
    idempotencyKey?: string
  ): Promise<{ handoverId: string; status: string; handedOverAt: string }> {
    const res = await apiFetch<{ handoverId: string; status: string; handedOverAt: string }>(
      `${API_CONFIG.handover.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/handovers`,
      {
        method: 'POST',
        body: JSON.stringify({ pin, conditionReport }),
        idempotencyKey,
      }
    );
    return res;
  },

  async verifyReturn(
    bookingId: string,
    pin: string,
    conditionReport?: ConditionReport,
    idempotencyKey?: string
  ): Promise<{ returnId: string; status: string; returnedAt: string; lateFine: any }> {
    const res = await apiFetch<{ returnId: string; status: string; returnedAt: string; lateFine: any }>(
      `${API_CONFIG.handover.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/returns`,
      {
        method: 'POST',
        body: JSON.stringify({ pin, conditionReport }),
        idempotencyKey,
      }
    );
    return res;
  },

  async getLateFine(bookingId: string): Promise<LateFineSummary> {
    const res = await apiFetch<LateFineSummary>(
      `${API_CONFIG.handover.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/late-fine`,
      { method: 'GET' }
    );
    return res;
  },

  async getConditionReports(bookingId: string): Promise<ConditionComparison> {
    const res = await apiFetch<ConditionComparison>(
      `${API_CONFIG.handover.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/condition-reports`,
      { method: 'GET' }
    );
    return res;
  },

  async getHandoverEvents(bookingId: string): Promise<{ items: any[] }> {
    const res = await apiFetch<{ items: any[] }>(
      `${API_CONFIG.handover.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/events`,
      { method: 'GET' }
    );
    return res;
  },
};
