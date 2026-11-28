import axios from 'axios';

/**
 * Creates an Axios client configured with base URL, timeout, and auth interceptor.
 */
export const createServiceClient = (baseURL) => {
  const client = axios.create({
    baseURL,
    timeout: 8000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Attach JWT Bearer token if available in localStorage
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('agrirent_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return client;
};

// Base URLs from environment variables
export const IDENTITY_URL = import.meta.env.VITE_IDENTITY_API_URL || 'http://localhost:4003';
export const EQUIPMENT_URL = import.meta.env.VITE_EQUIPMENT_API_URL || 'http://localhost:4001';
export const BOOKING_URL = import.meta.env.VITE_BOOKING_API_URL || 'http://localhost:4002';

// Specific clients for each microservice
export const identityApi = createServiceClient(IDENTITY_URL);
export const equipmentApi = createServiceClient(EQUIPMENT_URL);
export const bookingApi = createServiceClient(BOOKING_URL);
