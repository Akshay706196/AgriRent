import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Lock, Mail, AlertCircle, Tractor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorHandler';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Return to previous target if redirected by ProtectedRoute
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate(from, { replace: true });
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
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: 'var(--spacing-8)' }}>
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
            Welcome to AgriRent
          </h2>
          <p style={{ margin: 'var(--spacing-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Log in to manage equipment, rentals, and bookings
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-4)' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                className="form-control"
                style={{ paddingLeft: '38px' }}
                placeholder="farmer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: '38px', paddingRight: '40px' }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--spacing-2)' }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                Logging in...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <LogIn size={18} /> Sign In
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
          Don't have an AgriRent account?{' '}
          <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Register as a Farmer
          </Link>
        </div>
      </div>
    </div>
  );
}
