import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, ShieldCheck, Calendar, Lock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { identityService } from '../services/identityService';
import { authService } from '../services/authService';
import { getErrorMessage } from '../utils/errorHandler';
import { formatDate } from '../utils/formatDate';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Profile() {
  const { user, refreshUser } = useAuth();

  const [profileData, setProfileData] = useState({
    name: '',
    phone: ''
  });
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Password change state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setProfileError(null);

      // Fetch user profile and eligibility in parallel
      const [userRes, eligRes] = await Promise.allSettled([
        identityService.getProfile(),
        identityService.checkEligibility()
      ]);

      if (userRes.status === 'fulfilled') {
        const u = userRes.value;
        setProfileData({
          name: u.name || '',
          phone: u.phone || ''
        });
      } else if (user) {
        setProfileData({
          name: user.name || '',
          phone: user.phone || ''
        });
      }

      if (eligRes.status === 'fulfilled') {
        setEligibility(eligRes.value);
      }
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileData.name.trim()) {
      setProfileError('Full name is required.');
      return;
    }
    if (profileData.phone && !/^\d{10}$/.test(profileData.phone.trim())) {
      setProfileError('Phone number must be exactly 10 digits.');
      return;
    }

    try {
      setUpdating(true);
      await identityService.updateProfile({
        name: profileData.name.trim(),
        phone: profileData.phone.trim() || undefined
      });
      await refreshUser();
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwords.currentPassword) {
      setPasswordError('Please provide your current password.');
      return;
    }
    if (passwords.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      await authService.changePassword(passwords.currentPassword, passwords.newPassword);
      setPasswordSuccess('Password changed successfully.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading your farmer profile..." />;
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--spacing-6)' }}>
        
        {/* Left Column: Profile & Eligibility Overview */}
        <div>
          {/* Account Overview Card */}
          <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Account Information
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', fontSize: 'var(--font-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Email Address</span>
                <strong>{user?.email}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Account Status</span>
                <span className={`badge badge-${user?.accountStatus === 'ACTIVE' ? 'success' : 'warning'}`}>
                  {user?.accountStatus || 'ACTIVE'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>KYC Status</span>
                <span className={`badge badge-${
                  user?.kycStatus === 'VERIFIED' ? 'success' :
                  user?.kycStatus === 'PENDING' || user?.kycStatus === 'UNDER_REVIEW' ? 'warning' :
                  user?.kycStatus === 'REJECTED' ? 'error' : 'neutral'
                }`}>
                  {user?.kycStatus || 'NOT_SUBMITTED'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Roles</span>
                <span>{Array.isArray(user?.roles) ? user.roles.join(', ') : 'USER'}</span>
              </div>

              {user?.createdAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Member Since</span>
                  <span>{formatDate(user.createdAt)}</span>
                </div>
              )}

              {user?.lastLoginAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Last Login</span>
                  <span>{formatDate(user.lastLoginAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Eligibility Card */}
          {eligibility && (
            <div className="card">
              <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-3)', color: 'var(--color-text-main)' }}>
                Marketplace Eligibility
              </h3>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-4)' }}>
                Verified via Identity & KYC Microservice contract rules.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>Rent Machinery</span>
                  <span className={`badge badge-${eligibility.canRent ? 'success' : 'error'}`}>
                    {eligibility.canRent ? 'Eligible' : 'Not Eligible'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>List Machinery for Rent</span>
                  <span className={`badge badge-${eligibility.canList ? 'success' : 'error'}`}>
                    {eligibility.canList ? 'Eligible' : 'Requires Verified KYC'}
                  </span>
                </div>

                {eligibility.reasons && eligibility.reasons.length > 0 && (
                  <div style={{
                    marginTop: 'var(--spacing-2)',
                    padding: 'var(--spacing-3)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-text-muted)'
                  }}>
                    <strong>Requirements:</strong>
                    <ul style={{ margin: 'var(--spacing-1) 0 0', paddingLeft: 'var(--spacing-4)' }}>
                      {eligibility.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Edit Profile & Password */}
        <div>
          {/* Edit Profile Form */}
          <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Edit Profile Details
            </h3>

            {profileSuccess && (
              <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-4)' }}>
                <CheckCircle2 size={16} />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
                <AlertCircle size={16} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-name">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-name"
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '38px' }}
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    required
                  />
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-phone">Phone Number (10 Digits)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-phone"
                    type="tel"
                    maxLength={10}
                    className="form-control"
                    style={{ paddingLeft: '38px' }}
                    placeholder="9876543210"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  />
                  <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={updating}
                style={{ width: '100%' }}
              >
                {updating ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Security & Password
            </h3>

            {passwordSuccess && (
              <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-4)' }}>
                <CheckCircle2 size={16} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
                <AlertCircle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="current-password">Current Password</label>
                <input
                  id="current-password"
                  type="password"
                  className="form-control"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password (Min 6 chars)</label>
                <input
                  id="new-password"
                  type="password"
                  className="form-control"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-new-password">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  type="password"
                  className="form-control"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                disabled={changingPassword}
                style={{ width: '100%' }}
              >
                {changingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
