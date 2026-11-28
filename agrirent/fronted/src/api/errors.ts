/**
 * AgriRent Error Catalogue & Typed ApiError Class.
 * Maps every backend machine error code to an empathetic, friendly, and actionable message.
 */

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public correlationId: string;
  public details?: unknown;
  public retryAfter?: number;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    correlationId: string = 'unknown',
    details?: unknown,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.correlationId = correlationId;
    this.details = details;
    this.retryAfter = retryAfter;
  }

  public get status(): number {
    return this.statusCode;
  }

  public get friendlyMessage(): string {
    return getFriendlyErrorMessage(this);
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  // Identity & KYC errors
  INVALID_INPUT: 'Please review the entered information and correct any highlighted errors.',
  USER_EXISTS: 'An account with this email address or phone number is already registered.',
  INVALID_CREDENTIALS: 'The identifier or password you entered is incorrect. Please try again.',
  ACCOUNT_BLOCKED: 'This account has been blocked due to policy violations. Please contact support.',
  ACCOUNT_SUSPENDED: 'This account is temporarily suspended pending administrative verification.',
  ACCOUNT_LOCKED: 'Account temporarily locked due to multiple failed login attempts. Please wait before retrying.',
  KYC_REQUIRED: 'Your account must be KYC-verified before you can rent or list agricultural machinery.',
  KYC_ALREADY_PENDING: 'You already have a KYC submission under review. Please wait for administrator verification.',
  KYC_ALREADY_VERIFIED: 'Your account is already KYC-verified.',
  KYC_NOT_FOUND: 'The requested KYC submission record could not be found.',

  // Booking & Equipment errors
  DATE_CONFLICT: 'The selected equipment is already reserved for these dates. Please select an alternate date range.',
  INVALID_BOOKING_STATE: 'This action cannot be performed in the booking’s current lifecycle stage.',
  BOOKING_EXPIRED: 'This booking request has expired because the 24-hour response window has passed.',
  NOT_EQUIPMENT_OWNER: 'Only the verified equipment owner is authorized to perform this operation.',
  NOT_PARTICIPANT: 'You are not authorized to view or modify this rental booking.',
  BOOKING_NOT_FOUND: 'The requested booking could not be found.',
  EQUIPMENT_NOT_FOUND: 'The requested equipment listing could not be found or has been deactivated.',

  // Payment errors
  INVALID_AMOUNT: 'The requested payment amount does not match the booking price snapshot.',
  PAYMENT_NOT_CONFIRMED: 'Payment has not been confirmed yet. Handover PINs can only be generated after payment is confirmed.',
  DUPLICATE_REQUEST: 'A concurrent request with this operation is already in progress. Please wait a moment.',
  IDEMPOTENCY_CONFLICT: 'This request was submitted previously with differing parameters. Please refresh and retry.',
  DUPLICATE_REFUND: 'A refund has already been issued for this transaction.',
  REFUND_NOT_ALLOWED: 'The requested refund amount exceeds the refundable paid balance.',

  // Handover & Return errors
  INVALID_PIN: 'The entered 6-digit PIN is incorrect. Please verify with the renter.',
  PIN_EXPIRED: 'This PIN has expired. The renter must generate a new PIN to proceed.',
  PIN_LOCKED: 'PIN locked after 3 failed verification attempts. Please ask the renter to generate a fresh PIN.',
  PIN_ALREADY_USED: 'This PIN has already been used and cannot be verified again.',
  UNAUTHORIZED_USER: 'You do not have permission to verify or access this PIN.',

  // Claims & Dispute errors
  INVALID_CLAIM: 'The claim payload is invalid. An amount greater than ₹0 and evidence photos are mandatory.',
  CLAIM_WINDOW_CLOSED: 'The damage claim filing window has closed (48 hours after return, or previously waived).',
  DISPUTE_WINDOW_CLOSED: 'The dispute filing window has expired (72 hours after claim submission).',
  DISPUTE_ALREADY_OPEN: 'An open dispute already exists for this damage claim.',
  CLAIM_ALREADY_DECIDED: 'This damage claim has already received an administrative decision.',
  EVIDENCE_REQUIRED: 'Evidence photos are mandatory before a damage claim can be approved.',
  INVALID_DEDUCTION: 'Approved deduction amount cannot exceed the claimed amount or the security deposit held.',
  SETTLEMENT_NOT_ELIGIBLE: 'This rental case is not yet eligible for financial settlement.',

  // General HTTP errors
  RATE_LIMIT_EXCEEDED: 'Too many requests sent in a short period. Please slow down.',
  UPSTREAM_UNAVAILABLE: 'Downstream service is temporarily unavailable. Circuit breaker is open. Please try again shortly.',
  UPSTREAM_TIMEOUT: 'The operation timed out while waiting for a dependent service. Please retry.',
  UNAUTHENTICATED: 'Your session has expired or is invalid. Please log in again.',
  FORBIDDEN: 'You do not have administrative privileges to perform this action.',
  ADMIN_REQUIRED: 'Administrative privileges are required to perform this action.',
};

/**
 * Returns a user-friendly error message, falling back to backend message or a default.
 */
export function getFriendlyErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (ERROR_MESSAGES[err.code]) {
      return ERROR_MESSAGES[err.code];
    }
    if (err.message && err.message !== 'INTERNAL_SERVER_ERROR') {
      return err.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred while communicating with the service. Please try again.';
}
