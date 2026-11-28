import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Tractor,
  Menu,
  X,
  User,
  ShieldCheck,
  PlusCircle,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  ChevronDown,
} from 'lucide-react';

export const Navbar = () => {
  const { user, isAuthenticated, isKycVerified, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  };

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  };

  return (
    <header
      style={{
        backgroundColor: 'var(--color-white)',
        borderBottom: '1px solid var(--color-gray-200)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '4.5rem',
        }}
      >
        {/* Brand Logo */}
        <Link
          to="/"
          onClick={closeMenus}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: 'var(--color-primary-800)',
            fontWeight: 800,
            fontSize: '1.4rem',
            letterSpacing: '-0.02em',
          }}
        >
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary-700)',
              color: 'var(--color-white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(27, 94, 32, 0.3)',
            }}
          >
            <Tractor size={22} />
          </div>
          <span>AgriRent</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '1.75rem',
          }}
          className="desktop-nav"
        >
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              fontWeight: 600,
              fontSize: '0.95rem',
              color: isActive ? 'var(--color-primary-700)' : 'var(--color-gray-600)',
            })}
          >
            Home
          </NavLink>
          <NavLink
            to="/equipment"
            style={({ isActive }) => ({
              fontWeight: 600,
              fontSize: '0.95rem',
              color: isActive ? 'var(--color-primary-700)' : 'var(--color-gray-600)',
            })}
          >
            Browse Equipment
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink
                to="/my-bookings"
                style={({ isActive }) => ({
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: isActive ? 'var(--color-primary-700)' : 'var(--color-gray-600)',
                })}
              >
                My Bookings
              </NavLink>
              <NavLink
                to="/my-equipment"
                style={({ isActive }) => ({
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: isActive ? 'var(--color-primary-700)' : 'var(--color-gray-600)',
                })}
              >
                My Equipment
              </NavLink>
              <NavLink
                to="/dashboard"
                style={({ isActive }) => ({
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: isActive ? 'var(--color-primary-700)' : 'var(--color-gray-600)',
                })}
              >
                Dashboard
              </NavLink>
            </>
          )}
        </nav>

        {/* Action Controls / Auth */}
        <div style={{ display: 'none', alignItems: 'center', gap: '1rem' }} className="desktop-actions">
          {isAuthenticated ? (
            <>
              <Link to="/equipment/new" className="btn btn-outline btn-sm">
                <PlusCircle size={16} /> List Equipment
              </Link>

              {/* User Dropdown Trigger */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--color-gray-50)',
                    border: '1px solid var(--color-gray-300)',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '1.85rem',
                      height: '1.85rem',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary-100)',
                      color: 'var(--color-primary-800)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-gray-800)' }}>
                    {user?.name?.split(' ')[0] || 'User'}
                  </span>
                  <ChevronDown size={14} style={{ color: 'var(--color-gray-500)' }} />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 0.5rem)',
                      width: '240px',
                      backgroundColor: 'var(--color-white)',
                      border: '1px solid var(--color-gray-200)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      padding: '0.5rem 0',
                      zIndex: 60,
                    }}
                  >
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-gray-100)' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{user?.name}</p>
                      <p style={{ fontSize: '0.785rem', color: 'var(--color-gray-500)', margin: '0.15rem 0 0' }}>
                        {user?.email}
                      </p>
                      <div style={{ marginTop: '0.4rem' }}>
                        {isKycVerified ? (
                          <span className="badge badge-success">
                            <ShieldCheck size={12} /> KYC Verified
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            KYC: {user?.kycStatus || 'NOT_SUBMITTED'}
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 1rem',
                        fontSize: '0.9rem',
                        color: 'var(--color-gray-700)',
                      }}
                    >
                      <User size={16} /> Profile Settings
                    </Link>

                    <Link
                      to="/kyc"
                      onClick={() => setUserDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 1rem',
                        fontSize: '0.9rem',
                        color: 'var(--color-gray-700)',
                      }}
                    >
                      <ShieldCheck size={16} /> Identity & KYC
                    </Link>

                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.65rem 1rem',
                        fontSize: '0.9rem',
                        color: '#dc2626',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderTop: '1px solid var(--color-gray-100)',
                      }}
                    >
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            color: 'var(--color-gray-700)',
            display: 'flex',
            alignItems: 'center',
          }}
          className="mobile-toggle"
        >
          {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: 'var(--color-white)',
            borderTop: '1px solid var(--color-gray-200)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <Link to="/" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
            Home
          </Link>
          <Link to="/equipment" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
            Browse Equipment
          </Link>

          {isAuthenticated ? (
            <>
              <Link to="/my-bookings" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                My Bookings
              </Link>
              <Link to="/my-equipment" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                My Equipment
              </Link>
              <Link to="/dashboard" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                Dashboard
              </Link>
              <Link to="/equipment/new" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>
                + List Equipment
              </Link>
              <Link to="/kyc" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                Identity & KYC Verification
              </Link>
              <Link to="/profile" onClick={closeMenus} style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>
                Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              >
                <LogOut size={16} /> Log Out
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Link to="/login" onClick={closeMenus} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                Log In
              </Link>
              <Link to="/register" onClick={closeMenus} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Responsive Styles Injection */}
      <style>{`
        @media (min-width: 900px) {
          .desktop-nav { display: flex !important; }
          .desktop-actions { display: flex !important; }
          .mobile-toggle { display: none !important; }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
