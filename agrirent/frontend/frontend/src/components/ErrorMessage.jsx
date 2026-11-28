import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const ErrorMessage = ({ message, onRetry, title = 'Unable to Load Information' }) => {
  if (!message) return null;

  return (
    <div
      className="alert alert-danger"
      style={{
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <AlertCircle size={22} style={{ color: '#dc2626', flexShrink: 0 }} />
        <strong style={{ fontSize: '1rem', color: '#991b1b' }}>{title}</strong>
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f1d1d' }}>{message}</p>
      {onRetry && (
        <div>
          <button
            type="button"
            onClick={onRetry}
            className="btn btn-sm btn-secondary"
            style={{
              borderColor: '#fca5a5',
              backgroundColor: '#ffffff',
              color: '#991b1b',
              marginTop: '0.25rem',
            }}
          >
            <RefreshCw size={14} /> Retry Request
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorMessage;
