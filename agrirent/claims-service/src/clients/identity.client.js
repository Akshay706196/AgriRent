const axios = require('axios');
const AppError = require('../utils/AppError');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.OUTBOUND_TIMEOUT_MS, 10) || 5000;
const MAX_RETRIES = parseInt(process.env.MAX_OUTBOUND_RETRIES, 10) || 2;
const INITIAL_BACKOFF_MS = parseInt(process.env.INITIAL_BACKOFF_MS, 10) || 200;

class IdentityClient {
  constructor() {
    this.baseUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:4003';
    this.serviceToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';
    this.breaker = new CircuitBreaker('IdentityService', {
      errorType: 'UPSTREAM_UNAVAILABLE',
    });
  }

  async getUserStatus(userId, correlationId = 'internal') {
    return this.breaker.execute(async () => {
      let lastErr = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        try {
          const url = `${this.baseUrl}/api/v1/auth/users/${encodeURIComponent(userId)}/status`;
          const response = await axios.get(url, {
            signal: controller.signal,
            headers: {
              'x-correlation-id': correlationId,
              'internal_service_token': this.serviceToken,
              'user-agent': 'AgriRent-ClaimsService/1.0',
            },
          });
          clearTimeout(timeoutId);
          return response.data;
        } catch (err) {
          clearTimeout(timeoutId);
          lastErr = err;

          if (err.name === 'CanceledError' || err.code === 'ECONNABORTED' || err.message?.includes('aborted')) {
            throw new AppError(504, 'UPSTREAM_TIMEOUT', 'Identity Service request timed out.');
          }

          const statusCode = err.response?.status;
          if (statusCode === 404) {
            return null;
          }

          if (statusCode && statusCode < 500) {
            throw new AppError(
              statusCode,
              err.response?.data?.error?.code || 'UPSTREAM_CLIENT_ERROR',
              err.response?.data?.error?.message || 'Downstream identity error.'
            );
          }

          if (attempt < MAX_RETRIES) {
            const exponentialDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            const jitter = Math.random() * exponentialDelay;
            await new Promise((resolve) => setTimeout(resolve, Math.round(jitter)));
          }
        }
      }

      throw new AppError(503, 'UPSTREAM_UNAVAILABLE', `Identity Service request failed: ${lastErr?.message}`);
    });
  }
}

module.exports = new IdentityClient();
