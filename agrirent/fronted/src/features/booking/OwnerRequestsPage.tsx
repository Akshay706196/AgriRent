import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  FileText
} from 'lucide-react';
import { bookingApi } from '../../api/booking.api';
import { claimsApi } from '../../api/claims.api';
import { Booking } from '../../api/types';
import { StatusStepper } from '../../components/ui/StatusStepper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { OwnerHandoverModal } from '../handover/OwnerHandoverModal';
import { OwnerReturnModal } from '../handover/OwnerReturnModal';
import { ClaimModal } from '../claims/ClaimModal';
import { formatINR } from '../../utils/formatCurrency';
import { formatShortDate, calculateRentalDays, getApprovalDeadline } from '../../utils/formatDate';
import { useCountdown } from '../../hooks/useCountdown';
import { useNotification } from '../../context/NotificationContext';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';

const OwnerRequestCard: React.FC<{
  booking: Booking;
  onApprove: (id: string) => void;
  onRejectPrompt: (booking: Booking) => void;
  onOpenHandover: (id: string) => void;
  onOpenReturn: (id: string) => void;
  onOpenClaim: (booking: Booking) => void;
  onWaiveClaim: (id: string) => void;
  isApproving: boolean;
}> = ({
  booking,
  onApprove,
  onRejectPrompt,
  onOpenHandover,
  onOpenReturn,
  onOpenClaim,
  onWaiveClaim,
  isApproving,
}) => {
  const rentalDays = calculateRentalDays(booking.startDate, booking.endDate);

  // Approval deadline countdown (24h from creation)
  const approvalDeadline = getApprovalDeadline(booking.createdAt);
  const { formattedTime: approvalCountdown, isExpired: isApprovalExpired } = useCountdown(
    booking.status === 'PENDING_OWNER' ? approvalDeadline : undefined
  );

  return (
    <div className="bg-white rounded-2xl border border-earth-200 shadow-soft overflow-hidden transition-all hover:shadow-card hover:border-earth-300">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-semibold text-earth-500">#{booking.bookingId}</span>
              <Badge status={booking.status} />
            </div>
            <h3 className="text-lg font-bold text-earth-900 mt-1">
              Rental Request for Equipment #{booking.equipmentId}
            </h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-earth-500 block">Payout (Rental Fee)</span>
            <span className="text-lg font-extrabold text-emerald-800">
              {formatINR(booking.rentalAmount || 0)}
            </span>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="py-2 border-y border-earth-100 my-4 overflow-x-auto">
          <StatusStepper currentStatus={booking.status} />
        </div>

        {/* Date and Timeline Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-earth-700 mb-4 bg-earth-50/70 rounded-xl p-3.5">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-earth-500" />
            <span>
              <strong>{formatShortDate(booking.startDate)}</strong> – <strong>{formatShortDate(booking.endDate)}</strong>
              <span className="text-xs text-earth-500 ml-1.5">({rentalDays} days)</span>
            </span>
          </div>

          {booking.status === 'PENDING_OWNER' && (
            <div className="flex items-center text-amber-800 font-medium">
              <Clock className="w-4 h-4 mr-1.5 text-amber-600" />
              <span>
                Approval Deadline:{' '}
                {isApprovalExpired ? <span className="text-red-600 font-bold">Expired</span> : <strong>{approvalCountdown}</strong>}
              </span>
            </div>
          )}

          {booking.status === 'PAID' && (
            <div className="flex items-center text-emerald-700 font-medium">
              <KeyRound className="w-4 h-4 mr-1.5" />
              <span>Renter has paid. Verify their Handover PIN at pickup.</span>
            </div>
          )}

          {booking.status === 'IN_RENTAL' && (
            <div className="flex items-center text-amber-700 font-medium">
              <Clock className="w-4 h-4 mr-1.5" />
              <span>Currently in rental. Enter Return PIN upon return.</span>
            </div>
          )}

          {booking.status === 'RETURNED' && (
            <div className="flex items-center text-earth-700 font-medium">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
              <span>Returned. You may file damage claim or confirm no damage.</span>
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            to={`/bookings/${booking.bookingId}/overview`}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center"
          >
            Full Booking Overview
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {booking.status === 'PENDING_OWNER' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRejectPrompt(booking)}
                  className="text-red-700 border-red-300 hover:bg-red-50"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Decline
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onApprove(booking.bookingId)}
                  isLoading={isApproving}
                  disabled={isApprovalExpired}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Approve Request
                </Button>
              </>
            )}

            {booking.status === 'PAID' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenHandover(booking.bookingId)}
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                Enter Handover PIN
              </Button>
            )}

            {booking.status === 'IN_RENTAL' && (
              <Button
                variant="accent"
                size="sm"
                onClick={() => onOpenReturn(booking.bookingId)}
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                Enter Return PIN
              </Button>
            )}

            {booking.status === 'RETURNED' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onWaiveClaim(booking.bookingId)}
                  className="text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                >
                  Confirm No Damage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenClaim(booking)}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  File Damage Claim
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const OwnerRequestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { key: waiveKey } = useIdempotencyKey('waive-claims');

  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeHandoverId, setActiveHandoverId] = useState<string | null>(null);
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null);
  const [activeClaimBooking, setActiveClaimBooking] = useState<Booking | null>(null);

  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ['owner-requests'],
    queryFn: () => bookingApi.getOwnerRequests(),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => bookingApi.approveBooking(id),
    onSuccess: () => {
      showNotification('success', 'Booking approved! Renter has 24 hours to complete payment.');
      queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to approve booking.');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingApi.rejectBooking(id, reason),
    onSuccess: () => {
      showNotification('info', 'Booking request declined.');
      setRejectingBooking(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to reject booking.');
    },
  });

  // Waive claim mutation
  const waiveMutation = useMutation({
    mutationFn: (bookingId: string) => claimsApi.waiveClaims(bookingId, waiveKey),
    onSuccess: () => {
      showNotification('success', 'No damage confirmed! Security deposit released for settlement.');
      queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to waive damage claim.');
    },
  });

  const filtered = (requests || []).filter((b) => {
    if (filterTab === 'PENDING') return b.status === 'PENDING_OWNER';
    if (filterTab === 'ACTIVE') return ['APPROVED', 'PAID', 'IN_RENTAL'].includes(b.status);
    if (filterTab === 'COMPLETED') return ['RETURNED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(b.status);
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
          Incoming Rental Requests
        </h1>
        <p className="text-earth-600 text-sm mt-1">
          Review booking requests from nearby farmers, verify handover & return PINs, and manage machine checkouts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-earth-200 mb-6">
        {[
          { id: 'ALL', label: 'All Requests' },
          { id: 'PENDING', label: 'Pending Approval' },
          { id: 'ACTIVE', label: 'Active Rentals' },
          { id: 'COMPLETED', label: 'Completed & Returned' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterTab(t.id as any)}
            className={`pb-3 px-3 text-sm font-semibold transition-colors border-b-2 ${
              filterTab === t.id
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-earth-500 hover:text-earth-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <p className="font-semibold">Unable to load booking requests.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No booking requests"
          description={filterTab === 'ALL' ? "You have no incoming booking requests at this time." : `No requests in '${filterTab.toLowerCase()}'.`}
          actionLabel="View My Equipment"
          onAction={() => window.location.assign('/owner/equipment')}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((booking) => (
            <OwnerRequestCard
              key={booking.bookingId}
              booking={booking}
              onApprove={(id) => approveMutation.mutate(id)}
              onRejectPrompt={(b) => setRejectingBooking(b)}
              onOpenHandover={(id) => setActiveHandoverId(id)}
              onOpenReturn={(id) => setActiveReturnId(id)}
              onOpenClaim={(b) => setActiveClaimBooking(b)}
              onWaiveClaim={(id) => waiveMutation.mutate(id)}
              isApproving={approveMutation.isPending && approveMutation.variables === booking.bookingId}
            />
          ))}
        </div>
      )}

      {/* Reject Reason Confirmation */}
      {rejectingBooking && (
        <ConfirmationDialog
          isOpen={!!rejectingBooking}
          onClose={() => setRejectingBooking(null)}
          onConfirm={() =>
            rejectMutation.mutate({
              id: rejectingBooking.bookingId,
              reason: rejectReason || 'Equipment unavailable or undergoing maintenance',
            })
          }
          title="Decline Booking Request"
          description="Are you sure you want to decline this booking request? The dates will remain open for other inquiries."
          confirmText="Decline Request"
          variant="danger"
          isLoading={rejectMutation.isPending}
        >
          <div className="mt-3">
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Reason for declining (optional)
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Scheduled for routine service, farm priority"
              className="w-full px-3 py-2 bg-earth-50 border border-earth-300 rounded-lg text-sm text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </ConfirmationDialog>
      )}

      {/* Handover Modal */}
      {activeHandoverId && (
        <OwnerHandoverModal
          isOpen={!!activeHandoverId}
          onClose={() => setActiveHandoverId(null)}
          bookingId={activeHandoverId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
          }}
        />
      )}

      {/* Return Modal */}
      {activeReturnId && (
        <OwnerReturnModal
          isOpen={!!activeReturnId}
          onClose={() => setActiveReturnId(null)}
          bookingId={activeReturnId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
          }}
        />
      )}

      {/* Claim Modal */}
      {activeClaimBooking && (
        <ClaimModal
          isOpen={!!activeClaimBooking}
          onClose={() => setActiveClaimBooking(null)}
          bookingId={activeClaimBooking.bookingId}
          depositAmount={activeClaimBooking.securityDeposit || 5000}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['owner-requests'] });
          }}
        />
      )}
    </div>
  );
};
