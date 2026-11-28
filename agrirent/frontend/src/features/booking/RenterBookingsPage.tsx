import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, AlertCircle, ArrowRight, ShieldCheck, Clock, CreditCard, KeyRound } from 'lucide-react';
import { bookingApi } from '../../api/booking.api';
import { Booking } from '../../api/types';
import { StatusStepper } from '../../components/ui/StatusStepper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatINR } from '../../utils/formatCurrency';
import { formatShortDate, calculateRentalDays, getApprovalDeadline } from '../../utils/formatDate';
import { useCountdown } from '../../hooks/useCountdown';

const BookingCard: React.FC<{ booking: Booking }> = ({ booking }) => {
  const rentalDays = calculateRentalDays(booking.startDate, booking.endDate);

  // Approval deadline countdown (24h from createdAt)
  const approvalDeadline = getApprovalDeadline(booking.createdAt);
  const { formattedTime: timeRemaining, isExpired } = useCountdown(
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
              Equipment Booking
            </h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-earth-500 block">Total Amount</span>
            <span className="text-lg font-extrabold text-emerald-800">
              {formatINR(booking.totalAmount || booking.rentalAmount || 0)}
            </span>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="py-2 border-y border-earth-100 my-4 overflow-x-auto">
          <StatusStepper currentStatus={booking.status} />
        </div>

        {/* Dates and Countdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-earth-700 mb-4 bg-earth-50/70 rounded-xl p-3.5">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-earth-500" />
            <span>
              <strong>{formatShortDate(booking.startDate)}</strong> – <strong>{formatShortDate(booking.endDate)}</strong>
              <span className="text-xs text-earth-500 ml-1.5">({rentalDays} days)</span>
            </span>
          </div>

          {booking.status === 'PENDING_OWNER' && (
            <div className="flex items-center text-amber-700 font-medium">
              <Clock className="w-4 h-4 mr-1.5" />
              <span>
                Owner Approval Deadline:{' '}
                {isExpired ? <span className="text-red-600 font-bold">Expired</span> : <strong>{timeRemaining}</strong>}
              </span>
            </div>
          )}

          {booking.status === 'APPROVED' && (
            <div className="flex items-center text-emerald-700 font-medium">
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              <span>Approved! Payment required to confirm reservation.</span>
            </div>
          )}

          {booking.status === 'PAID' && (
            <div className="flex items-center text-emerald-700 font-medium">
              <KeyRound className="w-4 h-4 mr-1.5" />
              <span>Payment Confirmed. Ready for PIN handover on start date.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            to={`/renter/bookings/${booking.bookingId}`}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center"
          >
            View Full Details
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>

          <div className="flex items-center space-x-2">
            {booking.status === 'APPROVED' && (
              <Link to={`/payments/checkout?bookingId=${booking.bookingId}`}>
                <Button variant="primary" size="sm">
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  Pay & Confirm
                </Button>
              </Link>
            )}

            {booking.status === 'PAID' && (
              <Link to={`/renter/bookings/${booking.bookingId}`}>
                <Button variant="primary" size="sm">
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                  View Handover PIN
                </Button>
              </Link>
            )}

            {booking.status === 'IN_RENTAL' && (
              <Link to={`/renter/bookings/${booking.bookingId}`}>
                <Button variant="accent" size="sm">
                  Generate Return PIN
                </Button>
              </Link>
            )}

            {['RETURNED', 'COMPLETED'].includes(booking.status) && (
              <Link to={`/bookings/${booking.bookingId}/overview`}>
                <Button variant="outline" size="sm">
                  Overview & Reviews
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const RenterBookingsPage: React.FC = () => {
  const [tab, setTab] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');

  const { data: bookings, isLoading, error, refetch } = useQuery({
    queryKey: ['renter-bookings'],
    queryFn: () => bookingApi.getMyBookings(),
  });

  const filteredBookings = (bookings || []).filter((b) => {
    if (tab === 'ACTIVE') return ['PENDING_OWNER', 'APPROVED', 'PAID', 'IN_RENTAL'].includes(b.status);
    if (tab === 'COMPLETED') return ['RETURNED', 'COMPLETED'].includes(b.status);
    if (tab === 'CANCELLED') return ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(b.status);
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
            My Rental Bookings
          </h1>
          <p className="text-earth-600 text-sm mt-1">
            Track your rental requests, approvals, PIN handovers, and return settlements.
          </p>
        </div>
        <Link to="/search">
          <Button variant="primary" size="sm">
            Rent New Machinery
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-earth-200 mb-6">
        {[
          { id: 'ALL', label: 'All Bookings' },
          { id: 'ACTIVE', label: 'Active Rentals' },
          { id: 'COMPLETED', label: 'Completed' },
          { id: 'CANCELLED', label: 'Cancelled / Rejected' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`pb-3 px-3 text-sm font-semibold transition-colors border-b-2 ${
              tab === t.id
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
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="font-semibold">Unable to load your bookings.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Retry
          </Button>
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description={tab === 'ALL' ? "You haven't requested any farm equipment rentals yet." : `No bookings in '${tab.toLowerCase()}' status.`}
          actionLabel="Browse Available Equipment"
          onAction={() => window.location.assign('/search')}
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <BookingCard key={booking.bookingId} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
};
