import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { placeholderService } from '../services/placeholderService';
import ServicePlaceholder from '../components/ServicePlaceholder';

export default function PlaceholderPage() {
  const { serviceId } = useParams();
  const info = placeholderService.getPlaceholder(serviceId);

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-12) 0' }}>
      <div className="container" style={{ maxWidth: '780px' }}>
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to AgriRent Home
          </Link>
        </div>

        <ServicePlaceholder
          title={info.title}
          status={info.status}
          description={info.description}
          plannedFeatures={info.features}
        />
      </div>
    </div>
  );
}
