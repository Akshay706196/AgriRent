import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  KeyRound,
  RefreshCw,
  FileText,
  DollarSign,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { bookingApi } from '../../api/booking.api';
import { handoverApi } from '../../api/handover.api';
import { paymentApi } from '../../api/payment.api';
import { StatusStepper } from '../../components/ui/StatusStepper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { useNotification } from '../../context/NotificationContext';
import { useCountdown } from '../../hooks/useCountdown';
import { formatINR } from '../../utils/formatCurrency';
import { formatDateTime, formatShortDate, calculateRentalDays, getApprovalDeadline } from '../../utils/formatDate';
import { PinIssueResponse, LateFineSummary } from '../../api/types';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { ReviewModal } from '../claims/ReviewModal';

export const BookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { key: cancelKey } = useIdempotencyKey('cancel-booking');
  const { key: pinKey, refreshKey: refreshPinKey } = useIdempotencyKey('pin-gen');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Active PIN state (in memory only, never persisted)
  const [activePinData, setActivePinData] = useState<{
    type: 'HANDOVER' | 'RETURN';
    pinId: string;
    expiresAt: string;
    dev_pin?: string;
  } | null>(null);

  // Fetch booking details
  const { data: booking, isLoading: isBookingLoading, error: bookingError } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingApi.getBookingById(bookingId!),
    enabled: !!bookingId,
  });

  // Fetch payment status
  const { data: paymentStatus } = useQuery({
    queryKey: ['payment-status', bookingId],
    queryFn: () => paymentApi.getPaymentStatus(bookingId!),
    enabled: !!bookingId && ['PAID', 'IN_RENTAL', 'RETURNED', 'COMPLETED'].includes(booking?.status || ''),
  });

  // Fetch late fine if returned
  const { data: lateFine } = useQuery<LateFineSummary>({
    queryKey: ['late-fine', bookingId],
    queryFn: () => handoverApi.getLateFine(bookingId!),
    enabled: !!bookingId && ['RETURNED', 'COMPLETED'].includes(booking?.status || ''),
    retry: false,
  });

  // Approval deadline countdown
  const approvalDeadline = getApprovalDeadline(booking?.createdAt);
  const { formattedTime: approvalCountdown, isExpired: isApprovalExpired } = useCountdown(
    booking?.status === 'PENDING_OWNER' ? approvalDeadline : undefined
  );

  // Active PIN countdown
  const { formattedTime: pinCountdown, isExpired: isPinExpired } = useCountdown(activePinData?.expiresAt);

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: () => bookingApi.cancelBooking(bookingId!, cancelReason || 'Cancelled by renter'),
    onSuccess: () => {
      showNotification('success', 'Booking has been cancelled.');
      setIsCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['renter-bookings'] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to cancel booking.');
    },
  });

  // Handover PIN mutation
  const handoverPinMutation = useMutation({
    mutationFn: () => handoverApi.generateHandoverPin(bookingId!, pinKey),
    onSuccess: (res: PinIssueResponse) => {
      setActivePinData({
        type: 'HANDOVER',
        pinId: res.pinId,
        expiresAt: res.expiresAt,
        dev_pin: res.dev_pin,
      });
      refreshPinKey();
      showNotification(
        'info',
        'Handover PIN generated! It has been dispatched to your phone via SMS/notification.'
      );
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to generate handover PIN.');
      refreshPinKey();
    },
  });

  // Return PIN mutation
  const returnPinMutation = useMutation({
    mutationFn: () => handoverApi.generateReturnPin(bookingId!, pinKey),
    onSuccess: (res: PinIssueResponse) => {
      setActivePinData({
        type: 'RETURN',
        pinId: res.pinId,
        expiresAt: res.expiresAt,
        dev_pin: res.dev_pin,
      });
      refreshPinKey();
      showNotification(
        'info',
        'Return PIN generated! It has been dispatched to your phone via SMS/notification.'
      );
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to generate return PIN.');
      refreshPinKey();
    },
  });

  if (isBookingLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (bookingError || !booking) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-earth-900 mb-2">Booking Not Found</h2>
        <p className="text-earth-600 mb-6">Unable to load details for booking #{bookingId}.</p>
        <Link to="/renter/bookings">
          <Button variant="primary">Back to My Bookings</Button>
        </Link>
      </div>
    );
  }

  const rentalDays = calculateRentalDays(booking.startDate, booking.endDate);
  const isDev = import.meta.env.DEV;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <Link
        to="/renter/bookings"
        className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to My Bookings
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
              Booking #{booking.bookingId}
            </h1>
            <Badge status={booking.status} />
          </div>
          <p className="text-earth-500 text-xs">
            Created on {formatDateTime(booking.createdAt)}
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {booking.status === 'APPROVED' && (
            <Link to={`/payments/checkout?bookingId=${booking.bookingId}`}>
              <Button variant="primary" size="sm">
                <CreditCard className="w-4 h-4 mr-1.5" />
                Pay & Confirm Rental
              </Button>
            </Link>
          )}

          {['PENDING_OWNER', 'APPROVED'].includes(booking.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="text-red-700 border-red-300 hover:bg-red-50"
            >
              Cancel Booking
            </Button>
          )}

          {['RETURNED', 'COMPLETED'].includes(booking.status) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReviewModalOpen(true)}
              >
                <MessageSquare className="w-4 h-4 mr-1.5 text-amber-500" />
                Leave Review
              </Button>
              <Link to={`/bookings/${booking.bookingId}/overview`}>
                <Button variant="primary" size="sm">
                  View Full Overview
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Visual Status Stepper */}
      <div className="bg-white rounded-2xl p-6 border border-earth-200 shadow-soft mb-8">
        <h2 className="text-xs font-bold text-earth-500 uppercase tracking-wider mb-4">
          Booking Lifecycle Progress
        </h2>
        <StatusStepper currentStatus={booking.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left 2 Cols: Main Info & Actions */}
        <div className="md:col-span-2 space-y-6">
          {/* Approval Notice */}
          {booking.status === 'PENDING_OWNER' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start">
                <Clock className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-amber-900">
                    Awaiting Equipment Owner's Approval
                  </h3>
                  <p className="text-xs text-amber-800 mt-1">
                    The owner has 24 hours from submission to approve or reject your booking request.
                  </p>
                  <p className="text-xs font-semibold text-amber-900 mt-2">
                    Deadline:{' '}
                    {isApprovalExpired ? (
                      <span className="text-red-600">Expired</span>
                    ) : (
                      <span className="font-mono text-sm">{approvalCountdown}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Approved Notice */}
          {booking.status === 'APPROVED' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  Booking Approved by Owner!
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Complete your payment and security deposit escrow to lock in your reservation.
                </p>
              </div>
              <Link to={`/payments/checkout?bookingId=${booking.bookingId}`}>
                <Button variant="primary" size="sm">
                  Pay Now
                </Button>
              </Link>
            </div>
          )}

          {/* Handover PIN Section (When PAID) */}
          {booking.status === 'PAID' && (
            <div className="bg-white rounded-2xl p-6 border border-emerald-200 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-earth-900">Handover PIN Verification</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handoverPinMutation.mutate()}
                  isLoading={handoverPinMutation.isPending}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  {activePinData?.type === 'HANDOVER' ? 'Generate New PIN' : 'Generate PIN'}
                </Button>
              </div>

              <p className="text-xs text-earth-600 mb-4 leading-relaxed">
                When you meet the equipment owner at pickup, generate your 6-digit Handover PIN.
                Share it with the owner so they can unlock the equipment in their AgriRent portal.
                PINs expire in 15 minutes. Generating a new PIN supersedes any prior one.
              </p>

              {activePinData?.type === 'HANDOVER' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-emerald-800 font-semibold mb-1">
                    Handover PIN dispatched to registered SMS/Notification
                  </p>
                  <p className="text-xs text-earth-500 mb-2">
                    Valid for: <span className="font-mono font-bold text-emerald-800">{pinCountdown}</span>
                  </p>

                  {/* Dev exposed PIN badge (Only visible in DEV mode, never in production!) */}
                  {isDev && activePinData.dev_pin && (
                    <div className="mt-3 p-2.5 bg-purple-100 border border-purple-300 rounded-lg inline-block">
                      <span className="text-xs font-bold text-purple-900 block mb-0.5">
                        [DEV_EXPOSE_PIN - Testing Only]
                      </span>
                      <span className="font-mono text-xl font-black text-purple-950 tracking-widest">
                        {activePinData.dev_pin}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Return PIN Section (When IN_RENTAL) */}
          {booking.status === 'IN_RENTAL' && (
            <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-bold text-earth-900">Equipment Return PIN</h3>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => returnPinMutation.mutate()}
                  isLoading={returnPinMutation.isPending}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  {activePinData?.type === 'RETURN' ? 'Generate New PIN' : 'Generate Return PIN'}
                </Button>
              </div>

              <p className="text-xs text-earth-600 mb-4 leading-relaxed">
                When returning machinery, provide your Return PIN to the owner. Once they verify it,
                the rental concludes, and the return timestamp is recorded for late-fine calculations.
              </p>

              {activePinData?.type === 'RETURN' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-amber-800 font-semibold mb-1">
                    Return PIN dispatched to registered SMS/Notification
                  </p>
                  <p className="text-xs text-earth-500 mb-2">
                    Valid for: <span className="font-mono font-bold text-amber-900">{pinCountdown}</span>
                  </p>

                  {isDev && activePinData.dev_pin && (
                    <div className="mt-3 p-2.5 bg-purple-100 border border-purple-300 rounded-lg inline-block">
                      <span className="text-xs font-bold text-purple-900 block mb-0.5">
                        [DEV_EXPOSE_PIN - Testing Only]
                      </span>
                      <span className="font-mono text-xl font-black text-purple-950 tracking-widest">
                        {activePinData.dev_pin}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Late Fine Breakdown (When RETURNED / COMPLETED) */}
          {lateFine && (
            <div className="bg-white rounded-2xl p-6 border border-earth-200 shadow-soft">
              <h3 className="text-base font-bold text-earth-900 mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-earth-600" />
                Return & Late Fine Assessment
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-earth-50 p-3 rounded-xl">
                  <span className="text-earth-500 block">Overdue Duration</span>
                  <span className="font-bold text-earth-900 text-sm mt-0.5">
                    {lateFine.overdueHours ? `${lateFine.overdueHours} hrs` : 'None (On Time)'}
                  </span>
                </div>
                <div className="bg-earth-50 p-3 rounded-xl">
                  <span className="text-earth-500 block">Billable Overdue Days</span>
                  <span className="font-bold text-earth-900 text-sm mt-0.5">
                    {lateFine.billableOverdueDays || 0} days
                  </span>
                </div>
                <div className="bg-earth-50 p-3 rounded-xl">
                  <span className="text-earth-500 block">Daily Overdue Rate</span>
                  <span className="font-bold text-earth-900 text-sm mt-0.5">
                    {formatINR(lateFine.dailyOverdueRate || 0)}
                  </span>
                </div>
                <div className="bg-earth-50 p-3 rounded-xl">
                  <span className="text-earth-500 block">Calculated Fine</span>
                  <span className={`font-bold text-sm mt-0.5 ${lateFine.fineAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {formatINR(lateFine.fineAmount || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Rental Details */}
          <div className="bg-white rounded-2xl p-6 border border-earth-200 shadow-soft space-y-4">
            <h3 className="text-base font-bold text-earth-900">Rental Specification</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center text-earth-700">
                <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                <span>
                  <strong>Dates:</strong> {formatShortDate(booking.startDate)} to {formatShortDate(booking.endDate)}
                </span>
              </div>
              <div className="flex items-center text-earth-700">
                <Clock className="w-4 h-4 mr-2 text-emerald-600" />
                <span>
                  <strong>Duration:</strong> {rentalDays} {rentalDays === 1 ? 'day' : 'days'} (Exclusive End)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Price Snapshot & Escrow Status */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-earth-200 shadow-soft space-y-4">
            <h3 className="text-base font-bold text-earth-900">Financial Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-earth-600">
                <span>Rental Charge:</span>
                <span>{formatINR(booking.rentalAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-earth-600">
                <span>Platform Fee:</span>
                <span>{formatINR(booking.platformFee || 0)}</span>
              </div>
              <div className="flex justify-between text-earth-600">
                <span>Security Deposit:</span>
                <span>{formatINR(booking.securityDeposit || 0)}</span>
              </div>
              <div className="border-t border-earth-200 pt-2 flex justify-between font-bold text-base text-earth-900">
                <span>Total Amount:</span>
                <span className="text-emerald-800">
                  {formatINR(booking.totalAmount || booking.rentalAmount || 0)}
                </span>
              </div>
            </div>

            {/* Escrow Deposit Status */}
            {paymentStatus && (
              <div className="border-t border-earth-100 pt-4 mt-4">
                <h4 className="text-xs font-bold text-earth-700 uppercase tracking-wider mb-2">
                  Payment & Escrow Status
                </h4>
                <div className="bg-earth-50 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-earth-500">Rental Payment:</span>
                    <span className="font-semibold text-emerald-700">{paymentStatus.paymentStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-earth-500">Deposit Escrow:</span>
                    <span className="font-semibold text-emerald-700">{paymentStatus.depositStatus}</span>
                  </div>
                  {paymentStatus.heldDeposit !== undefined && paymentStatus.heldDeposit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-earth-500">Deposit Held:</span>
                      <span className="font-semibold">{formatINR(paymentStatus.heldDeposit)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmationDialog
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Equipment Booking"
        description="Are you sure you want to cancel this booking? If already approved, cancelling will free the dates for other farmers."
        confirmText="Confirm Cancellation"
        variant="danger"
        isLoading={cancelMutation.isPending}
      >
        <div className="mt-3">
          <label className="block text-xs font-semibold text-earth-700 mb-1">
            Reason for cancellation
          </label>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g., Weather delay, alternate equipment arranged"
            className="w-full px-3 py-2 bg-earth-50 border border-earth-300 rounded-lg text-sm text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </ConfirmationDialog>

      {/* Review Modal */}
      {isReviewModalOpen && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          bookingId={booking.bookingId}
          targetUserId={booking.ownerId}
          onSuccess={() => {
            setIsReviewModalOpen(false);
            showNotification('success', 'Your review and rating have been posted!');
          }}
        />
      )}
    </div>
  );
};
