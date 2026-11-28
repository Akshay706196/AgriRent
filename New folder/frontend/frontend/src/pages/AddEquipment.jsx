import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PlusCircle, Tractor, AlertCircle, ArrowLeft, Image, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { equipmentService } from '../services/equipmentService';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorHandler';

const CATEGORIES = [
  { value: 'TRACTOR', label: 'Tractor' },
  { value: 'HARVESTER', label: 'Harvester' },
  { value: 'ROTAVATOR', label: 'Rotavator' },
  { value: 'SEEDER', label: 'Seeder / Seed Drill' },
  { value: 'OTHER', label: 'Other Implements' }
];

const CONDITIONS = [
  { value: 'NEW', label: 'New - Pristine Condition' },
  { value: 'GOOD', label: 'Good - Well Maintained' },
  { value: 'FAIR', label: 'Fair - Fully Operational' }
];

export default function AddEquipment() {
  const navigate = useNavigate();
  const { isKycVerified } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    category: 'TRACTOR',
    description: '',
    brand: '',
    model: '',
    manufacturingYear: '',
    condition: 'GOOD',
    pricePerDay: '',
    securityDeposit: '0',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    imageUrl: '',
    status: 'ACTIVE'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Frontend validations
    if (!formData.name.trim()) {
      setError('Equipment name is required.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required.');
      return;
    }
    const price = parseFloat(formData.pricePerDay);
    if (isNaN(price) || price <= 0) {
      setError('Price per day must be a number greater than 0.');
      return;
    }
    if (!formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.postalCode.trim()) {
      setError('Complete pickup address (Address, City, State, Postal Code) is required.');
      return;
    }

    // Exact backend contract matching createEquipmentValidator
    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim(),
      condition: formData.condition,
      pricePerDay: price,
      securityDeposit: parseFloat(formData.securityDeposit) || 0,
      brand: formData.brand.trim() || undefined,
      model: formData.model.trim() || undefined,
      manufacturingYear: formData.manufacturingYear ? parseInt(formData.manufacturingYear, 10) : undefined,
      pickupAddress: {
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim()
      },
      photos: formData.imageUrl.trim() ? [formData.imageUrl.trim()] : [],
      status: formData.status
    };

    try {
      setLoading(true);
      const created = await equipmentService.createEquipment(payload);
      const newId = created.equipmentId || created._id || created.id;
      navigate(newId ? `/equipment/${newId}` : '/my-equipment');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-8) 0' }}>
      <div className="container" style={{ maxWidth: '780px' }}>
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <Link to="/equipment" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to Directory
          </Link>
        </div>

        {/* KYC Verification Gate Warning */}
        {!isKycVerified && (
          <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-6)' }}>
            <ShieldAlert size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>KYC Verification Required:</strong> The Equipment Microservice strictly enforces verified KYC status (<code>requireKyc</code>) for creating new equipment listings.
              <div style={{ marginTop: '4px' }}>
                <Link to="/kyc" style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                  Click here to complete KYC Verification &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 'var(--spacing-8)' }}>
          <div style={{ marginBottom: 'var(--spacing-6)', paddingBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }}>
            <h1 style={{ fontSize: 'var(--font-2xl)', margin: '0 0 var(--spacing-2)', color: 'var(--color-text-main)' }}>
              List Agricultural Equipment
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: 0 }}>
              Publish your machinery on the AgriRent Equipment Microservice (Port 4001).
            </p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-6)' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Listing creation failed:</strong> {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Machinery Details */}
            <h3 style={{ fontSize: 'var(--font-base)', marginBottom: 'var(--spacing-4)', color: 'var(--color-text-main)' }}>
              1. Machinery Information
            </h3>

            <div className="form-group">
              <label className="form-label" htmlFor="eq-name">Equipment Name *</label>
              <input
                id="eq-name"
                name="name"
                type="text"
                className="form-control"
                placeholder="e.g. Mahindra 575 DI 45HP Tractor"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="eq-category">Category *</label>
                <select
                  id="eq-category"
                  name="category"
                  className="form-control"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eq-condition">Operational Condition *</label>
                <select
                  id="eq-condition"
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="eq-brand">Brand</label>
                <input
                  id="eq-brand"
                  name="brand"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Mahindra"
                  value={formData.brand}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eq-model">Model</label>
                <input
                  id="eq-model"
                  name="model"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 575 DI"
                  value={formData.model}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eq-year">Manufacturing Year</label>
                <input
                  id="eq-year"
                  name="manufacturingYear"
                  type="number"
                  className="form-control"
                  placeholder="e.g. 2021"
                  min="1950"
                  max={new Date().getFullYear() + 1}
                  value={formData.manufacturingYear}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="eq-desc">Detailed Description *</label>
              <textarea
                id="eq-desc"
                name="description"
                className="form-control"
                rows={3}
                placeholder="Describe horsepower, included implements, fuel type, operator policy, and terms..."
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            {/* Pricing */}
            <h3 style={{ fontSize: 'var(--font-base)', margin: 'var(--spacing-6) 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
              2. Rental Pricing (₹ INR)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="eq-price">Daily Rental Price (₹/day) *</label>
                <input
                  id="eq-price"
                  name="pricePerDay"
                  type="number"
                  className="form-control"
                  placeholder="e.g. 1500"
                  min="1"
                  step="1"
                  value={formData.pricePerDay}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eq-deposit">Refundable Security Deposit (₹) *</label>
                <input
                  id="eq-deposit"
                  name="securityDeposit"
                  type="number"
                  className="form-control"
                  placeholder="e.g. 2000"
                  min="0"
                  step="1"
                  value={formData.securityDeposit}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Pickup Address */}
            <h3 style={{ fontSize: 'var(--font-base)', margin: 'var(--spacing-6) 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
              3. Pickup Location (Mandatory)
            </h3>

            <div className="form-group">
              <label className="form-label" htmlFor="eq-address">Street / Village Address *</label>
              <input
                id="eq-address"
                name="address"
                type="text"
                className="form-control"
                placeholder="e.g. Farm No 12, GT Karnal Road"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="eq-city">City / District *</label>
                <input
                  id="eq-city"
                  name="city"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Karnal"
                  value={formData.city}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eq-state">State *</label>
                <input
                  id="eq-state"
                  name="state"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Haryana"
                  value={formData.state}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eq-postalCode">Postal PIN Code *</label>
                <input
                  id="eq-postalCode"
                  name="postalCode"
                  type="text"
                  className="form-control"
                  placeholder="132001"
                  value={formData.postalCode}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Image URL */}
            <h3 style={{ fontSize: 'var(--font-base)', margin: 'var(--spacing-6) 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
              4. Equipment Photograph URL
            </h3>

            <div className="form-group">
              <label className="form-label" htmlFor="eq-img">Image URL (Optional)</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="eq-img"
                  name="imageUrl"
                  type="url"
                  className="form-control"
                  placeholder="https://example.com/tractor.jpg"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  style={{ paddingLeft: '34px' }}
                />
                <Image size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 'var(--spacing-4)', padding: '12px' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="spinner" style={{ width: 16, height: 16 }}></span> Publishing to Equipment Service...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <PlusCircle size={18} /> Publish Equipment Listing
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
