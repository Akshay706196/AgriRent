import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, AlertCircle, CheckCircle2, Tractor, ShieldCheck, DollarSign, Clock, ArrowLeft, Info } from 'lucide-react';
import { equipmentService } from '../services/equipmentService';
import { bookingService } from '../services/bookingService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatCurrency';
import { calculateDays, formatDate } from '../utils/formatDate';
import { getErrorMessage } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CreateBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isKycVerified } = useAuth();

  const equipmentId = searchParams.get('equipmentId');

  // Dates state (YYYY-MM-DD)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dayAfterTomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(dayAfterTomorrow);

  // Equipment data & availability
  const [equipment, setEquipment] = useState(null);
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  useEffect(() => {
    if (!equipmentId) {
      setError('No equipment specified for booking. Please select an equipment listing first.');
      setLoadingEquipment(false);
      return;
    }
    fetchEquipment();
  }, [equipmentId]);

  useEffect(() => {
    if (equipment && startDate && endDate && new Date(endDate) > new Date(startDate)) {
      verifyAvailability();
    }
  }, [startDate, endDate, equipment]);

  const fetchEquipment = async () => {
    try {
      setLoadingEquipment(true);
      setError(null);
      const res = await equipmentService.getEquipmentById(equipmentId);
      setEquipment(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingEquipment(false);
    }
  };

  const verifyAvailability = async () => {
    try {
      setCheckingAvailability(true);
      const eqId = equipment.equipmentId || equipment._id || equipment.id;
      const res = await bookingService.checkAvailability(eqId, startDate, endDate);
      setAvailabilityResult(res);
    } catch (err) {
      console.warn('Availability check error:', err);
      setAvailabilityResult({ isAvailable: true }); // Fallback to allowing submit; backend enforces mutex
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Pricing calculations
  const days = calculateDays(startDate, endDate);
  const dailyRate = equipment?.pricePerDay || equipment?.dailyRate || 0;
  const rentalAmount = days * dailyRate;
  const platformFee = Math.round(rentalAmount * 0.03 * 100) / 100;
  const deposit = equipment?.securityDeposit || 0;
  const estimatedTotal = rentalAmount + platformFee + deposit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBookingSuccess(null);

    if (!startDate || !endDate) {
      setError('Please select valid start and end dates.');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('End date must be strictly later than start date.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (startDate < today) {
      setError('Start date cannot be in the past.');
      return;
    }

    if (user && equipment && (equipment.ownerId === user._id || equipment.ownerId === user.id)) {
      setError('You are the registered owner of this equipment and cannot rent your own machinery.');
      return;
    }

    try {
      setSubmitting(true);
      const eqId = equipment.equipmentId || equipment._id || equipment.id;
      const booking = await bookingService.createBooking({
        equipmentId: eqId,
        startDate,
        endDate
      });

      setBookingSuccess(booking);
      // Automatically redirect after 2 seconds
      setTimeout(() => {
        const id = booking.bookingId || booking._id || booking.id;
        navigate(id ? `/bookings/${id}` : '/my-bookings');
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEquipment) {
    return <LoadingSpinner message="Loading machinery booking details..." />;
  }

  if (!equipment) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-12) 0' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--color-error)', margin: '0 auto var(--spacing-4)' }} />
          <h3>Equipment Not Found</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>{error || 'Invalid equipment ID specified.'}</p>
          <Link to="/equipment" className="btn btn-primary" style={{ marginTop: 'var(--spacing-4)' }}>
            Browse Machinery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-8) 0' }}>
      <div className="container" style={{ maxWidth: '820px' }}>
        {/* Back Link */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <Link to={`/equipment/${equipment.equipmentId || equipment._id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to Equipment Page
          </Link>
        </div>

        {/* KYC Gate Notice */}
        {!isKycVerified && (
          <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-6)' }}>
            <ShieldCheck size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>KYC Verification Required by Booking Service:</strong>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-xs)' }}>
                The Booking Microservice requires verified KYC before creating rental reservations.
              </p>
              <div style={{ marginTop: '6px' }}>
                <Link to="/kyc" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                  Complete KYC Verification Now &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Success Confirmation Alert */}
        {bookingSuccess && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-6)' }}>
            <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 'var(--font-lg)' }}>Booking Request Created Successfully!</h3>
              <p style={{ margin: 0, fontSize: 'var(--font-sm)' }}>
                Booking ID: <strong>{bookingSuccess.bookingId || bookingSuccess._id}</strong> • Status: <strong>{bookingSuccess.status || 'PENDING'}</strong>
              </p>
              <div style={{ fontSize: 'var(--font-xs)', marginTop: '6px' }}>
                Redirecting to your booking details page...
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--spacing-8)', alignItems: 'start' }}>
          {/* Left Column: Form & Date Selection */}
          <div className="card" style={{ padding: 'var(--spacing-6)' }}>
            <h2 style={{ fontSize: 'var(--font-xl)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Reserve Agricultural Machinery
            </h2>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-start">Rental Start Date *</label>
                  <input
                    id="book-start"
                    type="date"
                    className="form-control"
                    min={new Date().toISOString().split('T')[0]}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  <div className="form-hint">Inclusive pick-up day</div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="book-end">Rental End Date *</label>
                  <input
                    id="book-end"
                    type="date"
                    className="form-control"
                    min={startDate || new Date().toISOString().split('T')[0]}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                  <div className="form-hint">Return date (half-open)</div>
                </div>
              </div>

              {/* Live Availability Indicator */}
              <div style={{
                padding: 'var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                marginBottom: 'var(--spacing-6)',
                fontSize: 'var(--font-xs)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Microservice Availability Check:</span>
                  {checkingAvailability ? (
                    <span style={{ color: 'var(--color-text-muted)' }}>Checking schedule...</span>
                  ) : availabilityResult?.isAvailable === false ? (
                    <span className="badge badge-error">Date Conflict Detected</span>
                  ) : (
                    <span className="badge badge-success">Dates Currently Open</span>
                  )}
                </div>
                <p style={{ margin: '6px 0 0', color: 'var(--color-text-light)', fontSize: '11px' }}>
                  Interval convention: <code>[startDate, endDate)</code>. Authoritative availability is verified by the backend on submission.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !isKycVerified || (availabilityResult && availabilityResult.isAvailable === false)}
                style={{ width: '100%', padding: '12px', fontSize: 'var(--font-base)', fontWeight: 700 }}
              >
                {submitting ? 'Submitting Reservation Request...' : 'Confirm & Request Booking'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 'var(--spacing-3)', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                The equipment owner has 24 hours to review and accept your booking request.
              </div>
            </form>
          </div>

          {/* Right Column: Machinery Summary & Price Breakdown */}
          <div>
            <div className="card" style={{ padding: 'var(--spacing-6)', marginBottom: 'var(--spacing-6)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-4)', alignItems: 'center', marginBottom: 'var(--spacing-4)', paddingBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#e8f5e9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)'
                }}>
                  <Tractor size={30} />
                </div>
                <div>
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{equipment.category}</span>
                  <h3 style={{ margin: '4px 0 0', fontSize: 'var(--font-base)', color: 'var(--color-text-main)' }}>
                    {equipment.name || equipment.title}
                  </h3>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                    ID: {equipment.equipmentId || equipment._id}
                  </div>
                </div>
              </div>

              {/* Price Calculation Estimate */}
              <h4 style={{ fontSize: 'var(--font-sm)', margin: '0 0 var(--spacing-3)', color: 'var(--color-text-main)' }}>
                Estimated Financial Summary
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', fontSize: 'var(--font-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                  <span>Rental Duration</span>
                  <strong>{days} {days === 1 ? 'day' : 'days'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                  <span>Rate per day</span>
                  <span>{formatCurrency(dailyRate)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                  <span>Equipment Subtotal ({days} × {formatCurrency(dailyRate)})</span>
                  <strong>{formatCurrency(rentalAmount)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Platform Service Fee (3%)
                  </span>
                  <span>{formatCurrency(platformFee)}</span>
                </div>

                {deposit > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                    <span>Refundable Security Deposit</span>
                    <span>{formatCurrency(deposit)}</span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  paddingTop: 'var(--spacing-3)',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 'var(--font-base)',
                  fontWeight: 700,
                  color: 'var(--color-primary-dark)'
                }}>
                  <span>Total Estimated Amount</span>
                  <span style={{ fontSize: 'var(--font-xl)' }}>{formatCurrency(estimatedTotal)}</span>
                </div>
              </div>

              <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <Info size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Authoritative pricing is calculated and validated directly by the Booking Microservice upon submission.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
