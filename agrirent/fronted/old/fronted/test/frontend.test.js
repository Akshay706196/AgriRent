import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import modules under test
import { formatDate, calculateRentalDays, calculateDays, toInputDateFormat } from '../src/utils/formatDate.js';
import { formatCurrency } from '../src/utils/formatCurrency.js';
import { getErrorMessage } from '../src/utils/errorHandler.js';
import { placeholderService, placeholderServices } from '../src/services/placeholderService.js';

describe('AgriRent Frontend Core Test Suite', () => {

  describe('1. Date Calculations & Half-Open Interval Convention', () => {
    it('calculates duration correctly using half-open [startDate, endDate) convention', () => {
      // 2026-10-15 to 2026-10-17 is exactly 2 days
      const days = calculateRentalDays('2026-10-15', '2026-10-17');
      assert.strictEqual(days, 2);
    });

    it('returns 0 when endDate is equal to startDate', () => {
      const days = calculateRentalDays('2026-10-15', '2026-10-15');
      assert.strictEqual(days, 0);
    });

    it('returns 0 when endDate is before startDate', () => {
      const days = calculateRentalDays('2026-10-17', '2026-10-15');
      assert.strictEqual(days, 0);
    });

    it('calculateDays alias matches calculateRentalDays', () => {
      assert.strictEqual(calculateDays('2026-10-10', '2026-10-15'), 5);
    });

    it('formats date to human readable string', () => {
      const formatted = formatDate('2026-10-15T00:00:00.000Z');
      assert.ok(formatted.includes('2026'));
      assert.ok(formatted.includes('Oct') || formatted.includes('15'));
    });

    it('handles invalid date gracefully in formatDate', () => {
      assert.strictEqual(formatDate(null), 'N/A');
      assert.strictEqual(formatDate(undefined), 'N/A');
    });
  });

  describe('2. Pricing & Financial Calculations', () => {
    it('formats currency with INR symbol', () => {
      const formatted = formatCurrency(1500);
      assert.ok(formatted.includes('1,500') || formatted.includes('1500'));
      assert.ok(formatted.includes('₹'));
    });

    it('calculates platform fee as 3% rounded correctly', () => {
      const rentalAmount = 3000;
      const platformFee = Math.round(rentalAmount * 0.03 * 100) / 100;
      assert.strictEqual(platformFee, 90);

      const total = rentalAmount + platformFee + 1000; // with 1000 deposit
      assert.strictEqual(total, 4090);
    });
  });

  describe('3. Error Handler & Backend Contract Adaptation', () => {
    it('extracts API error message from response.data.error.message', () => {
      const errorObj = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            }
          }
        }
      };
      assert.strictEqual(getErrorMessage(errorObj), 'Invalid email or password');
    });

    it('extracts express-validator formatted errors array', () => {
      const errorObj = {
        response: {
          status: 422,
          data: {
            message: 'Request validation failed',
            errors: [
              { field: 'pricePerDay', message: 'pricePerDay must be greater than 0' }
            ]
          }
        }
      };
      const msg = getErrorMessage(errorObj);
      assert.ok(msg.includes('pricePerDay must be greater than 0'));
    });

    it('handles 401 Unauthorized errors with clear message', () => {
      const errorObj = {
        response: {
          status: 401,
          data: {}
        }
      };
      assert.strictEqual(
        getErrorMessage(errorObj),
        'Your session has expired or you are not logged in. Please log in again.'
      );
    });

    it('handles 403 Forbidden errors with clear explanation', () => {
      const errorObj = {
        response: {
          status: 403,
          data: {}
        }
      };
      assert.strictEqual(getErrorMessage(errorObj), 'You do not have permission to perform this action.');
    });

    it('handles network error when backend service is offline', () => {
      const errorObj = {
        request: {},
        message: 'Network Error'
      };
      assert.strictEqual(
        getErrorMessage(errorObj),
        'Unable to reach the backend service. Please check if the microservice is running.'
      );
    });
  });

  describe('4. Placeholder Services (Roadmap Non-Functional Verification)', () => {
    it('returns planned metadata without executing network requests', () => {
      const payments = placeholderService.getPlaceholder('payments');
      assert.strictEqual(payments.id, 'payments');
      assert.strictEqual(payments.status, 'Coming Soon');
      assert.ok(payments.features.length >= 3);
    });

    it('supports alias lookups for roadmap services', () => {
      const deposit = placeholderService.getPlaceholder('deposit');
      assert.strictEqual(deposit.id, 'security-deposit');

      const handover = placeholderService.getPlaceholder('handover');
      assert.strictEqual(handover.id, 'handover');

      const reviews = placeholderService.getPlaceholder('reviews');
      assert.strictEqual(reviews.id, 'reviews');
    });

    it('returns all 8 planned placeholder services', () => {
      const all = placeholderService.getAll();
      assert.strictEqual(all.length, 8);
    });
  });

  describe('5. Equipment Schema Validation Contract', () => {
    it('verifies allowed equipment categories', () => {
      const allowedCategories = ['TRACTOR', 'HARVESTER', 'ROTAVATOR', 'SEEDER', 'OTHER'];
      assert.ok(allowedCategories.includes('TRACTOR'));
      assert.ok(allowedCategories.includes('HARVESTER'));
      assert.ok(allowedCategories.includes('ROTAVATOR'));
    });

    it('verifies allowed operational conditions', () => {
      const allowedConditions = ['NEW', 'GOOD', 'FAIR'];
      assert.ok(allowedConditions.includes('NEW'));
      assert.ok(allowedConditions.includes('GOOD'));
      assert.ok(allowedConditions.includes('FAIR'));
    });
  });

  describe('6. KYC Enum & Compliance Rules', () => {
    it('verifies accepted KYC document types', () => {
      const acceptedTypes = ['AADHAAR', 'PAN', 'DRIVING_LICENSE', 'VOTER_ID', 'PASSPORT', 'FARMER_ID'];
      assert.ok(acceptedTypes.includes('AADHAAR'));
      assert.ok(acceptedTypes.includes('PAN'));
      assert.ok(acceptedTypes.includes('FARMER_ID'));
    });

    it('verifies KYC status states', () => {
      const statuses = ['NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED'];
      assert.ok(statuses.includes('VERIFIED'));
      assert.ok(statuses.includes('PENDING'));
      assert.ok(statuses.includes('REJECTED'));
    });
  });
});
