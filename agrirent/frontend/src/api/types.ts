/**
 * AgriRent TypeScript Data Transfer Objects and Domain Models
 * Generated strictly from the microservices API contract audit.
 */

// ============================================================================
// 1. IDENTITY & KYC TYPES
// ============================================================================

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'DEACTIVATED';
export type KYCStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUIRED';

export type UserRole = 'USER' | 'ADMIN' | 'FARMER';

export interface User {
  userId: string;
  name: string;
  email: string;
  phone: string;
  accountStatus: AccountStatus;
  kycStatus: KYCStatus;
  roles: UserRole[];
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export type DocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'VOTER_ID'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'FARMER_ID'
  | 'GOVERNMENT_ID';

export interface KYCSubmission {
  kycId: string;
  userId: string;
  documentType: DocumentType;
  documentReference: string;
  status: KYCStatus;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  decisionNote?: string | null;
}

// ============================================================================
// 2. EQUIPMENT TYPES
// ============================================================================

export type EquipmentCategory =
  | 'TRACTOR'
  | 'HARVESTER'
  | 'ROTAVATOR'
  | 'TILLER'
  | 'SEEDER'
  | 'SPRAYER'
  | 'OTHER'
  | string;

export type EquipmentCondition = 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | string;
export type EquipmentStatus = 'AVAILABLE' | 'IN_RENTAL' | 'MAINTENANCE' | 'INACTIVE';

export interface PickupAddress {
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface Equipment {
  id?: string;
  _id?: string;
  equipmentId: string;
  ownerId: string;
  name?: string;
  title?: string;
  category: EquipmentCategory;
  description?: string;
  brand?: string;
  model?: string;
  manufacturingYear?: number;
  condition: EquipmentCondition;
  photos: string[];
  pricePerDay?: number;
  securityDeposit?: number;
  pricing?: {
    perDay: number;
    securityDeposit: number;
  };
  pickupAddress?: PickupAddress;
  location?: {
    address?: string;
    district?: string;
    city?: string;
    state?: string;
    pincode?: string;
    postalCode?: string;
  };
  specs?: {
    hp?: number;
    fuelType?: string;
    modelYear?: number;
  };
  status: EquipmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// 3. BOOKING TYPES
// ============================================================================

export type BookingStatus =
  | 'PENDING_OWNER'
  | 'APPROVED'
  | 'PAID'
  | 'IN_RENTAL'
  | 'RETURNED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface PriceSnapshot {
  pricePerDaySnapshot?: number;
  rentalAmount: number;
  platformFee: number;
  securityDeposit: number;
  totalAmount: number;
  currency: string;
}

export interface Booking {
  bookingId: string;
  equipmentId: string;
  ownerId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  rentalDays: number;
  rentalAmount: number;
  platformFee: number;
  securityDeposit: number;
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  ownerResponseDeadline: string;
  paymentDeadline?: string;
  approvedAt?: string;
  paidAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  returnedAt?: string;
  completedAt?: string;
  createdAt?: string;
}

// ============================================================================
// 4. PAYMENT & SECURITY DEPOSIT TYPES
// ============================================================================

export type PaymentLifecycleStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'SETTLED';
export type DepositLifecycleStatus = 'HELD' | 'RELEASED' | 'SETTLED';

export interface PaymentOrder {
  paymentId: string;
  bookingId: string;
  renterId: string;
  amount: number;
  currency: string;
  depositAmount: number;
  gateway: string;
  clientSecret: string;
  verificationUrl: string;
  status: PaymentLifecycleStatus;
  createdAt: string;
}

export interface PaymentStatusSummary {
  bookingId: string;
  paymentStatus: PaymentLifecycleStatus;
  depositStatus: DepositLifecycleStatus;
  heldDeposit: number;
  currency: string;
}

export interface SettlementBreakdown {
  settlementId: string;
  bookingId: string;
  rentalAmount: number;
  lateFine: number;
  damageDeduction: number;
  depositBalance: number;
  refundToRenter: number;
  ownerPayout: number;
  status: 'COMPLETED';
  settledAt: string;
}

// ============================================================================
// 5. HANDOVER, RETURN & LATE-FINE TYPES
// ============================================================================

export interface PinIssueResponse {
  pinId: string;
  bookingId: string;
  pinType: 'HANDOVER' | 'RETURN';
  expiresAt: string;
  dev_pin?: string;
}

export interface ConditionReport {
  engineHours?: number;
  fuelLevelPercent?: number;
  cleanliness?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DIRTY' | 'POOR';
  visualInspectionNotes?: string;
  photoUrls?: string[];
}

export interface LateFineSummary {
  bookingId: string;
  fineAmount: number;
  overdueDays?: number;
  overdueHours?: number;
  billableOverdueDays?: number;
  dailyOverdueRate?: number;
  isOverdue?: boolean;
  overdueDuration?: string;
  status?: 'ASSESSED' | 'PREVIEW' | string;
}

export interface ConditionComparison {
  bookingId: string;
  handoverConditionReport?: ConditionReport;
  returnConditionReport?: ConditionReport;
}

// ============================================================================
// 6. CLAIMS, DISPUTES & REVIEWS TYPES
// ============================================================================

export type ClaimStatus = 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'SETTLED' | 'OPEN' | string;
export type DisputeStatus = 'OPEN' | 'RESOLVED' | string;

export interface EvidenceItem {
  evidenceId?: string;
  photos: string[];
  notes?: string;
  addedBy?: string;
  createdAt?: string;
}

export interface ClaimDecision {
  decisionId: string;
  decision: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  approvedAmount: number;
  reason: string;
  decidedBy: string;
  decidedAt: string;
}

export interface DamageClaim {
  claimId: string;
  bookingId: string;
  claimantId: string;
  reason: string;
  claimedAmount: number;
  status: ClaimStatus;
  evidence?: EvidenceItem | EvidenceItem[] | any;
  decision?: ClaimDecision | null;
  windowClosesAt: string;
  createdAt: string;
  disputes?: Dispute[];
}

export interface Dispute {
  disputeId: string;
  claimId: string;
  status: DisputeStatus;
  reason: string;
  decision?: string;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface Review {
  reviewId: string;
  bookingId: string;
  reviewerId: string;
  targetUserId: string;
  rating: number; // 1-5
  feedback: string;
  status: 'PUBLISHED';
  createdAt: string;
}

export interface ReviewSummary {
  userId: string;
  averageRating: number;
  reviewCount: number;
  calculatedAt: string;
}

export interface SettlementStatusInfo {
  bookingId: string;
  caseStatus: string;
  windowClosed: boolean;
  claimWindowClosesAt: string;
  waivedAt?: string | null;
  depositHeld: number;
  lateFine: number;
  totalDamageDeduction: number;
  claimsCount: number;
  openClaimsCount: number;
  openDisputesCount: number;
  eligibleForSettlement: boolean;
  settlementRequestId?: string;
  settlementRequestStatus?: string;
  evaluatedAt: string;
}

export interface BookingOverview {
  bookingId: string;
  claims: DamageClaim[];
  reviews: Review[];
  settlementStatus: SettlementStatusInfo;
}

// ============================================================================
// 7. GENERIC API RESPONSE & PAGINATION
// ============================================================================

export interface CursorList<T> {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  correlationId?: string;
  details?: unknown;
}
