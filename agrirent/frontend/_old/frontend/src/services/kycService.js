import { identityApi } from './apiClient';

export const kycService = {
  /**
   * Submits KYC document verification request.
   * Endpoint: POST /api/v1/kyc/submit
   */
  async submitKyc(payload) {
    const response = await identityApi.post('/api/v1/kyc/submit', payload);
    return response.data?.data || response.data;
  },

  /**
   * Retrieves current authenticated user's KYC summary and latest submission.
   * Endpoint: GET /api/v1/kyc/me
   */
  async getOwnStatus() {
    const response = await identityApi.get('/api/v1/kyc/me');
    return response.data?.data || response.data;
  },

  /**
   * Retrieves user's KYC submission history.
   * Endpoint: GET /api/v1/kyc/me/history
   */
  async getOwnHistory(params = {}) {
    const response = await identityApi.get('/api/v1/kyc/me/history', { params });
    return response.data;
  },

  /**
   * Admin: lists pending KYC submissions.
   * Endpoint: GET /api/v1/kyc/admin/pending
   */
  async listPending(params = {}) {
    const response = await identityApi.get('/api/v1/kyc/admin/pending', { params });
    return response.data;
  },

  /**
   * Admin: retrieves submission details by kycId.
   * Endpoint: GET /api/v1/kyc/admin/:kycId
   */
  async getSubmission(kycId) {
    const response = await identityApi.get(`/api/v1/kyc/admin/${encodeURIComponent(kycId)}`);
    return response.data?.data || response.data;
  },

  /**
   * Admin: approves KYC submission.
   * Endpoint: PATCH /api/v1/kyc/admin/:kycId/approve
   */
  async approve(kycId, decisionNote = '') {
    const response = await identityApi.patch(`/api/v1/kyc/admin/${encodeURIComponent(kycId)}/approve`, {
      decisionNote,
    });
    return response.data?.data || response.data;
  },

  /**
   * Admin: rejects KYC submission with required reason.
   * Endpoint: PATCH /api/v1/kyc/admin/:kycId/reject
   */
  async reject(kycId, reason) {
    const response = await identityApi.patch(`/api/v1/kyc/admin/${encodeURIComponent(kycId)}/reject`, {
      reason,
    });
    return response.data?.data || response.data;
  },
};
