const axios = require('axios');
const AppError = require('../utils/AppError');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.OUTBOUND_TIMEOUT_MS, 10) || 5000;
const MAX_RETRIES = parseInt(process.env.MAX_OUTBOUND_RETRIES, 10) || 2;
const INITIAL_BACKOFF_MS = parseInt(process.env.INITIAL_BACKOFF_MS, 10) || 200;

class BookingClient {
  constructor() {
    this.baseUrl = process.env.BOOKING_SERVICE_URL || 'http://localhost:4002';
    this.serviceToken = process.env.INTERNAL_SERVICE_TOKEN || 'agrirent_internal_service_token_2026';
    this.breaker = new CircuitBreaker('BookingService', {
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
            logger.error(`[BookingClient] Request timed out after ${DEFAULT_TIMEOUT_MS}ms [${correlationId}]`);
            throw new AppError(504, 'UPSTREAM_TIMEOUT', `Booking Service timed out after ${DEFAULT_TIMEOUT_MS}ms.`);
          }

          const statusCode = err.response?.status;
          if (statusCode === 404) {
            throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking record was not found in Booking Service.');
          }

          if (statusCode && statusCode < 500) {
            throw new AppError(
              statusCode,
              err.response?.data?.error?.code || 'UPSTREAM_CLIENT_ERROR',
              err.response?.data?.error?.message || 'Downstream booking service error.'
            );
          }

          if (attempt < MAX_RETRIES) {
            const exponentialDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            const jitter = Math.random() * exponentialDelay;
            const delay = Math.round(jitter);
            logger.warn(`[BookingClient] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms delay.`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new AppError(503, 'UPSTREAM_UNAVAILABLE', `Booking Service request failed: ${lastErr?.message}`);
    });
  }

  /**
   * Fetches authoritative booking details by booking ID.
   */
  async getBookingDetails(bookingId, correlationId = 'internal') {
    if (!bookingId) {
      throw new AppError(400, 'INVALID_INPUT', 'bookingId is required.');
    }
    return await this._getWithRetryAndBreaker(`/api/v1/bookings/${encodeURIComponent(bookingId)}`, correlationId);
  }

  /**
   * Notifies Booking Service that settlement completed (RETURNED -> COMPLETED).
   */
  async notifyCompletion(bookingId, payload = {}, correlationId = 'internal') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const url = `${this.baseUrl}/api/v1/bookings/internal/${encodeURIComponent(bookingId)}/completion-confirmed`;
      const response = await axios.post(url, payload, {
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
      if (err.name === 'CanceledError' || err.code === 'ECONNABORTED' || err.message?.includes('aborted')) {
        throw new AppError(504, 'UPSTREAM_TIMEOUT', 'Booking Service completion notification timed out.');
      }
      logger.warn(`[BookingClient] Completion notification failed for ${bookingId}: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new BookingClient();
