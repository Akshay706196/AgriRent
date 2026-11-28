import React from 'react';
import { Construction, Info } from 'lucide-react';

export const ServicePlaceholder = ({
  title,
  serviceName,
  description,
  expectedPhase = 'Future Microservice Integration',
  features = [],
}) => {
  return (
    <div
      className="card"
      style={{
        border: '1px dashed #6ee7b7',
        backgroundColor: '#f0fdf4',
        marginBottom: '2rem',
      }}
    >
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#dcfce7',
              color: 'var(--color-primary-700)',
            }}
          >
            <Construction size={24} />
          </div>
          <div>
            <span className="badge badge-warning" style={{ marginBottom: '0.25rem' }}>
              Planned Service
            </span>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-primary-900)' }}>
              {title || serviceName}
            </h3>
          </div>
        </div>

        <p style={{ color: 'var(--color-gray-700)', fontSize: '0.95rem', marginBottom: '1rem' }}>
          {description ||
            `This capability belongs to ${serviceName || 'a planned microservice'} and is currently under architectural design. In this phase, AgriRent focuses on Identity & KYC, Equipment Management, and Booking Management.`}
        </p>

        {features.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--color-gray-900)' }}>
              Roadmap Capabilities:
            </strong>
            <ul style={{ margin: '0.5rem 0 0 1.25rem', fontSize: '0.9rem', color: 'var(--color-gray-700)' }}>
              {features.map((feat, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.825rem',
            color: 'var(--color-primary-800)',
            paddingTop: '0.75rem',
            borderTop: '1px solid #bbf7d0',
          }}
        >
          <Info size={16} />
          <span>Integration Phase: {expectedPhase}</span>
        </div>
      </div>
    </div>
  );
};

export default ServicePlaceholder;
