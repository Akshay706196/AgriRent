import { apiFetch } from './client';
import { API_CONFIG } from './config';
import {
  DamageClaim,
  Dispute,
  ClaimDecision,
  Review,
  ReviewSummary,
  SettlementStatusInfo,
} from './types';

export const claimsApi = {
  async submitClaim(
    bookingId: string,
    payload: { reason: string; claimedAmount: number; evidence: { photos: string[]; notes?: string } },
    idempotencyKey?: string
  ): Promise<DamageClaim> {
    const res = await apiFetch<DamageClaim>(
      `${API_CONFIG.claims.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/claims`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    return res;
  },

  async getClaim(claimId: string): Promise<DamageClaim> {
    const res = await apiFetch<DamageClaim>(
      `${API_CONFIG.claims.baseUrl}/v1/claims/${encodeURIComponent(claimId)}`,
      { method: 'GET' }
    );
    return res;
  },

  async listClaims(params: { bookingId?: string; status?: string; limit?: number; cursor?: string } = {}): Promise<{ items: DamageClaim[]; nextCursor?: string; hasMore: boolean }> {
    const q = new URLSearchParams();
    if (params.bookingId) q.set('bookingId', params.bookingId);
    if (params.status) q.set('status', params.status);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);

    const res = await apiFetch<{ items: DamageClaim[]; nextCursor?: string; hasMore: boolean }>(
      `${API_CONFIG.claims.baseUrl}/v1/claims${q.toString() ? `?${q.toString()}` : ''}`,
      { method: 'GET' }
    );
    return res;
  },

  async addEvidence(
    claimId: string,
    payload: { photos: string[]; notes?: string },
    idempotencyKey?: string
  ): Promise<any> {
    const res = await apiFetch(
      `${API_CONFIG.claims.baseUrl}/v1/claims/${encodeURIComponent(claimId)}/evidence-items`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    return res;
  },

  async raiseDispute(
    claimId: string,
    payload: { reason: string; evidence?: { photos?: string[]; notes?: string } },
    idempotencyKey?: string
  ): Promise<Dispute> {
    const res = await apiFetch<Dispute>(
      `${API_CONFIG.claims.baseUrl}/v1/claims/${encodeURIComponent(claimId)}/disputes`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    return res;
  },

  async getDispute(disputeId: string): Promise<Dispute> {
    const res = await apiFetch<Dispute>(
      `${API_CONFIG.claims.baseUrl}/v1/disputes/${encodeURIComponent(disputeId)}`,
      { method: 'GET' }
    );
    return res;
  },

  async reviewClaimDecision(
    claimId: string,
    payload: { decision: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'; approvedAmount: number; reason: string },
    idempotencyKey?: string
  ): Promise<ClaimDecision> {
    const res = await apiFetch<ClaimDecision>(
      `${API_CONFIG.claims.baseUrl}/v1/claims/${encodeURIComponent(claimId)}/decisions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    return res;
  },

  async submitReview(
    bookingId: string,
    payload: { targetUserId: string; rating: number; feedback: string },
    idempotencyKey?: string
  ): Promise<Review> {
    const res = await apiFetch<Review>(
      `${API_CONFIG.claims.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    return res;
  },

  async listReviews(params: { targetUserId?: string; bookingId?: string; limit?: number; cursor?: string } = {}): Promise<{ items: Review[]; nextCursor?: string; hasMore: boolean }> {
    const q = new URLSearchParams();
    if (params.targetUserId) q.set('targetUserId', params.targetUserId);
    if (params.bookingId) q.set('bookingId', params.bookingId);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);

    const res = await apiFetch<{ items: Review[]; nextCursor?: string; hasMore: boolean }>(
      `${API_CONFIG.claims.baseUrl}/v1/reviews${q.toString() ? `?${q.toString()}` : ''}`,
      { method: 'GET' }
    );
    return res;
  },

  async getReviewSummary(userId: string): Promise<ReviewSummary> {
    const res = await apiFetch<ReviewSummary>(
      `${API_CONFIG.claims.baseUrl}/v1/users/${encodeURIComponent(userId)}/review-summary`,
      { method: 'GET' }
    );
    return res;
  },

  async waiveClaims(bookingId: string, idempotencyKey?: string): Promise<{ bookingId: string; status: string; waivedAt: string }> {
    const res = await apiFetch<{ bookingId: string; status: string; waivedAt: string }>(
      `${API_CONFIG.claims.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/claim-waivers`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        idempotencyKey,
      }
    );
    return res;
  },

  async getSettlementStatus(bookingId: string): Promise<SettlementStatusInfo> {
    const res = await apiFetch<SettlementStatusInfo>(
      `${API_CONFIG.claims.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/settlement-status`,
      { method: 'GET' }
    );
    return res;
  },
};
