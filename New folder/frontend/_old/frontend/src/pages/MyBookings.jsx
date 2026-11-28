import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, CheckCircle2, XCircle, AlertCircle, Eye, RefreshCw, Tractor, ArrowRight } from 'lucide-react';
import { bookingService } from '../services/bookingService';
import { equipmentService } from '../services/equipmentService';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import { getErrorMessage } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function MyBookings() {
  // Tabs: 'renter' (My Bookings) vs 'owner' (Incoming Requests)
  const [activeTab, setActiveTab] = useState('renter');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [equipmentNames, setEquipmentNames] = useState({});

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      setActionSuccess(null);

      let data;
      if (activeTab === 'renter') {
        data = await bookingService.getMyBookings();
      } else {
        data = await bookingService.getOwnerRequests();
      }

      const list = Array.isArray(data) ? data : data?.data || [];
      setBookings(list);

      // Hydrate equipment titles via Equipment Service API if needed
      hydrateEquipmentNames(list);
    } catch (err) {
      setError(getErrorMessage(err));
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const hydrateEquipmentNames = async (items) => {
    const idsToFetch = [...new Set(items.map((b) => b.equipmentId).filter(Boolean))];
    const newNames = { ...equipmentNames };

    for (const eqId of idsToFetch) {
      if (!newNames[eqId]) {
        try {
          const eq = await equipmentService.getEquipmentById(eqId);
          newNames[eqId] = eq.name || eq.title || eqId;
        } catch {
          newNames[eqId] = eqId;
        }
      }
    }
    setEquipmentNames(newNames);
  };

  const handleApprove = async (bookingId) => {
    try {
      setActionLoadingId(bookingId);
      await bookingService.approveBooking(bookingId);
      setActionSuccess(`Booking ${bookingId} approved successfully.`);
      await fetchBookings();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (bookingId) => {
    const reason = window.prompt('Please provide a reason for rejecting this booking request:');
    if (reason === null) return;

    try {
      setActionLoadingId(bookingId);
      await bookingService.rejectBooking(bookingId, reason || 'Owner unavailable for requested dates');
      setActionSuccess(`Booking ${bookingId} rejected.`);
      await fetchBookings();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      setActionLoadingId(bookingId);
      await bookingService.cancelBooking(bookingId, 'Cancelled by user');
      setActionSuccess(`Booking ${bookingId} cancelled.`);
      await fetchBookings();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter bookings based on selected status filter
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter === 'ALL') return true;
    return (b.status || '').toUpperCase() === statusFilter;
  });

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-2xl)', margin: 0, color: 'var(--color-text-main)' }}>
            Booking & Reservation Management
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Track and manage your rental agreements from the Booking Microservice (Port 4002).
          </p>
        </div>
        <button onClick={fetchBookings} className="btn btn-outline" style={{ gap: '6px', fontSize: 'var(--font-xs)' }}>
          <RefreshCw size={14} /> Refresh Records
        </button>
      </div>

      {/* Renter vs Owner Request Tabs */}
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--spacing-6)' }}>
        <button
          onClick={() => { setActiveTab('renter'); setStatusFilter('ALL'); }}
          style={{
            padding: 'var(--spacing-3) var(--spacing-6)',
            border: 'none',
            background: 'none',
            fontSize: 'var(--font-base)',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'renter' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'renter' ? '3px solid var(--color-primary)' : '3px solid transparent'
          }}
        >
          My Rentals (As Renter)
        </button>

        <button
          onClick={() => { setActiveTab('owner'); setStatusFilter('ALL'); }}
          style={{
            padding: 'var(--spacing-3) var(--spacing-6)',
            border: 'none',
            background: 'none',
            fontSize: 'var(--font-base)',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'owner' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'owner' ? '3px solid var(--color-primary)' : '3px solid transparent'
          }}
        >
          Incoming Requests (As Machinery Owner)
        </button>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-4)' }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
          <AlertCircle size={18} />
          <div>
            <strong>Booking Service error:</strong> {error}
          </div>
        </div>
      )}

      {/* Status Filter Badges */}
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', overflowX: 'auto', marginBottom: 'var(--spacing-6)', paddingBottom: '4px' }}>
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'EXPIRED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: 'var(--font-xs)', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}
          >
            {s === 'ALL' ? 'All Bookings' : s}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <LoadingSpinner message="Fetching bookings from Booking Service..." />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title={activeTab === 'renter' ? 'No Equipment Bookings Found' : 'No Incoming Rental Requests'}
          description={
            activeTab === 'renter'
              ? 'You have not reserved any agricultural machinery yet.'
              : 'No farmers have requested to rent your machinery for the selected filter.'
          }
          actionLabel={activeTab === 'renter' ? 'Browse Available Equipment' : 'List New Machinery'}
          onAction={() => window.location.assign(activeTab === 'renter' ? '/equipment' : '/equipment/new')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {filteredBookings.map((b) => {
            const bId = b.bookingId || b._id;
            const eqTitle = equipmentNames[b.equipmentId] || b.equipmentId || 'Agricultural Machinery';
            const status = (b.status || 'PENDING').toUpperCase();
            const total = b.pricingSnapshot?.totalAmount || b.totalAmount || b.pricing?.totalAmount || 0;

            const isPending = status === 'PENDING';
            const isApproved = status === 'APPROVED';

            return (
              <div key={bId} className="card" style={{ padding: 'var(--spacing-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-3)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: '4px' }}>
                      <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                        {bId}
                      </span>
                      <span className={`badge badge-${
                        status === 'APPROVED' || status === 'COMPLETED' ? 'success' :
                        status === 'PENDING' ? 'warning' :
                        status === 'REJECTED' || status === 'CANCELLED' ? 'error' : 'neutral'
                      }`}>
                        {status}
                      </span>
                    </div>

                    <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-1)', color: 'var(--color-text-main)' }}>
                      {eqTitle}
                    </h3>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      Equipment ID: <Link to={`/equipment/${b.equipmentId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{b.equipmentId}</Link>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Total Amount</div>
                    <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                      {formatCurrency(total)}
                    </div>
                  </div>
                </div>

                {/* Rental Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--spacing-3)',
                  padding: 'var(--spacing-3)',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-text-muted)',
                  marginBottom: 'var(--spacing-4)'
                }}>
                  <div>
                    <span style={{ display: 'block', color: 'var(--color-text-light)' }}>Rental Window</span>
                    <strong>{formatDate(b.startDate)} &rarr; {formatDate(b.endDate)}</strong>
                  </div>

                  <div>
                    <span style={{ display: 'block', color: 'var(--color-text-light)' }}>
                      {activeTab === 'renter' ? 'Equipment Owner' : 'Renter'}
                    </span>
                    <strong style={{ fontFamily: 'monospace' }}>
                      {activeTab === 'renter' ? b.ownerId : b.renterId}
                    </strong>
                  </div>

                  <div>
                    <span style={{ display: 'block', color: 'var(--color-text-light)' }}>Booking Requested</span>
                    <span>{formatDate(b.createdAt)}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
                  <Link to={`/bookings/${bId}`} className="btn btn-outline" style={{ fontSize: 'var(--font-xs)', padding: '6px 14px', gap: '6px' }}>
                    <Eye size={14} /> View Full Breakdown
                  </Link>

                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    {/* Owner specific actions for pending requests */}
                    {activeTab === 'owner' && isPending && (
                      <>
                        <button
                          onClick={() => handleApprove(bId)}
                          disabled={actionLoadingId === bId}
                          className="btn btn-primary"
                          style={{ fontSize: 'var(--font-xs)', padding: '6px 14px' }}
                        >
                          Approve Request
                        </button>
                        <button
                          onClick={() => handleReject(bId)}
                          disabled={actionLoadingId === bId}
                          className="btn btn-outline"
                          style={{ fontSize: 'var(--font-xs)', padding: '6px 14px', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {/* Cancellation eligible for renter on PENDING or APPROVED */}
                    {activeTab === 'renter' && (isPending || isApproved) && (
                      <button
                        onClick={() => handleCancel(bId)}
                        disabled={actionLoadingId === bId}
                        className="btn btn-outline"
                        style={{ fontSize: 'var(--font-xs)', padding: '6px 14px', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
