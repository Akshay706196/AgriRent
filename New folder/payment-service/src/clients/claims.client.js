const axios = require('axios');
const AppError = require('../utils/AppError');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.OUTBOUND_TIMEOUT_MS, 10) || 5000;
const MAX_RETRIES = parseInt(process.env.MAX_OUTBOUND_RETRIES, 10) || 2;
const INITIAL_BACKOFF_MS = parseInt(process.env.INITIAL_BACKOFF_MS, 10) || 200;

class ClaimsClient {
  constructor() {
    this.baseUrl = process.env.CLAIMS_SERVICE_URL || 'http://localhost:4006';
    this.serviceToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';
    this.breaker = new CircuitBreaker('ClaimsService', {
      errorType: 'UPSTREAM_UNAVAILABLE',
    });
  }

  /**
   * Safe outbound GET with timeout, retry + jitter, and circuit breaker.
   */
  async _getWithRetryAndBreaker(endpoint, correlationId) {
    return this.breaker.execute(async () => {
      let lastErr = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        try {
          const url = `${this.baseUrl}${endpoint}`;
          const response = await axios.get(url, {
            signal: controller.signal,
            headers: {
              'x-correlation-id': correlationId,
              'x-internal-service-token': this.serviceToken,
              'internal_service_token': this.serviceToken,
              'user-agent': 'AgriRent-PaymentService/1.0',
            },
          });
          clearTimeout(timeoutId);
          return response.data;
        } catch (err) {
          clearTimeout(timeoutId);
          lastErr = err;

          if (err.name === 'CanceledError' || err.code === 'ECONNABORTED' || err.message?.includes('aborted')) {
            logger.error(`[ClaimsClient] Request timed out after ${DEFAULT_TIMEOUT_MS}ms [${correlationId}]`);
            throw new AppError(504, 'UPSTREAM_TIMEOUT', `Claims Service timed out after ${DEFAULT_TIMEOUT_MS}ms.`);
          }

          const statusCode = err.response?.status;
          if (statusCode === 404) {
            return null;
          }

          if (statusCode && statusCode < 500) {
            throw new AppError(
              statusCode,
              err.response?.data?.error?.code || 'UPSTREAM_CLIENT_ERROR',
              err.response?.data?.error?.message || 'Downstream claims service error.'
            );
          }

          if (attempt < MAX_RETRIES) {
            const exponentialDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            const jitter = Math.random() * exponentialDelay;
            const delay = Math.round(jitter);
            logger.warn(`[ClaimsClient] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay.`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new AppError(503, 'UPSTREAM_UNAVAILABLE', `Claims Service request failed: ${lastErr?.message}`);
    });
  }

  /**
   * Retrieves verified, approved damage deductions for a booking.
   * @param {string} bookingId
   * @param {string} correlationId
   * @returns {Promise<{ bookingId: string, lateFine: number, approvedDeductions: Array, totalDamageDeduction: number, hasOpenClaims: boolean, hasOpenDisputes: boolean, eligible: boolean } | null>}
   */
  async getApprovedDeductions(bookingId, correlationId = 'internal') {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }
    return await this._getWithRetryAndBreaker(
      `/v1/bookings/${encodeURIComponent(bookingId)}/approved-deductions`,
      correlationId
    );
  }
}

module.exports = new ClaimsClient();
