import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, AlertCircle, ArrowLeft, Image, Save } from 'lucide-react';
import { equipmentService } from '../services/equipmentService';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorHandler';
import LoadingSpinner from '../components/LoadingSpinner';

const CATEGORIES = [
  { value: 'TRACTOR', label: 'Tractor' },
  { value: 'HARVESTER', label: 'Harvester' },
  { value: 'ROTAVATOR', label: 'Rotavator' },
  { value: 'SEED_DRILL', label: 'Seed Drill' },
  { value: 'SPRAYER', label: 'Sprayer' },
  { value: 'TILLER', label: 'Power Tiller' },
  { value: 'OTHER', label: 'Other Implements' }
];

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent - Like New' },
  { value: 'GOOD', label: 'Good - Well Maintained' },
  { value: 'FAIR', label: 'Fair - Fully Operational' }
];

const STATUSES = [
  { value: 'AVAILABLE', label: 'Available for Rent' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
  { value: 'INACTIVE', label: 'Inactive / Hidden' }
];

export default function EditEquipment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    category: 'TRACTOR',
    description: '',
    pricePerDay: '',
    securityDeposit: '0',
    condition: 'GOOD',
    status: 'AVAILABLE',
    model: '',
    yearOfManufacture: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    imageUrl: ''
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEquipment();
  }, [id]);

  const fetchEquipment = async () => {
    try {
      setInitialLoading(true);
      setError(null);
      const data = await equipmentService.getEquipmentById(id);

      // Verify owner
      if (user && data.ownerId && data.ownerId !== user._id && data.ownerId !== user.id) {
        setError('You are not authorized to edit this equipment listing. Only the owner can make modifications.');
        return;
      }

      setFormData({
        name: data.title || data.name || '',
        category: data.category || 'TRACTOR',
        description: data.description || '',
        pricePerDay: data.pricePerDay || data.dailyRate || '',
        securityDeposit: data.securityDeposit || '0',
        condition: data.condition || 'GOOD',
        status: data.status || 'AVAILABLE',
        model: data.model || '',
        yearOfManufacture: data.yearOfManufacture || '',
        address: data.location?.address || '',
        city: data.location?.city || '',
        state: data.location?.state || '',
        pincode: data.location?.pincode || '',
        imageUrl: data.images && data.images[0] ? data.images[0] : ''
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setInitialLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Equipment title/name is required.');
      return;
    }
    const price = parseFloat(formData.pricePerDay);
    if (isNaN(price) || price <= 0) {
      setError('Price per day must be a positive number.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      title: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim(),
      pricePerDay: price,
      securityDeposit: parseFloat(formData.securityDeposit) || 0,
      condition: formData.condition,
      status: formData.status,
      model: formData.model.trim() || undefined,
      yearOfManufacture: formData.yearOfManufacture ? parseInt(formData.yearOfManufacture, 10) : undefined,
      location: {
        address: formData.address.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim() || undefined
      },
      images: formData.imageUrl.trim() ? [formData.imageUrl.trim()] : []
    };

    try {
      setSaving(true);
      await equipmentService.updateEquipment(id, payload);
      navigate(`/equipment/${id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return <LoadingSpinner message="Loading equipment details..." />;
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-8) 0' }}>
      <div className="container" style={{ maxWidth: '780px' }}>
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <Link to={`/equipment/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to Equipment
          </Link>
        </div>

        <div className="card" style={{ padding: 'var(--spacing-8)' }}>
          <div style={{ marginBottom: 'var(--spacing-6)', paddingBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }}>
            <h1 style={{ fontSize: 'var(--font-2xl)', margin: '0 0 var(--spacing-2)', color: 'var(--color-text-main)' }}>
              Edit Equipment Listing
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: 0 }}>
              Update machinery specifications, daily pricing, availability status, or location details.
            </p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-6)' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Update failed:</strong> {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-name">Equipment Name / Title *</label>
              <input
                id="edit-name"
                name="name"
                type="text"
                className="form-control"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-status">Listing Status</label>
                <select
                  id="edit-status"
                  name="status"
                  className="form-control"
                  value={formData.status}
                  onChange={handleChange}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-condition">Operational Condition</label>
                <select
                  id="edit-condition"
                  name="condition"
                  className="form-control"
                  value={formData.condition}
                  onChange={handleChange}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-category">Category</label>
                <select
                  id="edit-category"
                  name="category"
                  className="form-control"
                  value={formData.category}
                  onChange={handleChange}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-model">Make / Model</label>
                <input
                  id="edit-model"
                  name="model"
                  type="text"
                  className="form-control"
                  value={formData.model}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-desc">Description</label>
              <textarea
                id="edit-desc"
                name="description"
                className="form-control"
                rows={3}
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-price">Price Per Day (₹) *</label>
                <input
                  id="edit-price"
                  name="pricePerDay"
                  type="number"
                  className="form-control"
                  min="1"
                  value={formData.pricePerDay}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-deposit">Security Deposit (₹)</label>
                <input
                  id="edit-deposit"
                  name="securityDeposit"
                  type="number"
                  className="form-control"
                  min="0"
                  value={formData.securityDeposit}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-city">City / District *</label>
                <input
                  id="edit-city"
                  name="city"
                  type="text"
                  className="form-control"
                  value={formData.city}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-state">State *</label>
                <input
                  id="edit-state"
                  name="state"
                  type="text"
                  className="form-control"
                  value={formData.state}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-img">Image URL</label>
              <input
                id="edit-img"
                name="imageUrl"
                type="url"
                className="form-control"
                value={formData.imageUrl}
                onChange={handleChange}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-6)' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ flex: 1, padding: '12px' }}
              >
                {saving ? 'Saving Changes...' : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Save size={18} /> Update Listing
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/equipment/${id}`)}
                className="btn btn-outline"
                style={{ padding: '12px 24px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
