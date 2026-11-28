import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Tractor,
  MapPin,
  Calendar,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  DollarSign,
  Tag,
  Wrench,
  Edit,
  Clock,
  Info
} from 'lucide-react';
import { equipmentService } from '../services/equipmentService';
import { identityService } from '../services/identityService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatCurrency';
import { getErrorMessage } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';

export default function EquipmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isKycVerified } = useAuth();

  const [equipment, setEquipment] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    fetchData();
  }, [id, isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch equipment details
      const item = await equipmentService.getEquipmentById(id);
      setEquipment(item);

      // If user is authenticated, check their marketplace eligibility
      if (isAuthenticated) {
        try {
          const elig = await identityService.checkEligibility();
          setEligibility(elig);
        } catch (e) {
          console.warn('Could not check user eligibility:', e);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading equipment details..." />;
  }

  if (error || !equipment) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-12) 0' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <AlertCircle size={48} style={{ color: 'var(--color-error)', margin: '0 auto var(--spacing-4)' }} />
          <h2 style={{ margin: '0 0 var(--spacing-2)' }}>Equipment Not Found</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-6)' }}>
            {error || 'The requested agricultural machinery could not be retrieved from the Equipment Service.'}
          </p>
          <Link to="/equipment" className="btn btn-primary">
            Back to Equipment Directory
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user && (user._id === equipment.ownerId || user.id === equipment.ownerId);
  const isAvailable = equipment.status === 'AVAILABLE';

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-8) 0' }}>
      <div className="container">
        {/* Back Link */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <Link to="/equipment" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to Equipment Directory
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--spacing-8)', alignItems: 'start' }}>
          {/* Left Column: Photos & Details */}
          <div>
            {/* Main Photo Gallery */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--spacing-6)' }}>
              <div style={{
                height: '380px',
                backgroundColor: '#e8f5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {equipment.images && equipment.images.length > 0 ? (
                  <img
                    src={equipment.images[activeImageIndex] || equipment.images[0]}
                    alt={equipment.title || equipment.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <Tractor size={80} style={{ color: 'var(--color-primary-light)' }} />
                )}

                <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                  <span className={`badge badge-${isAvailable ? 'success' : 'warning'}`} style={{ fontSize: 'var(--font-xs)', padding: '6px 12px' }}>
                    {equipment.status || 'AVAILABLE'}
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              {equipment.images && equipment.images.length > 1 && (
                <div style={{ display: 'flex', gap: 'var(--spacing-2)', padding: 'var(--spacing-3)', overflowX: 'auto', borderTop: '1px solid var(--color-border)' }}>
                  {equipment.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        border: idx === activeImageIndex ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        padding: 0,
                        cursor: 'pointer'
                      }}
                    >
                      <img src={img} alt={`thumb-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description Card */}
            <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                {equipment.category}
              </div>
              <h1 style={{ fontSize: 'var(--font-2xl)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
                {equipment.title || equipment.name}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', marginBottom: 'var(--spacing-6)' }}>
                <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
                <span>
                  {equipment.location?.city ? `${equipment.location.city}, ${equipment.location.state}` : 'Location provided upon booking'}
                  {equipment.location?.pincode ? ` (${equipment.location.pincode})` : ''}
                </span>
              </div>

              <h3 style={{ fontSize: 'var(--font-base)', margin: '0 0 var(--spacing-2)', color: 'var(--color-text-main)' }}>
                Description
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', lineHeight: 1.7, margin: '0 0 var(--spacing-6)', whiteSpace: 'pre-line' }}>
                {equipment.description || 'No detailed description provided by the equipment owner.'}
              </p>

              {/* Machinery Specifications */}
              <h3 style={{ fontSize: 'var(--font-base)', margin: '0 0 var(--spacing-3)', color: 'var(--color-text-main)' }}>
                Machinery Specifications
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-3)', fontSize: 'var(--font-sm)' }}>
                <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Condition</div>
                  <strong>{equipment.condition || 'GOOD'}</strong>
                </div>

                <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Category</div>
                  <strong>{equipment.category}</strong>
                </div>

                {equipment.model && (
                  <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Make / Model</div>
                    <strong>{equipment.model}</strong>
                  </div>
                )}

                {equipment.yearOfManufacture && (
                  <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Year of Manufacture</div>
                    <strong>{equipment.yearOfManufacture}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Pricing & Booking Action */}
          <div style={{ position: 'sticky', top: '90px' }}>
            <div className="card" style={{ padding: 'var(--spacing-6)', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-4)', paddingBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Rental Rate</span>
                <div>
                  <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                    {formatCurrency(equipment.pricePerDay || equipment.dailyRate)}
                  </span>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}> / day</span>
                </div>
              </div>

              {/* Security deposit note */}
              {equipment.securityDeposit > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-3)' }}>
                  <span>Security Deposit (Refundable)</span>
                  <strong>{formatCurrency(equipment.securityDeposit)}</strong>
                </div>
              )}

              {/* Eligibility Check & Booking Flow CTA */}
              <div style={{ marginTop: 'var(--spacing-6)' }}>
                {isOwner ? (
                  <div>
                    <div className="alert alert-info" style={{ marginBottom: 'var(--spacing-4)' }}>
                      <Info size={18} />
                      <span>You are the registered owner of this equipment.</span>
                    </div>
                    <Link to={`/equipment/${equipment._id || equipment.id}/edit`} className="btn btn-outline" style={{ width: '100%', gap: '8px' }}>
                      <Edit size={16} /> Edit Equipment Listing
                    </Link>
                  </div>
                ) : !isAuthenticated ? (
                  <div>
                    <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-4)' }}>
                      <AlertCircle size={18} />
                      <span>You must be logged in to reserve this machinery.</span>
                    </div>
                    <Link
                      to="/login"
                      state={{ from: { pathname: `/bookings/new?equipmentId=${equipment._id || equipment.id}` } }}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      Log In to Rent Equipment
                    </Link>
                  </div>
                ) : !isKycVerified ? (
                  <div>
                    <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-4)' }}>
                      <ShieldCheck size={18} />
                      <div>
                        <strong>KYC Verification Required:</strong> Your account must have verified KYC status before you can book agricultural machinery.
                      </div>
                    </div>
                    <Link to="/kyc" className="btn btn-primary" style={{ width: '100%' }}>
                      Complete KYC Verification
                    </Link>
                  </div>
                ) : !isAvailable ? (
                  <div>
                    <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
                      <AlertCircle size={18} />
                      <span>This machinery is currently {equipment.status} and cannot be reserved.</span>
                    </div>
                    <button className="btn btn-outline" disabled style={{ width: '100%' }}>
                      Unavailable for Rent
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => navigate(`/bookings/new?equipmentId=${equipment._id || equipment.id}`)}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px', fontSize: 'var(--font-base)', fontWeight: 700 }}
                    >
                      Book This Equipment
                    </button>
                    <div style={{ textAlign: 'center', marginTop: 'var(--spacing-3)', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      No payment charged upfront • Subject to owner approval
                    </div>
                  </div>
                )}
              </div>

              {/* Platform Guarantees */}
              <div style={{ marginTop: 'var(--spacing-6)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Verified Identity & Certified Owner</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Owner must respond within 24 hours</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={14} style={{ color: 'var(--color-primary)' }} />
                  <span>Transparent 3% standard platform service fee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
