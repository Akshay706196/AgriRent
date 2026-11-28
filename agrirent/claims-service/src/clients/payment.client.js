const axios = require('axios');
const AppError = require('../utils/AppError');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.OUTBOUND_TIMEOUT_MS, 10) || 5000;
const MAX_RETRIES = parseInt(process.env.MAX_OUTBOUND_RETRIES, 10) || 2;
const INITIAL_BACKOFF_MS = parseInt(process.env.INITIAL_BACKOFF_MS, 10) || 200;

class PaymentClient {
  constructor() {
    this.baseUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:4004';
    this.serviceToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';
    this.breaker = new CircuitBreaker('PaymentService', {
      errorType: 'UPSTREAM_UNAVAILABLE',
    });
  }

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
              'internal_service_token': this.serviceToken,
              'x-internal-service-token': this.serviceToken,
              'user-agent': 'AgriRent-ClaimsService/1.0',
            },
          });
          clearTimeout(timeoutId);
          return response.data;
        } catch (err) {
          clearTimeout(timeoutId);
          lastErr = err;

          if (err.name === 'CanceledError' || err.code === 'ECONNABORTED' || err.message?.includes('aborted')) {
            logger.error(`[PaymentClient] Request timed out after ${DEFAULT_TIMEOUT_MS}ms [${correlationId}]`);
            throw new AppError(504, 'UPSTREAM_TIMEOUT', `Payment Service timed out after ${DEFAULT_TIMEOUT_MS}ms.`);
          }

          const statusCode = err.response?.status;
          if (statusCode === 404) {
            throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment record was not found in Payment Service.');
          }

          if (statusCode && statusCode < 500) {
            throw new AppError(
              statusCode,
              err.response?.data?.error?.code || 'UPSTREAM_CLIENT_ERROR',
              err.response?.data?.error?.message || 'Downstream payment service error.'
            );
          }

          if (attempt < MAX_RETRIES) {
            const exponentialDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            const jitter = Math.random() * exponentialDelay;
            const delay = Math.round(jitter);
            logger.warn(`[PaymentClient] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay.`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new AppError(503, 'UPSTREAM_UNAVAILABLE', `Payment Service request failed: ${lastErr?.message}`);
    });
  }

  /**
   * Fetches payment and deposit status for a booking.
   */
  async getPaymentStatus(bookingId, correlationId = 'internal') {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }
    return await this._getWithRetryAndBreaker(`/v1/bookings/${encodeURIComponent(bookingId)}/payment-status`, correlationId);
  }

  /**
   * Calls Payment POST /v1/bookings/:bookingId/settlements with deterministic idempotency key.
   */
  async settleBooking(bookingId, payload, idempotencyKey, correlationId = 'internal') {
    return this.breaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        const url = `${this.baseUrl}/v1/bookings/${encodeURIComponent(bookingId)}/settlements`;
        const response = await axios.post(url, payload, {
          signal: controller.signal,
          headers: {
            'Idempotency-Key': idempotencyKey,
            'x-correlation-id': correlationId,
            'internal_service_token': this.serviceToken,
            'x-internal-service-token': this.serviceToken,
            'user-agent': 'AgriRent-ClaimsService/1.0',
          },
        });
        clearTimeout(timeoutId);
        return { success: true, data: response.data, status: response.status };
      } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'CanceledError' || err.code === 'ECONNABORTED' || err.message?.includes('aborted')) {
          throw new AppError(504, 'UPSTREAM_TIMEOUT', 'Payment Service settlement call timed out.');
        }

        const statusCode = err.response?.status;
        const errCode = err.response?.data?.error?.code;

        // 409 SETTLEMENT_ALREADY_COMPLETED is treated as a successful completion in saga
        if (statusCode === 409 && errCode === 'SETTLEMENT_ALREADY_COMPLETED') {
          return { success: true, alreadyCompleted: true, data: err.response?.data };
        }

        if (statusCode === 422) {
          throw new AppError(422, 'INVALID_DEDUCTION', err.response?.data?.error?.message || 'Settlement deduction rejected.');
        }

        if (statusCode && statusCode < 500) {
          throw new AppError(statusCode, errCode || 'PAYMENT_SETTLEMENT_ERROR', err.response?.data?.error?.message || 'Payment settlement error.');
        }

        throw new AppError(503, 'UPSTREAM_UNAVAILABLE', `Payment Service settlement request failed: ${err.message}`);
      }
    });
  }
}

module.exports = new PaymentClient();
