const axios = require('axios');
const ApiError = require('../utils/ApiError');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.EQUIPMENT_SERVICE_TIMEOUT_MS, 10) || 5000;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 200;

class EquipmentClient {
  constructor() {
    this.baseUrl = process.env.EQUIPMENT_SERVICE_URL || 'http://localhost:4001';
  }

  /**
   * Helper to perform idempotent GET requests with exponential backoff retry.
   */
  async _getWithRetry(endpoint, params = {}, correlationId = 'internal', retries = MAX_RETRIES) {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(url, {
          params,
          headers: {
            'x-correlation-id': correlationId,
            'user-agent': 'AgriRent-BookingService-Client/1.0',
          },
          timeout: DEFAULT_TIMEOUT_MS,
        });

        const duration = Date.now() - startTime;
        if (process.env.NODE_ENV !== 'test') {
          console.log(`[HTTP Client] GET ${endpoint} - Status: ${response.status} (${duration}ms) [${correlationId}]`);
        }

        return response.data;
      } catch (err) {
        const isLastAttempt = attempt === retries;
        const statusCode = err.response ? err.response.status : null;

        // If resource is not found, do not retry
        if (statusCode === 404) {
          throw new ApiError(404, 'EQUIPMENT_NOT_FOUND', `Equipment was not found in Equipment Service catalog.`);
        }

        // Only retry on network errors or 5xx server errors
        const isRetryable = !err.response || statusCode >= 500;
        if (isLastAttempt || !isRetryable) {
          const duration = Date.now() - startTime;
          console.error(
            `[HTTP Client Error] GET ${endpoint} failed after ${attempt + 1} attempts (${duration}ms) [${correlationId}]: ${err.message}`
          );

          if (statusCode && statusCode < 500) {
            throw new ApiError(
              statusCode,
              err.response?.data?.error?.code || 'EQUIPMENT_SERVICE_ERROR',
              err.response?.data?.error?.message || 'Downstream Equipment Service returned an error.'
            );
          }

          throw new ApiError(
            503,
            'EQUIPMENT_SERVICE_UNAVAILABLE',
            'Equipment Management Service is currently unavailable. Please try again shortly.'
          );
        }

        // Exponential backoff
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  /**
   * Fetches equipment listing metadata by ID.
   */
  async getEquipmentById(equipmentId, correlationId = 'internal') {
    if (!equipmentId) {
      throw new ApiError(400, 'INVALID_INPUT', 'equipmentId parameter is required.');
    }

    const data = await this._getWithRetry(`/api/v1/equipment/${encodeURIComponent(equipmentId)}`, {}, correlationId);

    // Validate expected schema attributes
    if (!data || !data.equipmentId || !data.ownerId || typeof data.pricePerDay !== 'number') {
      throw new ApiError(
        502,
        'BAD_GATEWAY',
        'Equipment Service returned an invalid or incomplete equipment payload.'
      );
    }

    return data;
  }

  /**
   * Verifies that the equipment exists and is currently in ACTIVE listing status.
   */
  async checkEquipmentStatus(equipmentId, correlationId = 'internal') {
    const equipment = await this.getEquipmentById(equipmentId, correlationId);
    return {
      exists: true,
      isActive: equipment.status === 'ACTIVE',
      equipment,
    };
  }
}

module.exports = new EquipmentClient();
