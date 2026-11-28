import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Tractor,
  CalendarCheck,
  ShieldCheck,
  Clock,
  PlusCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { bookingService } from '../services/bookingService';
import { identityService } from '../services/identityService';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const { user, isKycVerified } = useAuth();

  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [ownerRequests, setOwnerRequests] = useState([]);
  const [bookingsError, setBookingsError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setBookingsError(null);

    // Independent loading: One failed service request should NOT prevent others
    const [eligRes, renterRes, ownerRes] = await Promise.allSettled([
      identityService.checkEligibility(),
      bookingService.getMyBookings(),
      bookingService.getOwnerRequests()
    ]);

    if (eligRes.status === 'fulfilled') {
      setEligibility(eligRes.value);
    }

    if (renterRes.status === 'fulfilled') {
      const items = Array.isArray(renterRes.value) ? renterRes.value : renterRes.value?.data || [];
      setMyBookings(items);
    } else {
      setBookingsError('Could not connect to Booking Service (Port 4002).');
    }

    if (ownerRes.status === 'fulfilled') {
      const items = Array.isArray(ownerRes.value) ? ownerRes.value : ownerRes.value?.data || [];
      setOwnerRequests(items);
    }

    setLoading(false);
  };

  if (loading) {
    return <LoadingSpinner message="Aggregating farmer dashboard data across microservices..." />;
  }

  // Derived stats
  const pendingRentals = myBookings.filter((b) => (b.status || '').toUpperCase() === 'PENDING').length;
  const approvedRentals = myBookings.filter((b) => (b.status || '').toUpperCase() === 'APPROVED').length;
  const incomingPending = ownerRequests.filter((b) => (b.status || '').toUpperCase() === 'PENDING').length;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* KYC Alert if not verified */}
      {!isKycVerified && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-6)' }}>
          <ShieldCheck size={22} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Action Recommended: Identity Verification Required</strong>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-xs)' }}>
              Complete KYC document verification to rent heavy machinery and publish equipment listings on the platform.
            </p>
          </div>
          <Link to="/kyc" className="btn btn-primary" style={{ fontSize: 'var(--font-xs)', padding: '6px 14px' }}>
            Verify KYC Now
          </Link>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-4)',
        marginBottom: 'var(--spacing-8)'
      }}>
        {/* Metric 1: KYC Status */}
        <div className="card" style={{ padding: 'var(--spacing-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              KYC COMPLIANCE
            </span>
            <div style={{ color: isKycVerified ? 'var(--color-success)' : 'var(--color-warning)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, marginTop: 'var(--spacing-2)' }}>
            {user?.kycStatus || 'NOT_SUBMITTED'}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {isKycVerified ? 'Certified Farmer' : 'Submission Pending'}
          </div>
        </div>

        {/* Metric 2: Pending Rental Bookings */}
        <div className="card" style={{ padding: 'var(--spacing-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              MY PENDING RENTALS
            </span>
            <div style={{ color: 'var(--color-warning)' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: 'var(--spacing-2)' }}>
            {pendingRentals}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Awaiting owner confirmation
          </div>
        </div>

        {/* Metric 3: Active / Approved Bookings */}
        <div className="card" style={{ padding: 'var(--spacing-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              APPROVED RESERVATIONS
            </span>
            <div style={{ color: 'var(--color-success)' }}>
              <CalendarCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: 'var(--spacing-2)' }}>
            {approvedRentals}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Ready for field deployment
          </div>
        </div>

        {/* Metric 4: Incoming Requests */}
        <div className="card" style={{ padding: 'var(--spacing-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              INCOMING REQUESTS
            </span>
            <div style={{ color: 'var(--color-primary)' }}>
              <Tractor size={20} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginTop: 'var(--spacing-2)' }}>
            {incomingPending}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Awaiting your response
          </div>
        </div>
      </div>

      {bookingsError && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-6)' }}>
          <AlertCircle size={18} />
          <span>{bookingsError}</span>
        </div>
      )}

      {/* Main Sections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 'var(--spacing-6)' }}>
        {/* Section 1: Recent Rental Bookings */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)', paddingBottom: 'var(--spacing-3)', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-base)', color: 'var(--color-text-main)' }}>
              My Rental Activity
            </h3>
            <Link to="/my-bookings" style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {myBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-8) 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              <p style={{ margin: '0 0 var(--spacing-4)' }}>No rental bookings placed yet.</p>
              <Link to="/equipment" className="btn btn-outline" style={{ fontSize: 'var(--font-xs)' }}>
                Browse Available Machinery
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              {myBookings.slice(0, 4).map((b) => (
                <div key={b.bookingId || b._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                      Booking #{b.bookingId || b._id}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      {formatDate(b.startDate)} &rarr; {formatDate(b.endDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge badge-${
                      b.status === 'APPROVED' ? 'success' :
                      b.status === 'PENDING' ? 'warning' : 'neutral'
                    }`}>
                      {b.status}
                    </span>
                    <div style={{ marginTop: '4px' }}>
                      <Link to={`/bookings/${b.bookingId || b._id}`} style={{ fontSize: '11px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                        Details &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Incoming Requests (For Equipment Owners) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)', paddingBottom: 'var(--spacing-3)', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-base)', color: 'var(--color-text-main)' }}>
              Incoming Equipment Requests
            </h3>
            <Link to="/my-bookings" style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Manage Requests <ArrowRight size={14} />
            </Link>
          </div>

          {ownerRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-8) 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              <p style={{ margin: '0 0 var(--spacing-4)' }}>No rental requests for your machinery yet.</p>
              <Link to="/equipment/new" className="btn btn-primary" style={{ fontSize: 'var(--font-xs)' }}>
                List Your Equipment
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              {ownerRequests.slice(0, 4).map((b) => (
                <div key={b.bookingId || b._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                      Request #{b.bookingId || b._id}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      Equipment: {b.equipmentId}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge badge-${
                      b.status === 'APPROVED' ? 'success' :
                      b.status === 'PENDING' ? 'warning' : 'neutral'
                    }`}>
                      {b.status}
                    </span>
                    <div style={{ marginTop: '4px' }}>
                      <Link to={`/bookings/${b.bookingId || b._id}`} style={{ fontSize: '11px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                        Review &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
