import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tractor, PlusCircle, AlertCircle, Info, Edit, Trash2, Search, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { equipmentService } from '../services/equipmentService';
import { formatCurrency } from '../utils/formatCurrency';
import { getErrorMessage } from '../utils/errorHandler';

export default function MyEquipment() {
  const { user } = useAuth();

  const [lookupId, setLookupId] = useState('');
  const [equipmentItem, setEquipmentItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupId.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setActionSuccess(null);
      const res = await equipmentService.getEquipmentById(lookupId.trim());

      // Check if current user is the owner
      if (user && res.ownerId && res.ownerId !== user._id && res.ownerId !== user.id) {
        setError(`Equipment '${lookupId.trim()}' belongs to another owner (${res.ownerId}). You can only manage machinery you own.`);
        setEquipmentItem(null);
      } else {
        setEquipmentItem(res);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setEquipmentItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (equipmentId) => {
    if (!window.confirm('Are you sure you want to deactivate this equipment listing? This will prevent new bookings.')) {
      return;
    }

    try {
      setDeactivating(true);
      setError(null);
      await equipmentService.deleteEquipment(equipmentId);
      setActionSuccess('Equipment listing successfully deactivated.');
      // Refresh item
      const updated = await equipmentService.getEquipmentById(equipmentId);
      setEquipmentItem(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-2xl)', margin: 0, color: 'var(--color-text-main)' }}>
            My Equipment Listings
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>
            Manage and maintain machinery registered under your farmer account.
          </p>
        </div>
        <Link to="/equipment/new" className="btn btn-primary" style={{ gap: '6px' }}>
          <PlusCircle size={18} /> List New Equipment
        </Link>
      </div>

      {/* Backend Architecture Limitation Notice (Per Project Spec Section 10E) */}
      <div className="alert alert-info" style={{ marginBottom: 'var(--spacing-6)' }}>
        <Info size={20} style={{ flexShrink: 0 }} />
        <div>
          <strong>Backend Service Contract Notice (Equipment Service limitation):</strong>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-xs)', lineHeight: 1.5 }}>
            The current <code>Equipment Management Service (Port 4001)</code> REST API does not expose an <code>/api/v1/equipment/my-equipment</code> endpoint or an <code>ownerId</code> query filter on <code>GET /api/v1/equipment</code>.
            As mandated by security rules, the frontend does not download all public equipment into the browser to filter client-side.
            You can look up and manage your machinery directly by Equipment ID below, or create new listings.
          </p>
        </div>
      </div>

      {/* Lookup Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
        <h3 style={{ fontSize: 'var(--font-base)', margin: '0 0 var(--spacing-3)', color: 'var(--color-text-main)' }}>
          Manage Equipment by Listing ID
        </h3>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-4)' }}>
          Enter your Equipment ID (e.g., <code>EQ-XXXXXXXX</code> or MongoDB ObjectId) to view, edit, or deactivate your machinery.
        </p>

        <form onSubmit={handleLookup} style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter Equipment ID (e.g. EQ-A1B2C3D4)"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ gap: '6px' }}>
            <Search size={16} /> {loading ? 'Searching...' : 'Find Listing'}
          </button>
        </form>

        {actionSuccess && (
          <div className="alert alert-success" style={{ marginTop: 'var(--spacing-4)' }}>
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginTop: 'var(--spacing-4)' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Lookup Result Card */}
      {equipmentItem && (
        <div className="card" style={{ padding: 'var(--spacing-6)', border: '2px solid var(--color-primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: '4px' }}>
                <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                  {equipmentItem.equipmentId || equipmentItem._id}
                </span>
                <span className={`badge badge-${equipmentItem.status === 'ACTIVE' || equipmentItem.status === 'AVAILABLE' ? 'success' : 'warning'}`}>
                  {equipmentItem.status}
                </span>
                <span className="badge badge-neutral">
                  {equipmentItem.category}
                </span>
              </div>
              <h3 style={{ fontSize: 'var(--font-xl)', margin: '0 0 var(--spacing-1)', color: 'var(--color-text-main)' }}>
                {equipmentItem.name || equipmentItem.title}
              </h3>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                Owner ID: <span style={{ fontFamily: 'monospace' }}>{equipmentItem.ownerId}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Daily Rental Rate</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                {formatCurrency(equipmentItem.pricePerDay || equipmentItem.dailyRate)} <span style={{ fontSize: 'var(--font-xs)', fontWeight: 400 }}>/ day</span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 'var(--spacing-6)' }}>
            {equipmentItem.description}
          </p>

          <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-4)' }}>
            <Link to={`/equipment/${equipmentItem.equipmentId || equipmentItem._id}`} className="btn btn-outline" style={{ fontSize: 'var(--font-xs)', gap: '6px' }}>
              <ExternalLink size={14} /> View Public Page
            </Link>
            <Link to={`/equipment/${equipmentItem.equipmentId || equipmentItem._id}/edit`} className="btn btn-secondary" style={{ fontSize: 'var(--font-xs)', gap: '6px' }}>
              <Edit size={14} /> Edit Listing
            </Link>
            <button
              onClick={() => handleDeactivate(equipmentItem.equipmentId || equipmentItem._id)}
              disabled={deactivating || equipmentItem.status === 'INACTIVE' || equipmentItem.isDeleted}
              className="btn btn-outline"
              style={{ fontSize: 'var(--font-xs)', color: 'var(--color-error)', borderColor: 'var(--color-error)', gap: '6px' }}
            >
              <Trash2 size={14} /> {deactivating ? 'Deactivating...' : equipmentItem.isDeleted ? 'Deactivated' : 'Deactivate Listing'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
