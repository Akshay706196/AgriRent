import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  Clock,
  Sparkles
} from 'lucide-react';
import { paymentApi } from '../../api/payment.api';
import { bookingApi } from '../../api/booking.api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatINR } from '../../utils/formatCurrency';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { useNotification } from '../../context/NotificationContext';
import { PaymentOrder } from '../../api/types';

export const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('bookingId') || '';
  const { showNotification } = useNotification();
  const { key: idempotencyKey, refreshKey } = useIdempotencyKey(`payment-${bookingId}`);

  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    'IDLE' | 'PENDING_VERIFICATION' | 'CONFIRMED' | 'FAILED'
  >('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load booking details
  const { data: booking, isLoading: isBookingLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingApi.getBookingById(bookingId),
    enabled: !!bookingId,
  });

  // Check current payment status if already confirmed
  const { data: currentPaymentStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['payment-status', bookingId],
    queryFn: () => paymentApi.getPaymentStatus(bookingId),
    enabled: !!bookingId,
    refetchInterval: verificationStatus === 'PENDING_VERIFICATION' ? 2500 : false,
  });

  // Watch status changes during polling
  useEffect(() => {
    if (currentPaymentStatus?.paymentStatus === 'CONFIRMED') {
      setVerificationStatus('CONFIRMED');
    } else if (currentPaymentStatus?.paymentStatus === 'FAILED') {
      setVerificationStatus('FAILED');
    }
  }, [currentPaymentStatus]);

  // Initiate Payment Order Mutation
  const initiateMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      return paymentApi.initiatePayment(bookingId, idempotencyKey, 'simulator');
    },
    onSuccess: (order) => {
      setPaymentOrder(order);
      showNotification('info', 'Payment order created with AgriRent Sandbox Gateway.');
    },
    onError: (err: any) => {
      setErrorMessage(err.friendlyMessage || err.message || 'Failed to initiate payment.');
      showNotification('error', err.friendlyMessage || err.message);
      refreshKey();
    },
  });

  // Verify Payment Mutation (Sandbox Simulator)
  const verifyMutation = useMutation({
    mutationFn: async (scenario: 'SUCCESS' | 'FAIL' | 'SLOW') => {
      if (!paymentOrder?.paymentId) throw new Error('No active payment order to verify.');
      setVerificationStatus('PENDING_VERIFICATION');

      if (scenario === 'FAIL') {
        const ref = `SIM-FAIL-${Date.now()}`;
        return paymentApi.verifyPayment(paymentOrder.paymentId, ref, idempotencyKey);
      } else if (scenario === 'SLOW') {
        // Wait 3 seconds to test pending verification state
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const ref = `SIM-TXN-${Date.now()}`;
        return paymentApi.verifyPayment(paymentOrder.paymentId, ref, idempotencyKey);
      } else {
        const ref = `SIM-TXN-${Date.now()}`;
        return paymentApi.verifyPayment(paymentOrder.paymentId, ref, idempotencyKey);
      }
    },
    onSuccess: (res) => {
      if (res.status === 'CONFIRMED') {
        setVerificationStatus('CONFIRMED');
        showNotification('success', 'Payment & Security Deposit Hold Confirmed!');
      } else if (res.status === 'FAILED') {
        setVerificationStatus('FAILED');
        setErrorMessage('Sandbox simulated payment decline.');
        showNotification('error', 'Payment simulation failed.');
      } else {
        setVerificationStatus('PENDING_VERIFICATION');
      }
      refetchStatus();
    },
    onError: (err: any) => {
      setVerificationStatus('FAILED');
      setErrorMessage(err.friendlyMessage || err.message || 'Verification failed.');
      showNotification('error', err.friendlyMessage || err.message);
      refreshKey();
    },
  });

  if (!bookingId) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <p className="text-earth-600 mb-4">No booking ID provided.</p>
        <Link to="/renter/bookings">
          <Button variant="primary">Go to My Bookings</Button>
        </Link>
      </div>
    );
  }

  if (isBookingLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const isConfirmed = verificationStatus === 'CONFIRMED' || currentPaymentStatus?.paymentStatus === 'CONFIRMED';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <Link
        to={`/renter/bookings/${bookingId}`}
        className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to Booking #{bookingId}
      </Link>

      {/* Sandbox Banner */}
      <div className="bg-amber-100/80 border border-amber-300 rounded-2xl p-4 mb-6 flex items-start space-x-3">
        <Sparkles className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-amber-950">
            AgriRent Payment Gateway Sandbox Environment
          </h3>
          <p className="text-xs text-amber-900 mt-0.5">
            Real bank cards and UPI apps are not charged. Use the simulator outcome triggers below to test
            instant confirmation, failure recovery, or asynchronous polling.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-soft space-y-6">
        <div className="flex items-center justify-between border-b border-earth-100 pb-5">
          <div>
            <h1 className="text-2xl font-display font-bold text-earth-900">
              Complete Payment & Escrow
            </h1>
            <p className="text-xs text-earth-500 mt-1">
              Booking Ref: <span className="font-mono font-semibold">#{bookingId}</span>
            </p>
          </div>
          <Badge status={isConfirmed ? 'PAID' : booking?.status || 'PENDING'} />
        </div>

        {/* Financial Breakdown */}
        <div className="bg-earth-50 rounded-2xl p-5 space-y-3 text-sm">
          <h2 className="text-xs font-bold text-earth-600 uppercase tracking-wider">
            Fee & Deposit Breakdown
          </h2>
          <div className="flex justify-between text-earth-700">
            <span>Machinery Rental Fee:</span>
            <span className="font-semibold">{formatINR(booking?.rentalAmount || 0)}</span>
          </div>
          <div className="flex justify-between text-earth-700">
            <span>Platform Service Fee:</span>
            <span className="font-semibold">{formatINR(booking?.platformFee || 0)}</span>
          </div>
          <div className="flex justify-between text-earth-700">
            <span>Refundable Security Deposit (Held in Escrow):</span>
            <span className="font-semibold text-emerald-800">{formatINR(booking?.securityDeposit || 0)}</span>
          </div>
          <div className="border-t border-earth-200 pt-3 flex justify-between text-base font-extrabold text-earth-900">
            <span>Total Payable Now:</span>
            <span className="text-emerald-700">
              {formatINR(booking?.totalAmount || booking?.rentalAmount || 0)}
            </span>
          </div>
        </div>

        {/* State 1: Confirmed State */}
        {isConfirmed ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-emerald-950">
                Payment & Deposit Verified!
              </h3>
              <p className="text-xs text-emerald-800 mt-1">
                Your reservation is confirmed. Security deposit is safely held in escrow.
              </p>
            </div>
            <div className="pt-2">
              <Link to={`/renter/bookings/${bookingId}`}>
                <Button variant="primary">
                  View Handover PIN & Details
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* State 2: Checkout / Payment Steps */
          <div className="space-y-6">
            {!paymentOrder ? (
              <div className="text-center py-4">
                <p className="text-sm text-earth-600 mb-4">
                  Click below to initialize your secure transaction with the sandbox gateway.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => initiateMutation.mutate()}
                  isLoading={initiateMutation.isPending}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Initiate Sandbox Payment
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 border border-earth-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-earth-500">Order ID:</span>
                    <span className="font-mono font-bold text-earth-900">{paymentOrder.paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-earth-500">Gateway Provider:</span>
                    <span className="font-semibold text-emerald-700 uppercase">{paymentOrder.gateway}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-earth-500">Status:</span>
                    <span className="font-semibold text-earth-900">{paymentOrder.status}</span>
                  </div>
                </div>

                {/* Polling/Verification Spinner */}
                {verificationStatus === 'PENDING_VERIFICATION' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center space-x-3 text-amber-900 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Awaiting Gateway Confirmation...</p>
                      <p className="text-xs text-amber-800">
                        Polling payment status with backoff until verified by backend.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-700 flex items-start">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Sandbox Outcome Controls */}
                <div className="border-t border-earth-200 pt-5 space-y-3">
                  <h4 className="text-xs font-bold text-earth-700 uppercase tracking-wider text-center">
                    Select Simulated Outcome
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant="primary"
                      onClick={() => verifyMutation.mutate('SUCCESS')}
                      isLoading={verifyMutation.isPending && verifyMutation.variables === 'SUCCESS'}
                      disabled={verifyMutation.isPending}
                    >
                      Simulate Success
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => verifyMutation.mutate('SLOW')}
                      isLoading={verifyMutation.isPending && verifyMutation.variables === 'SLOW'}
                      disabled={verifyMutation.isPending}
                    >
                      Simulate Delayed
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => verifyMutation.mutate('FAIL')}
                      isLoading={verifyMutation.isPending && verifyMutation.variables === 'FAIL'}
                      disabled={verifyMutation.isPending}
                      className="text-red-700 border-red-300 hover:bg-red-50"
                    >
                      Simulate Failure
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
