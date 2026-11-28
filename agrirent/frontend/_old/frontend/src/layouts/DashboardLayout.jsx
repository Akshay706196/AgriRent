import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Tractor, CalendarCheck, ShieldCheck, User, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout() {
  const { user, isKycVerified } = useAuth();

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/my-equipment', label: 'My Equipment', icon: Tractor },
    { to: '/my-bookings', label: 'My Bookings', icon: CalendarCheck },
    { to: '/kyc', label: 'KYC Status', icon: ShieldCheck, badge: !isKycVerified ? 'Action' : null },
    { to: '/profile', label: 'Profile & Security', icon: User }
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-8) 0' }}>
      <div className="container">
        {/* Top Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)',
          paddingBottom: 'var(--spacing-4)',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-2xl)', color: 'var(--color-text-main)' }}>
              Farmer Control Panel
            </h1>
            <p style={{ margin: 'var(--spacing-1) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
              Welcome back, <strong>{user?.name || 'Farmer'}</strong>. Manage your machinery listings, rental requests, and verification status.
            </p>
          </div>
          <div>
            <NavLink to="/equipment/new" className="btn btn-primary" style={{ gap: 'var(--spacing-2)' }}>
              <PlusCircle size={18} /> List New Equipment
            </NavLink>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-2)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 'var(--spacing-8)',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'all var(--transition-fast)'
                })}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="badge badge-warning" style={{ fontSize: '10px', padding: '1px 6px' }}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Content Outlet */}
        <Outlet />
      </div>
    </div>
  );
}
