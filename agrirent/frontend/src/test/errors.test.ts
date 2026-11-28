import { describe, it, expect } from 'vitest';
import { ApiError, ERROR_MESSAGES, getFriendlyErrorMessage } from '../api/errors';

describe('ApiError Catalogue and Getters', () => {
  it('creates ApiError with status, code, message and correlationId', () => {
    const err = new ApiError(404, 'BOOKING_NOT_FOUND', 'Not found in database', 'CORR-1234');
    expect(err.statusCode).toBe(404);
    expect(err.status).toBe(404);
    expect(err.code).toBe('BOOKING_NOT_FOUND');
    expect(err.correlationId).toBe('CORR-1234');
    expect(err.friendlyMessage).toBe(ERROR_MESSAGES.BOOKING_NOT_FOUND);
  });

  it('maps domain error codes to helpful user messages', () => {
    const kycErr = new ApiError(403, 'KYC_REQUIRED', 'Access denied');
    expect(kycErr.friendlyMessage).toContain('KYC-verified');

    const pinErr = new ApiError(423, 'PIN_LOCKED', 'Locked');
    expect(pinErr.friendlyMessage).toContain('locked');

    const dateErr = new ApiError(409, 'DATE_CONFLICT', 'Overlap');
    expect(dateErr.friendlyMessage).toContain('already reserved');
  });

  it('falls back to custom message or default message for unknown codes', () => {
    const customErr = new ApiError(500, 'CUSTOM_UNKNOWN', 'Custom server explanation');
    expect(getFriendlyErrorMessage(customErr)).toBe('Custom server explanation');

    const genericErr = new Error('Standard JS error');
    expect(getFriendlyErrorMessage(genericErr)).toBe('Standard JS error');
  });
});
