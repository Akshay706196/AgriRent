import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Clock, AlertTriangle, FileText, CheckCircle2, RefreshCw, Info, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { kycService } from '../services/kycService';
import { getErrorMessage } from '../utils/errorHandler';
import { formatDate } from '../utils/formatDate';
import LoadingSpinner from '../components/LoadingSpinner';

const DOCUMENT_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'VOTER_ID', label: 'Voter Identity Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'FARMER_ID', label: 'Kisan / Farmer ID Card' }
];

export default function KYC() {
  const { user, refreshUser, isAdmin } = useAuth();

  const [kycStatus, setKycStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form inputs matching backend schema:
  // documentType, documentNumber, documentReference
  const [formData, setFormData] = useState({
    documentType: 'AADHAAR',
    documentNumber: '',
    documentReference: ''
  });

  // Admin verification state (only for ADMIN role)
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminActionError, setAdminActionError] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchKycData();
    if (isAdmin) {
      fetchAdminPending();
    }
  }, [isAdmin]);

  const fetchKycData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, historyRes] = await Promise.allSettled([
        kycService.getStatus(),
        kycService.getHistory()
      ]);

      if (statusRes.status === 'fulfilled') {
        setKycStatus(statusRes.value);
      }
      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)) {
        setHistory(historyRes.value);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminPending = async () => {
    try {
      setLoadingAdmin(true);
      const res = await kycService.getPendingKyc();
      setPendingSubmissions(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      console.warn('Could not load admin pending KYC:', err);
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.documentType) {
      setError('Please select a valid document type.');
      return;
    }
    if (!formData.documentNumber.trim() || formData.documentNumber.trim().length < 4) {
      setError('Document number must be at least 4 characters.');
      return;
    }
    if (!formData.documentReference.trim()) {
      setError('A secure document reference identifier or URI is required by the KYC service.');
      return;
    }

    try {
      setSubmitting(true);
      await kycService.submitKyc({
        documentType: formData.documentType,
        documentNumber: formData.documentNumber.trim(),
        documentReference: formData.documentReference.trim()
      });

      setSuccess('KYC documents submitted successfully. Status updated to PENDING verification.');
      setFormData({ documentType: 'AADHAAR', documentNumber: '', documentReference: '' });
      await refreshUser();
      await fetchKycData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminReview = async (userId, decision) => {
    try {
      setReviewingId(userId);
      setAdminActionError(null);

      await kycService.reviewKyc(userId, {
        decision,
        rejectionReason: decision === 'REJECTED' ? (rejectionReason || 'Document details do not match identity records') : undefined
      });

      setRejectionReason('');
      await fetchAdminPending();
      if (userId === user?._id || userId === user?.id) {
        await refreshUser();
        await fetchKycData();
      }
    } catch (err) {
      setAdminActionError(getErrorMessage(err));
    } finally {
      setReviewingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Checking KYC verification records..." />;
  }

  const currentStatus = kycStatus?.kycStatus || user?.kycStatus || 'NOT_SUBMITTED';
  const isVerified = currentStatus === 'VERIFIED';
  const isPending = currentStatus === 'PENDING' || currentStatus === 'UNDER_REVIEW';
  const isRejected = currentStatus === 'REJECTED' || currentStatus === 'RESUBMISSION_REQUIRED';
  const canSubmit = currentStatus === 'NOT_SUBMITTED' || isRejected;

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--spacing-6)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-2xl)', color: 'var(--color-text-main)' }}>
          Farmer Identity & KYC Verification
        </h2>
        <p style={{ margin: 'var(--spacing-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
          Mandatory compliance verification to list agricultural equipment or rent heavy machinery.
        </p>
      </div>

      {/* KYC Status Indicator Card */}
      <div className="card" style={{
        marginBottom: 'var(--spacing-6)',
        borderLeft: `4px solid ${
          isVerified ? 'var(--color-success)' :
          isPending ? 'var(--color-warning)' :
          isRejected ? 'var(--color-error)' : 'var(--color-border)'
        }`
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <div style={{
              padding: 'var(--spacing-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isVerified ? 'var(--color-success-light)' : isPending ? 'var(--color-warning-light)' : 'var(--color-surface)',
              color: isVerified ? 'var(--color-success)' : isPending ? 'var(--color-warning)' : 'var(--color-text-muted)'
            }}>
              {isVerified ? <ShieldCheck size={28} /> : isPending ? <Clock size={28} /> : <ShieldAlert size={28} />}
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Current KYC Status
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: '2px' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>{currentStatus}</h3>
                <span className={`badge badge-${isVerified ? 'success' : isPending ? 'warning' : isRejected ? 'error' : 'neutral'}`}>
                  {isVerified ? 'Verified Farmer' : isPending ? 'Under Review' : isRejected ? 'Rejected' : 'Action Required'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={fetchKycData}
            className="btn btn-outline"
            style={{ fontSize: 'var(--font-xs)', padding: '6px 12px', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh Status
          </button>
        </div>

        {/* Status descriptions & alerts */}
        <div style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
          {isVerified && (
            <div className="alert alert-success">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Identity Verified!</strong> Your account is fully certified to list tractors and heavy equipment and submit rental bookings without restriction.
                {kycStatus?.verifiedAt && (
                  <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                    Verified on: {formatDate(kycStatus.verifiedAt)}
                  </div>
                )}
              </div>
            </div>
          )}

          {isPending && (
            <div className="alert alert-warning">
              <Clock size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Verification Pending Review:</strong> Your documents have been submitted to the Identity & KYC Service and are awaiting administrative validation. You will be notified once reviewed.
                {kycStatus?.submittedAt && (
                  <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                    Submitted on: {formatDate(kycStatus.submittedAt)}
                  </div>
                )}
              </div>
            </div>
          )}

          {isRejected && (
            <div className="alert alert-error">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Verification Rejected:</strong> {kycStatus?.rejectionReason || 'The submitted documents could not be verified.'}
                <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                  Please review the requirements below and re-submit valid government-issued credentials.
                </div>
              </div>
            </div>
          )}

          {currentStatus === 'NOT_SUBMITTED' && (
            <div className="alert alert-info">
              <Info size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Action Needed:</strong> To prevent fraud and ensure platform trust, submit your identity details below. Unverified users cannot list machinery.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KYC Submission Form */}
      {canSubmit && (
        <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-2)', color: 'var(--color-text-main)' }}>
            Submit Identity Documents
          </h3>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-4)' }}>
            Note: All identity documents are processed through the Identity & KYC microservice. Sensitive identity numbers are masked after submission.
          </p>

          {success && (
            <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-4)' }}>
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="doc-type">Document Type *</label>
              <select
                id="doc-type"
                className="form-control"
                value={formData.documentType}
                onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                required
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="doc-number">Document / ID Number *</label>
              <input
                id="doc-number"
                type="text"
                className="form-control"
                placeholder="e.g. 1234 5678 9012 (Aadhaar / PAN)"
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                required
              />
              <div className="form-hint">
                Must match the official number exactly. Number will be stored securely and masked for privacy.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="doc-reference">Secure Document Reference URI / Identifier *</label>
              <input
                id="doc-reference"
                type="text"
                className="form-control"
                placeholder="e.g. s3://secure-docs/user-aadhaar-front.pdf or secure-ref-abc-123"
                value={formData.documentReference}
                onChange={(e) => setFormData({ ...formData, documentReference: e.target.value })}
                required
              />
              <div className="form-hint" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <Lock size={13} />
                <span>Backend requirement: Document reference from secure storage. Raw document binary files are not accepted over unencrypted JSON REST endpoints.</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', marginTop: 'var(--spacing-2)' }}
            >
              {submitting ? 'Submitting to Identity & KYC Service...' : 'Submit for Verification'}
            </button>
          </form>
        </div>
      )}

      {/* Submission History */}
      {history.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
            Submission History
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {history.map((item, idx) => (
              <div
                key={item._id || idx}
                style={{
                  padding: 'var(--spacing-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-2)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                    {item.documentType} ({item.documentNumberMasked || '••••••••'})
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                    Submitted: {formatDate(item.submittedAt || item.createdAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <span className={`badge badge-${item.status === 'VERIFIED' ? 'success' : item.status === 'REJECTED' ? 'error' : 'warning'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Verification Management (Shown ONLY to Server-Verified Admins) */}
      {isAdmin && (
        <div className="card" style={{ border: '2px solid var(--color-primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-lg)', margin: 0, color: 'var(--color-primary-dark)' }}>
                Administrator KYC Review Console
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                Active administrative privileges verified via Identity & KYC backend role token.
              </p>
            </div>
            <button
              onClick={fetchAdminPending}
              className="btn btn-outline"
              style={{ fontSize: 'var(--font-xs)', padding: '4px 10px' }}
            >
              Refresh Queue ({pendingSubmissions.length})
            </button>
          </div>

          {adminActionError && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-3)' }}>
              <span>{adminActionError}</span>
            </div>
          )}

          {loadingAdmin ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>Loading pending submissions...</div>
          ) : pendingSubmissions.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: 0 }}>
              No pending KYC submissions in the queue.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              {pendingSubmissions.map((sub) => (
                <div
                  key={sub._id || sub.userId}
                  style={{
                    padding: 'var(--spacing-4)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-2)' }}>
                    <div>
                      <strong>User ID:</strong> <span style={{ fontFamily: 'monospace' }}>{sub.userId || sub._id}</span>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                        {sub.documentType} • Number: {sub.documentNumberMasked || sub.documentNumber}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                        Ref: <span style={{ fontFamily: 'monospace' }}>{sub.documentReference}</span>
                      </div>
                    </div>
                    <span className="badge badge-warning">Awaiting Review</span>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-3)' }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 'var(--font-xs)', padding: '6px 14px' }}
                      disabled={reviewingId === (sub.userId || sub._id)}
                      onClick={() => handleAdminReview(sub.userId || sub._id, 'VERIFIED')}
                    >
                      Approve & Verify
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: 'var(--font-xs)', padding: '6px 14px', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                      disabled={reviewingId === (sub.userId || sub._id)}
                      onClick={() => handleAdminReview(sub.userId || sub._id, 'REJECTED')}
                    >
                      Reject Submission
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
