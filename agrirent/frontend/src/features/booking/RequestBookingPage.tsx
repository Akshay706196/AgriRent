import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar, ShieldAlert, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { equipmentApi } from '../../api/equipment.api';
import { bookingApi } from '../../api/booking.api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { Button } from '../../components/ui/Button';
import { KycGate } from '../../components/common/KycGate';
import { formatINR } from '../../utils/formatCurrency';
import { calculateRentalDays, formatShortDate } from '../../utils/formatDate';
import { ApiError } from '../../api/errors';

export const RequestBookingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { key: idempotencyKey, refreshKey } = useIdempotencyKey('booking-request');

  const equipmentId = searchParams.get('equipmentId') || '';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';

  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch equipment details
  const { data: equipment, isLoading: isEquipLoading, error: equipError } = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: () => equipmentApi.getEquipmentById(equipmentId),
    enabled: !!equipmentId,
  });

  // Calculate rental days (half-open: end date exclusive)
  const rentalDays = calculateRentalDays(startDate, endDate);
  const isValidDateRange = rentalDays > 0;

  // Live availability check
  const { data: availability, isFetching: isCheckingAvail } = useQuery({
    queryKey: ['availability', equipmentId, startDate, endDate],
    queryFn: () => bookingApi.checkAvailability(equipmentId, startDate, endDate),
    enabled: !!equipmentId && isValidDateRange,
  });

  const dailyRate = equipment?.pricing?.perDay || 0;
  const deposit = equipment?.pricing?.securityDeposit || 0;
  const rentalAmount = dailyRate * rentalDays;
  const platformFee = Math.round(rentalAmount * 0.05); // 5% platform fee
  const totalAmount = rentalAmount + deposit + platformFee;

  // Create booking mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!equipmentId || !startDate || !endDate) {
        throw new Error('Please select valid rental dates.');
      }
      return bookingApi.createBooking(
        { equipmentId, startDate, endDate },
        idempotencyKey
      );
    },
    onSuccess: (booking) => {
      showNotification('success', 'Booking request submitted! Waiting for owner approval.');
      navigate(`/renter/bookings/${booking.bookingId || (booking as any).id}`);
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        if (err.code === 'DATE_CONFLICT') {
          setFormError('These dates were just booked by another farmer. Please choose alternative dates.');
        } else if (err.code === 'KYC_REQUIRED') {
          setFormError('Your account requires verified KYC before requesting equipment rentals.');
        } else {
          setFormError(err.friendlyMessage);
        }
        showNotification('error', err.friendlyMessage, err.correlationId);
      } else {
        setFormError(err.message || 'Failed to submit booking request.');
        showNotification('error', err.message);
      }
      refreshKey();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isValidDateRange) {
      setFormError('End date must be after start date (minimum 1 rental day).');
      return;
    }
    if (availability && !availability.available) {
      setFormError('Equipment is not available for these selected dates.');
      return;
    }

    createMutation.mutate();
  };

  if (!equipmentId) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <p className="text-earth-600 mb-4">No equipment selected.</p>
        <Link to="/search">
          <Button variant="primary">Browse Equipment</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <Link
        to={`/equipment/${equipmentId}`}
        className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to Equipment Details
      </Link>

      <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900 mb-2">
        Request Equipment Booking
      </h1>
      <p className="text-earth-600 mb-8">
        Review rental dates, inspect the fee breakdown, and send your request to the equipment owner.
      </p>

      {/* KYC Gate */}
      <div className="mb-6">
        <KycGate actionName="book equipment" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 cols: Date picker & notes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-earth-200 shadow-soft">
            <h2 className="text-lg font-bold text-earth-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-emerald-600" />
              Rental Dates (End Date Exclusive)
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1.5">
                    Start Date (Pickup)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1.5">
                    End Date (Exclusive)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    required
                  />
                </div>
              </div>

              {isValidDateRange && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-sm">
                  <div className="flex items-center text-emerald-900 font-medium">
                    <Clock className="w-4 h-4 mr-2 text-emerald-700" />
                    <span>
                      Duration: <strong>{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</strong> ({formatShortDate(startDate)} to {formatShortDate(endDate)})
                    </span>
                  </div>
                  {isCheckingAvail ? (
                    <span className="text-xs text-earth-500 font-medium">Checking availability...</span>
                  ) : availability?.available ? (
                    <span className="inline-flex items-center text-xs font-bold text-emerald-700">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-600">
                      <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                      Unavailable
                    </span>
                  )}
                </div>
              )}

              {formError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start">
                  <ShieldAlert className="w-5 h-5 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={createMutation.isPending}
                  disabled={!isValidDateRange || !availability?.available || user?.kycStatus !== 'VERIFIED'}
                >
                  Send Booking Request
                </Button>
                <p className="text-xs text-earth-500 text-center mt-2">
                  No payment is charged now. The owner has 24 hours to accept or decline.
                </p>
              </div>
            </form>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900 space-y-2">
            <h3 className="font-bold flex items-center text-amber-950">
              <ShieldAlert className="w-4 h-4 mr-2 text-amber-700" />
              AgriRent Rental Terms
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
              <li>Rental periods are counted on a calendar-day basis with end-date exclusive.</li>
              <li>Once accepted by owner, you have 24 hours to pay rental fee + security deposit.</li>
              <li>Security deposit is held in escrow and released after safe equipment return.</li>
            </ul>
          </div>
        </div>

        {/* Right col: Price snapshot & equipment summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-earth-200 shadow-soft space-y-4">
            <h3 className="text-base font-bold text-earth-900">Equipment Summary</h3>
            {equipment && (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={equipment.photos?.[0] || 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=300&q=80'}
                    alt={equipment.title}
                    className="w-16 h-16 rounded-xl object-cover border border-earth-200"
                  />
                  <div>
                    <h4 className="font-bold text-earth-900 text-sm leading-tight">{equipment.title}</h4>
                    <p className="text-xs text-earth-500">{equipment.category}</p>
                    <p className="text-xs text-earth-600 mt-1">
                      {equipment.location?.district}, {equipment.location?.state}
                    </p>
                  </div>
                </div>

                <div className="border-t border-earth-100 pt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-earth-700">
                    <span>Daily Rental Rate:</span>
                    <span className="font-semibold">{formatINR(dailyRate)}/day</span>
                  </div>
                  <div className="flex justify-between text-earth-700">
                    <span>Security Deposit (Refundable):</span>
                    <span className="font-semibold">{formatINR(deposit)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-earth-200 pt-4 space-y-2.5 text-sm">
              <h4 className="font-bold text-earth-900 text-xs uppercase tracking-wider">Price Breakdown</h4>
              <div className="flex justify-between text-earth-600">
                <span>Rental ({rentalDays || 0} days × {formatINR(dailyRate)}):</span>
                <span>{formatINR(rentalAmount)}</span>
              </div>
              <div className="flex justify-between text-earth-600">
                <span>Platform Fee (5%):</span>
                <span>{formatINR(platformFee)}</span>
              </div>
              <div className="flex justify-between text-earth-600">
                <span>Security Deposit (held):</span>
                <span>{formatINR(deposit)}</span>
              </div>
              <div className="border-t border-earth-200 pt-2 flex justify-between text-base font-bold text-earth-900">
                <span>Total Payable:</span>
                <span className="text-emerald-700">{formatINR(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
