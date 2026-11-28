import React from 'react';
import { Link } from 'react-router-dom';
import { Tractor, ShieldCheck, HelpCircle, FileText, Phone, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      backgroundColor: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      marginTop: 'auto',
      padding: 'var(--spacing-16) 0 var(--spacing-8)'
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--spacing-8)',
          marginBottom: 'var(--spacing-12)'
        }}>
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
              <div style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                padding: 'var(--spacing-2)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Tractor size={22} />
              </div>
              <span style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                Agri<span style={{ color: 'var(--color-primary)' }}>Rent</span>
              </span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', lineHeight: 1.6, marginBottom: 'var(--spacing-4)' }}>
              Empowering farmers with modern, high-yield agricultural machinery on demand. Rent verified tractors, harvesters, rotavators, and seed drills directly from local owners.
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', color: 'var(--color-text-light)' }}>
              <span className="badge badge-success" style={{ gap: '4px' }}>
                <ShieldCheck size={14} /> KYC Verified Platform
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Quick Navigation
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', fontSize: 'var(--font-sm)' }}>
              <li>
                <Link to="/" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Home</Link>
              </li>
              <li>
                <Link to="/equipment" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Browse Equipment</Link>
              </li>
              <li>
                <Link to="/equipment/new" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>List Your Machinery</Link>
              </li>
              <li>
                <Link to="/dashboard" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Farmer Dashboard</Link>
              </li>
              <li>
                <Link to="/kyc" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Identity & KYC Verification</Link>
              </li>
            </ul>
          </div>

          {/* Future Modules / Placeholders */}
          <div>
            <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Platform Services (Roadmap)
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', fontSize: 'var(--font-sm)' }}>
              <li>
                <Link to="/placeholders/payments" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Escrow Payments</span> <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>Soon</span>
                </Link>
              </li>
              <li>
                <Link to="/placeholders/security-deposit" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Security Deposits</span> <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>Soon</span>
                </Link>
              </li>
              <li>
                <Link to="/placeholders/handover" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Handover & Return PIN</span> <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '2px 6px' }}>Roadmap</span>
                </Link>
              </li>
              <li>
                <Link to="/placeholders/claims" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Damage Claims & Protection</span> <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '2px 6px' }}>Roadmap</span>
                </Link>
              </li>
              <li>
                <Link to="/placeholders/disputes" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Dispute Resolution</span> <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '2px 6px' }}>Roadmap</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Microservices Architecture Status */}
          <div>
            <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Connected Services
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }}></span>
                <span>Equipment Service (Port 4001)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }}></span>
                <span>Booking Service (Port 4002)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }}></span>
                <span>Identity & KYC Service (Port 4003)</span>
              </div>
            </div>
            <div style={{ marginTop: 'var(--spacing-4)', fontSize: 'var(--font-xs)', color: 'var(--color-text-light)' }}>
              <p style={{ margin: 0 }}>Built with Service-Oriented Architecture (SOA).</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: 'var(--spacing-6)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-4)',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-text-muted)'
        }}>
          <div>
            © {new Date().getFullYear()} AgriRent Platform. All rights reserved. Peer-to-Peer Agricultural Machinery Network.
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-6)' }}>
            <Link to="/placeholders/reviews" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Reviews System</Link>
            <Link to="/placeholders/notifications" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Notifications</Link>
            <span style={{ color: 'var(--color-text-light)' }}>v1.0.0 (Production Ready Frontend)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
