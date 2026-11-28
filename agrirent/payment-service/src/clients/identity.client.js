const axios = require('axios');
const AppError = require('../utils/AppError');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.OUTBOUND_TIMEOUT_MS, 10) || 5000;

class IdentityClient {
  constructor() {
    this.baseUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:4003';
    this.serviceToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';
    this.breaker = new CircuitBreaker('IdentityService', {
      errorType: 'UPSTREAM_UNAVAILABLE',
    });
  }

  async getUserEligibility(userId, correlationId = 'internal') {
    return this.breaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        const url = `${this.baseUrl}/api/v1/users/${encodeURIComponent(userId)}/eligibility`;
        const response = await axios.get(url, {
          signal: controller.signal,
          headers: {
            'x-correlation-id': correlationId,
            'internal_service_token': this.serviceToken,
            'user-agent': 'AgriRent-PaymentService/1.0',
          },
        });
        clearTimeout(timeoutId);
        return response.data?.data || response.data;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'CanceledError' || err.code === 'ECONNABORTED' || err.message?.includes('aborted')) {
          throw new AppError(504, 'UPSTREAM_TIMEOUT', 'Identity Service request timed out.');
        }
        logger.warn(`[IdentityClient] Failed to check eligibility for ${userId}: ${err.message}`);
        // Fallback or rethrow based on status
        if (err.response?.status === 404) {
          return { exists: false, canRent: false, canListEquipment: false };
        }
        throw err;
      }
    });
  }
}

module.exports = new IdentityClient();
