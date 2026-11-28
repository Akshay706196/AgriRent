/**
 * AgriRent Microservices API Gateway & Proxy Configuration.
 *
 * When VITE_USE_DEV_PROXY is true (default in Vite development),
 * all requests route through relative dev proxies (/api/...) so the browser
 * communicates with a single origin, completely bypassing CORS.
 * When pointing to a production gateway or direct container ports, only this file changes.
 */

const isDev = import.meta.env.DEV;
const useDevProxy = import.meta.env.VITE_USE_DEV_PROXY !== 'false';

// Base targets
const RAW_URLS = {
  identity: import.meta.env.VITE_IDENTITY_SERVICE_URL || 'http://localhost:4003',
  equipment: import.meta.env.VITE_EQUIPMENT_SERVICE_URL || 'http://localhost:4001',
  booking: import.meta.env.VITE_BOOKING_SERVICE_URL || 'http://localhost:4002',
  payment: import.meta.env.VITE_PAYMENT_SERVICE_URL || 'http://localhost:4004',
  handover: import.meta.env.VITE_HANDOVER_SERVICE_URL || 'http://localhost:4005',
  claims: import.meta.env.VITE_CLAIMS_SERVICE_URL || 'http://localhost:4006',
};

export const API_CONFIG = {
  identity: {
    baseUrl: useDevProxy && isDev ? '/api/identity' : RAW_URLS.identity,
    healthUrl: `${RAW_URLS.identity}/health`,
    docsUrl: `${RAW_URLS.identity}/docs`,
  },
  equipment: {
    baseUrl: useDevProxy && isDev ? '/api/equipment' : RAW_URLS.equipment,
    healthUrl: `${RAW_URLS.equipment}/health`,
    docsUrl: `${RAW_URLS.equipment}/docs`,
  },
  booking: {
    baseUrl: useDevProxy && isDev ? '/api/booking' : RAW_URLS.booking,
    healthUrl: `${RAW_URLS.booking}/health`,
    docsUrl: `${RAW_URLS.booking}/docs`,
  },
  payment: {
    baseUrl: useDevProxy && isDev ? '/api/payment' : RAW_URLS.payment,
    healthUrl: `${RAW_URLS.payment}/health`,
    docsUrl: `${RAW_URLS.payment}/docs`,
  },
  handover: {
    baseUrl: useDevProxy && isDev ? '/api/handover' : RAW_URLS.handover,
    healthUrl: `${RAW_URLS.handover}/health`,
    docsUrl: `${RAW_URLS.handover}/docs`,
  },
  claims: {
    baseUrl: useDevProxy && isDev ? '/api/claims' : RAW_URLS.claims,
    graphqlUrl: useDevProxy && isDev ? '/api/claims/graphql' : `${RAW_URLS.claims}/graphql`,
    healthUrl: `${RAW_URLS.claims}/health`,
    docsUrl: `${RAW_URLS.claims}/docs`,
  },
};
