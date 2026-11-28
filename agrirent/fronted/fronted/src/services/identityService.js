import { identityApi } from './apiClient';

export const identityService = {
  /**
   * Retrieves own profile details.
   * Endpoint: GET /api/v1/users/me
   */
  async getProfile() {
    const response = await identityApi.get('/api/v1/users/me');
    return response.data?.data || response.data;
  },

  /**
   * Updates permitted profile fields (name, phone).
   * Endpoint: PATCH /api/v1/users/me
   */
  async updateProfile(payload) {
    const response = await identityApi.patch('/api/v1/users/me', payload);
    return response.data?.data || response.data;
  },

  /**
   * Checks user eligibility for renting or listing machinery.
   * Endpoint: GET /api/v1/users/:userId/eligibility
   */
  async checkEligibility(userId) {
    const response = await identityApi.get(`/api/v1/users/${encodeURIComponent(userId)}/eligibility`, {
      headers: {
        'x-service-client-id': 'agrirent_internal_client',
        'x-service-client-secret': 'agrirent_internal_secret_key_2026',
      },
    });
    return response.data?.data || response.data;
  },

  /**
   * Admin: view user account details.
   * Endpoint: GET /api/v1/admin/users/:userId
   */
  async getAdminUserDetails(userId) {
    const response = await identityApi.get(`/api/v1/admin/users/${encodeURIComponent(userId)}`);
    return response.data?.data || response.data;
  },

  /**
   * Admin: suspend user account.
   * Endpoint: PATCH /api/v1/admin/users/:userId/suspend
   */
  async suspendUser(userId, reason) {
    const response = await identityApi.patch(`/api/v1/admin/users/${encodeURIComponent(userId)}/suspend`, { reason });
    return response.data?.data || response.data;
  },

  /**
   * Admin: restore user account to ACTIVE.
   * Endpoint: PATCH /api/v1/admin/users/:userId/restore
   */
  async restoreUser(userId) {
    const response = await identityApi.patch(`/api/v1/admin/users/${encodeURIComponent(userId)}/restore`);
    return response.data?.data || response.data;
  },
};
