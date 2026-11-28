import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, Lock, Mail, User, Phone, AlertCircle, CheckCircle2, Tractor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorHandler';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Frontend validations
    if (!formData.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (formData.phone && !/^\d{10}$/.test(formData.phone.trim())) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        password: formData.password
      });

      setSuccessMessage('Registration successful! Redirecting to your dashboard...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 140px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-8) var(--spacing-4)',
      backgroundColor: 'var(--color-bg)'
    }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: 'var(--spacing-8)' }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--spacing-3)'
          }}>
            <Tractor size={28} />
          </div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-2xl)', color: 'var(--color-text-main)' }}>
            Join AgriRent
          </h2>
          <p style={{ margin: 'var(--spacing-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            One account to rent machinery and list your equipment
          </p>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-4)' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">Full Name *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-name"
                name="name"
                type="text"
                className="form-control"
                style={{ paddingLeft: '38px' }}
                placeholder="Ramesh Kumar"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <User
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-light)'
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">Email Address *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-email"
                name="email"
                type="email"
                className="form-control"
                style={{ paddingLeft: '38px' }}
                placeholder="farmer@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-light)'
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-phone">Phone Number (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-phone"
                name="phone"
                type="tel"
                maxLength={10}
                className="form-control"
                style={{ paddingLeft: '38px' }}
                placeholder="9876543210 (10 digits)"
                value={formData.phone}
                onChange={handleChange}
              />
              <Phone
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-light)'
                }}
              />
            </div>
            <div className="form-hint">Used for SMS updates on rental requests and verification.</div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: '38px', paddingRight: '40px' }}
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-light)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-light)',
                  padding: 0
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-confirm-password">Confirm Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: '38px' }}
                placeholder="Re-type your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-light)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--spacing-3)' }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                Registering Account...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <UserPlus size={18} /> Create AgriRent Account
              </span>
            )}
          </button>
        </form>

        <div style={{
          marginTop: 'var(--spacing-6)',
          paddingTop: 'var(--spacing-4)',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          fontSize: 'var(--font-sm)',
          color: 'var(--color-text-muted)'
        }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
