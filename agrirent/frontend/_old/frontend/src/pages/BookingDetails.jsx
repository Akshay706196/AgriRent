import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  Tractor,
  DollarSign,
  ShieldCheck,
  User,
  Info
} from 'lucide-react';
import { bookingService } from '../services/bookingService';
import { equipmentService } from '../services/equipmentService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import { getErrorMessage } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    fetchBookingAndEquipment();
  }, [id]);

  const fetchBookingAndEquipment = async () => {
    try {
      setLoading(true);
      setError(null);
      const bData = await bookingService.getBookingById(id);
      setBooking(bData);

      // Hydrate equipment details from Equipment Service
      if (bData.equipmentId) {
        try {
          const eqData = await equipmentService.getEquipmentById(bData.equipmentId);
          setEquipment(eqData);
        } catch (e) {
          console.warn('Could not fetch equipment details:', e);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await bookingService.approveBooking(id);
      setActionSuccess('Booking request approved successfully.');
      await fetchBookingAndEquipment();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Please provide a reason for rejecting this booking request:');
    if (reason === null) return;

    try {
      setActionLoading(true);
      setActionError(null);
      await bookingService.rejectBooking(id, reason || 'Equipment unavailable');
      setActionSuccess('Booking request rejected.');
      await fetchBookingAndEquipment();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Please specify a reason for cancellation:');
    if (reason === null) return;

    try {
      setActionLoading(true);
      setActionError(null);
      await bookingService.cancelBooking(id, reason || 'Cancelled by user');
      setActionSuccess('Booking has been cancelled.');
      await fetchBookingAndEquipment();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Fetching reservation details from Booking Service..." />;
  }

  if (error || !booking) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-12) 0' }}>
        <div className="card" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <AlertCircle size={44} style={{ color: 'var(--color-error)', margin: '0 auto var(--spacing-4)' }} />
          <h2 style={{ margin: '0 0 var(--spacing-2)' }}>Booking Not Found</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-6)' }}>
            {error || 'Unable to retrieve the requested booking record from the Booking Service.'}
          </p>
          <Link to="/my-bookings" className="btn btn-primary">
            Back to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const currentUserId = user?._id || user?.id;
  const isRenter = currentUserId === booking.renterId;
  const isOwner = currentUserId === booking.ownerId;
  const status = (booking.status || 'PENDING').toUpperCase();

  const isPending = status === 'PENDING';
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED';

  const pricing = booking.pricingSnapshot || booking.pricing || {};

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-8) 0' }}>
      <div className="container" style={{ maxWidth: '840px' }}>
        {/* Navigation */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <Link to="/my-bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to Bookings Directory
          </Link>
        </div>

        {/* Action feedback */}
        {actionSuccess && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-4)' }}>
            <CheckCircle2 size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
            <AlertCircle size={18} />
            <span>{actionError}</span>
          </div>
        )}

        {/* Booking Card */}
        <div className="card" style={{ padding: 'var(--spacing-8)', marginBottom: 'var(--spacing-6)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)', paddingBottom: 'var(--spacing-6)', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: '6px' }}>
                <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                  {booking.bookingId || booking._id}
                </span>
                <span className={`badge badge-${
                  isApproved || status === 'COMPLETED' ? 'success' :
                  isPending ? 'warning' :
                  isRejected || isCancelled ? 'error' : 'neutral'
                }`}>
                  {status}
                </span>
              </div>
              <h1 style={{ fontSize: 'var(--font-2xl)', margin: 0, color: 'var(--color-text-main)' }}>
                Rental Reservation Details
              </h1>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Created on {formatDate(booking.createdAt)}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Authorized Total Amount</div>
              <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                {formatCurrency(pricing.totalAmount || booking.totalAmount || 0)}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Currency: INR (₹)</div>
            </div>
          </div>

          {/* Status Banners */}
          {isPending && (
            <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-6)' }}>
              <Clock size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Awaiting Owner Review:</strong> The equipment owner has 24 hours to accept or decline this request.
                {booking.responseDeadline && (
                  <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                    Response Deadline: {formatDate(booking.responseDeadline)}
                  </div>
                )}
              </div>
            </div>
          )}

          {isApproved && (
            <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-6)' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Booking Approved:</strong> The equipment owner has confirmed your reservation!
              </div>
            </div>
          )}

          {isRejected && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-6)' }}>
              <XCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Booking Rejected:</strong> {booking.rejectionReason || 'The owner could not accommodate this booking.'}
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-6)' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Booking Cancelled:</strong> {booking.cancellationReason || 'This booking has been cancelled.'}
              </div>
            </div>
          )}

          {/* Equipment & Participant Information */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--spacing-6)', marginBottom: 'var(--spacing-8)' }}>
            {/* Equipment Card */}
            <div style={{ padding: 'var(--spacing-4)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
                <Tractor size={22} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 'var(--font-base)' }}>Machinery Specifications</h3>
              </div>
              <div style={{ fontSize: 'var(--font-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                <div>
                  <strong>{equipment?.name || equipment?.title || 'Agricultural Implement'}</strong>
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
                  Equipment ID: <span style={{ fontFamily: 'monospace' }}>{booking.equipmentId}</span>
                </div>
                {equipment && (
                  <>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
                      Category: {equipment.category}
                    </div>
                    {equipment.location?.city && (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)' }}>
                        Location: {equipment.location.city}, {equipment.location.state}
                      </div>
                    )}
                  </>
                )}
                <div style={{ marginTop: 'var(--spacing-2)' }}>
                  <Link to={`/equipment/${booking.equipmentId}`} style={{ color: 'var(--color-primary)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>
                    View Equipment Page &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Participants Card */}
            <div style={{ padding: 'var(--spacing-4)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
                <User size={22} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 'var(--font-base)' }}>Contract Participants</h3>
              </div>
              <div style={{ fontSize: 'var(--font-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', display: 'block' }}>Renter ID</span>
                  <span style={{ fontFamily: 'monospace' }}>{booking.renterId}</span>
                  {isRenter && <span className="badge badge-success" style={{ marginLeft: '6px', fontSize: '10px' }}>You (Renter)</span>}
                </div>

                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', display: 'block' }}>Equipment Owner ID</span>
                  <span style={{ fontFamily: 'monospace' }}>{booking.ownerId}</span>
                  {isOwner && <span className="badge badge-success" style={{ marginLeft: '6px', fontSize: '10px' }}>You (Owner)</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule & Price Breakdown */}
          <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
            Financial Breakdown (Authoritative Snapshot)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', fontSize: 'var(--font-sm)', paddingBottom: 'var(--spacing-6)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Rental Period Interval</span>
              <strong>{formatDate(booking.startDate)} &rarr; {formatDate(booking.endDate)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Daily Rate Snapshot</span>
              <span>{formatCurrency(pricing.pricePerDaySnapshot || 0)} / day</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Base Rental Amount</span>
              <strong>{formatCurrency(pricing.rentalAmount || 0)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Platform Service Fee (3%)</span>
              <span>{formatCurrency(pricing.platformFee || 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Refundable Security Deposit</span>
              <span>{formatCurrency(pricing.securityDeposit || 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
              <span>Total Amount</span>
              <span>{formatCurrency(pricing.totalAmount || booking.totalAmount || 0)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-6)', flexWrap: 'wrap' }}>
            {/* Owner Actions */}
            {isOwner && isPending && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  {actionLoading ? 'Processing...' : 'Approve Booking Request'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="btn btn-outline"
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', padding: '10px 24px' }}
                >
                  Reject Request
                </button>
              </>
            )}

            {/* Cancel Action (Eligible for Renter or Owner on PENDING / APPROVED) */}
            {(isRenter || isOwner) && (isPending || isApproved) && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="btn btn-outline"
                style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >
                Cancel Booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
