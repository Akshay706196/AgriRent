import { apiFetch } from './client';
import { API_CONFIG } from './config';
import { AuthSession, User, KYCSubmission } from './types';

export const authApi = {
  async register(payload: { name: string; email: string; phone: string; password: string; role?: string }): Promise<AuthSession> {
    const res = await apiFetch<{ success: boolean; data: any }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/auth/register`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        skipAuth: true,
      }
    );
    // If backend returns only user on register, perform auto-login or shape session
    if (res.data?.token || res.data?.accessToken) {
      return {
        accessToken: res.data.token || res.data.accessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: res.data.user || res.data,
      };
    }
    // Otherwise login automatically
    return authApi.login({ identifier: payload.email, password: payload.password });
  },

  async login(payload: { identifier: string; password: string }): Promise<AuthSession> {
    const res = await apiFetch<{ success: boolean; data: AuthSession }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/auth/login`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        skipAuth: true,
      }
    );
    return res.data;
  },

  async getCurrentUser(): Promise<User> {
    const res = await apiFetch<{ success: boolean; data: User }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/auth/me`,
      { method: 'GET' }
    );
    return res.data;
  },

  async updateProfile(payload: { name?: string; phone?: string }): Promise<User> {
    const res = await apiFetch<{ success: boolean; data: User }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/users/me`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  },

  async submitKYC(payload: { documentType: string; documentReference: string }, idempotencyKey?: string): Promise<KYCSubmission> {
    const res = await apiFetch<{ success: boolean; data: KYCSubmission }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/kyc/submit`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey,
      }
    );
    return res.data;
  },

  async getMyKYC(): Promise<KYCSubmission | null> {
    try {
      const res = await apiFetch<{ success: boolean; data: KYCSubmission }>(
        `${API_CONFIG.identity.baseUrl}/api/v1/kyc/me`,
        { method: 'GET' }
      );
      return res.data;
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  },

  async listPendingKYC(): Promise<KYCSubmission[]> {
    const res = await apiFetch<{ success: boolean; data: KYCSubmission[] }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/kyc/admin/pending`,
      { method: 'GET' }
    );
    return res.data || [];
  },

  async approveKYC(kycId: string, decisionNote?: string): Promise<KYCSubmission> {
    const res = await apiFetch<{ success: boolean; data: KYCSubmission }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/kyc/admin/${encodeURIComponent(kycId)}/approve`,
      {
        method: 'PATCH',
        body: JSON.stringify({ decisionNote: decisionNote || 'Verified by admin' }),
      }
    );
    return res.data;
  },

  async rejectKYC(kycId: string, reason: string): Promise<KYCSubmission> {
    const res = await apiFetch<{ success: boolean; data: KYCSubmission }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/kyc/admin/${encodeURIComponent(kycId)}/reject`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },

  async getUserDetails(userId: string): Promise<User> {
    const res = await apiFetch<{ success: boolean; data: User }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/admin/users/${encodeURIComponent(userId)}`,
      { method: 'GET' }
    );
    return res.data;
  },

  async suspendUser(userId: string, reason: string): Promise<{ message: string }> {
    const res = await apiFetch<{ success: boolean; data: { message: string } }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/admin/users/${encodeURIComponent(userId)}/suspend`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },

  async blockUser(userId: string, reason: string): Promise<{ message: string }> {
    const res = await apiFetch<{ success: boolean; data: { message: string } }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/admin/users/${encodeURIComponent(userId)}/block`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },

  async restoreUser(userId: string): Promise<{ message: string }> {
    const res = await apiFetch<{ success: boolean; data: { message: string } }>(
      `${API_CONFIG.identity.baseUrl}/api/v1/admin/users/${encodeURIComponent(userId)}/restore`,
      { method: 'PATCH' }
    );
    return res.data;
  },
};
