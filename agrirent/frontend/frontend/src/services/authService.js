import { identityApi } from './apiClient';

const TOKEN_KEY = 'agrirent_token';
const USER_KEY = 'agrirent_user';

export const authService = {
  /**
   * Registers a new user with Identity Service.
   * Endpoint: POST /api/v1/auth/register
   */
  async register(payload) {
    const response = await identityApi.post('/api/v1/auth/register', payload);
    return response.data?.data || response.data;
  },

  /**
   * Authenticates user and stores credentials.
   * Endpoint: POST /api/v1/auth/login
   */
  async login(payload) {
    const response = await identityApi.post('/api/v1/auth/login', payload);
    const data = response.data?.data || response.data;

    if (data.accessToken) {
      this.setToken(data.accessToken);
    }
    if (data.user) {
      this.setUser(data.user);
    }

    return data;
  },

  /**
   * Fetches current authenticated user profile.
   * Endpoint: GET /api/v1/auth/me
   */
  async getCurrentUser() {
    const response = await identityApi.get('/api/v1/auth/me');
    const user = response.data?.data || response.data;
    if (user) {
      this.setUser(user);
    }
    return user;
  },

  /**
   * Changes authenticated user password.
   * Endpoint: PATCH /api/v1/auth/change-password
   */
  async changePassword(payload) {
    const response = await identityApi.patch('/api/v1/auth/change-password', payload);
    return response.data;
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getUser() {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
