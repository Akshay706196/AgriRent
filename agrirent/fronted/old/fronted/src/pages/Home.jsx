import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Tractor,
  ShieldCheck,
  CalendarCheck,
  PlusCircle,
  ArrowRight,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Wrench,
  DollarSign,
  AlertCircle,
  Clock
} from 'lucide-react';
import { equipmentService } from '../services/equipmentService';
import { formatCurrency } from '../utils/formatCurrency';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const CATEGORIES = [
  { name: 'Tractor', icon: '🚜', count: 'High Power' },
  { name: 'Harvester', icon: '🌾', count: 'Crop Harvesting' },
  { name: 'Rotavator', icon: '⚙️', count: 'Soil Preparation' },
  { name: 'Seed Drill', icon: '🌱', count: 'Precision Seeding' },
  { name: 'Sprayer', icon: '💧', count: 'Pest & Fertilizer' },
  { name: 'Power Tiller', icon: '⛏️', count: 'Small Farms' }
];

export default function Home() {
  const navigate = useNavigate();

  // Search form state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [locationCity, setLocationCity] = useState('');

  // Featured equipment from real backend
  const [featuredEquipment, setFeaturedEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(null);

  useEffect(() => {
    fetchFeaturedEquipment();
  }, []);

  const fetchFeaturedEquipment = async () => {
    try {
      setLoading(true);
      setBackendError(null);
      // Fetch recent available equipment from Equipment Service
      const res = await equipmentService.searchEquipment({ limit: 6, status: 'AVAILABLE' });
      const items = Array.isArray(res) ? res : res?.data || [];
      setFeaturedEquipment(items);
    } catch (err) {
      setBackendError('Equipment Service (Port 4001) is currently unreachable. Start the backend service to view live machinery.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.append('q', searchTerm.trim());
    if (selectedCategory) params.append('category', selectedCategory);
    if (locationCity.trim()) params.append('city', locationCity.trim());

    navigate(`/equipment?${params.toString()}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
        color: 'white',
        padding: 'var(--spacing-16) 0 var(--spacing-20)',
        position: 'relative'
      }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '820px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            padding: '6px 16px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            marginBottom: 'var(--spacing-4)',
            letterSpacing: '0.04em'
          }}>
            <ShieldCheck size={16} /> VERIFIED AGRICULTURAL MACHINERY MARKETPLACE
          </div>

          <h1 style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            margin: '0 0 var(--spacing-4)',
            color: 'white'
          }}>
            Rent the Right Equipment. <br />
            <span style={{ color: '#a5d6a7' }}>Grow More.</span>
          </h1>

          <p style={{
            fontSize: 'var(--font-lg)',
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 1.6,
            margin: '0 auto var(--spacing-8)',
            maxWidth: '680px'
          }}>
            Connect directly with verified local equipment owners. Rent high-performance tractors, harvesters, and tools at fair daily rates, or earn extra revenue from your idle machinery.
          </p>

          {/* Quick CTA Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-4)', flexWrap: 'wrap', marginBottom: 'var(--spacing-10)' }}>
            <Link to="/equipment" className="btn btn-secondary" style={{ backgroundColor: 'white', color: 'var(--color-primary-dark)', fontWeight: 700 }}>
              Browse All Equipment
            </Link>
            <Link to="/equipment/new" className="btn btn-outline" style={{ borderColor: 'white', color: 'white' }}>
              <PlusCircle size={18} /> List Your Equipment
            </Link>
          </div>

          {/* Search Box Card */}
          <div className="card" style={{
            backgroundColor: 'white',
            color: 'var(--color-text-main)',
            padding: 'var(--spacing-6)',
            boxShadow: 'var(--shadow-xl)',
            textAlign: 'left'
          }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-4)', alignItems: 'end' }}>
              <div>
                <label className="form-label" style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  Equipment / Keyword
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. John Deere, Rotavator"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  Category
                </label>
                <select
                  className="form-control"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="TRACTOR">Tractor</option>
                  <option value="HARVESTER">Harvester</option>
                  <option value="ROTAVATOR">Rotavator</option>
                  <option value="SEED_DRILL">Seed Drill</option>
                  <option value="SPRAYER">Sprayer</option>
                  <option value="TILLER">Power Tiller</option>
                  <option value="OTHER">Other Implements</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  City / Village
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Karnal, Ludhiana"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                  <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
                </div>
              </div>

              <div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '42px', gap: '8px' }}>
                  <Search size={18} /> Find Machinery
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Popular Categories Section */}
      <section style={{ padding: 'var(--spacing-16) 0', backgroundColor: 'var(--color-bg)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-10)' }}>
            <h2 style={{ fontSize: 'var(--font-2xl)', margin: '0 0 var(--spacing-2)', color: 'var(--color-text-main)' }}>
              Explore by Equipment Category
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: 0 }}>
              Find specialized machinery calibrated for every seasonal stage of agriculture
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--spacing-4)'
          }}>
            {CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                onClick={() => navigate(`/equipment?category=${encodeURIComponent(cat.name.toUpperCase().replace(/\s+/g, '_'))}`)}
                className="card"
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  padding: 'var(--spacing-6) var(--spacing-4)',
                  transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: 'var(--spacing-2)' }}>{cat.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-text-main)' }}>{cat.name}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>{cat.count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Live Equipment Section */}
      <section style={{ padding: 'var(--spacing-16) 0', backgroundColor: 'var(--color-surface)' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--spacing-8)', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
            <div>
              <span className="badge badge-success" style={{ marginBottom: 'var(--spacing-2)' }}>
                Live Database
              </span>
              <h2 style={{ fontSize: 'var(--font-2xl)', margin: 0, color: 'var(--color-text-main)' }}>
                Featured Equipment for Rent
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: '4px 0 0' }}>
                Verified agricultural equipment currently available on the Equipment Microservice
              </p>
            </div>
            <Link to="/equipment" className="btn btn-outline" style={{ gap: '6px' }}>
              View All Machinery <ArrowRight size={16} />
            </Link>
          </div>

          {backendError && (
            <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-6)' }}>
              <AlertCircle size={18} />
              <span>{backendError}</span>
            </div>
          )}

          {loading ? (
            <LoadingSpinner message="Fetching live equipment listings..." />
          ) : featuredEquipment.length === 0 ? (
            <EmptyState
              title="No Equipment Listed Yet"
              description="No machinery is currently registered in the database. Be the first farmer to list your equipment!"
              actionLabel="List Your Equipment"
              onAction={() => navigate('/equipment/new')}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--spacing-6)'
            }}>
              {featuredEquipment.map((item) => (
                <div key={item._id || item.id} className="card card-hover" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Equipment Image */}
                  <div style={{
                    height: '190px',
                    backgroundColor: '#e8f5e9',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={item.images[0]}
                        alt={item.title || item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Tractor size={48} style={{ color: 'var(--color-primary-light)' }} />
                    )}
                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      <span className="badge badge-success">
                        {item.status || 'AVAILABLE'}
                      </span>
                    </div>
                  </div>

                  {/* Equipment Card Body */}
                  <div style={{ padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                      {item.category}
                    </div>
                    <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 var(--spacing-2)', color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                      {item.title || item.name}
                    </h3>
                    <p style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--font-xs)',
                      lineHeight: 1.5,
                      marginBottom: 'var(--spacing-4)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1
                    }}>
                      {item.description || 'Verified agricultural machinery in prime operational condition.'}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 'var(--font-xs)',
                      color: 'var(--color-text-muted)',
                      marginBottom: 'var(--spacing-4)'
                    }}>
                      <MapPin size={14} style={{ color: 'var(--color-primary)' }} />
                      <span>{item.location?.city ? `${item.location.city}, ${item.location.state}` : 'Location Available upon Booking'}</span>
                    </div>

                    <div style={{
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: 'var(--spacing-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Daily Rate</div>
                        <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                          {formatCurrency(item.pricePerDay || item.dailyRate)} <span style={{ fontSize: 'var(--font-xs)', fontWeight: 400, color: 'var(--color-text-muted)' }}>/ day</span>
                        </div>
                      </div>
                      <Link to={`/equipment/${item._id || item.id}`} className="btn btn-primary" style={{ fontSize: 'var(--font-xs)', padding: '8px 14px' }}>
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{ padding: 'var(--spacing-16) 0', backgroundColor: 'var(--color-bg)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto var(--spacing-12)' }}>
            <h2 style={{ fontSize: 'var(--font-2xl)', margin: '0 0 var(--spacing-2)', color: 'var(--color-text-main)' }}>
              How AgriRent Works
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: 0 }}>
              Transparent, four-step peer-to-peer equipment rental built for modern farming communities
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-6)' }}>
            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--spacing-4)',
                fontWeight: 700,
                fontSize: 'var(--font-lg)'
              }}>
                1
              </div>
              <h3 style={{ fontSize: 'var(--font-base)', marginBottom: 'var(--spacing-2)' }}>Create an Account</h3>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Sign up with your email and phone number. A single account allows both renting and listing machinery.
              </p>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--spacing-4)',
                fontWeight: 700,
                fontSize: 'var(--font-lg)'
              }}>
                2
              </div>
              <h3 style={{ fontSize: 'var(--font-base)', marginBottom: 'var(--spacing-2)' }}>Verify KYC</h3>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Submit official government identity records to build trust and unlock full equipment listing rights.
              </p>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--spacing-4)',
                fontWeight: 700,
                fontSize: 'var(--font-lg)'
              }}>
                3
              </div>
              <h3 style={{ fontSize: 'var(--font-base)', marginBottom: 'var(--spacing-2)' }}>Find or List Machines</h3>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Search high-yield tractors nearby or publish your machinery specifications with custom daily pricing.
              </p>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--spacing-4)',
                fontWeight: 700,
                fontSize: 'var(--font-lg)'
              }}>
                4
              </div>
              <h3 style={{ fontSize: 'var(--font-base)', marginBottom: 'var(--spacing-2)' }}>Confirm Booking</h3>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Select rental dates with guaranteed collision prevention. Owners review and approve requests within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section style={{ padding: 'var(--spacing-16) 0', backgroundColor: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--spacing-8)', alignItems: 'center' }}>
            <div>
              <span className="badge badge-success" style={{ marginBottom: 'var(--spacing-2)' }}>
                Why AgriRent
              </span>
              <h2 style={{ fontSize: 'var(--font-2xl)', margin: '0 0 var(--spacing-4)', color: 'var(--color-text-main)' }}>
                Transforming Machinery Access for Indian Farmers
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', lineHeight: 1.6, marginBottom: 'var(--spacing-6)' }}>
                High capital cost of agricultural implements shouldn't limit agricultural productivity. AgriRent gives smallholder and commercial farmers flexible, timely access to mechanized tools.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                  <div style={{ color: 'var(--color-primary)' }}><CheckCircle2 size={20} /></div>
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 'var(--font-sm)' }}>90% Lower Capital Burden</h4>
                    <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      Avoid heavy agricultural equipment loans by paying only for the days you use the equipment.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                  <div style={{ color: 'var(--color-primary)' }}><CheckCircle2 size={20} /></div>
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 'var(--font-sm)' }}>Guaranteed Equipment Availability</h4>
                    <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      Strict microservice conflict scheduling ensures machinery is reserved without double-booking.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                  <div style={{ color: 'var(--color-primary)' }}><CheckCircle2 size={20} /></div>
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: 'var(--font-sm)' }}>Earn from Idle Assets</h4>
                    <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      Tractor owners earn reliable recurring income during off-peak and inter-season farming cycles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
              <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                <div style={{ color: 'var(--color-primary)', marginBottom: 'var(--spacing-2)' }}><DollarSign size={32} /></div>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--color-text-main)' }}>3%</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Lowest Platform Fee</div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                <div style={{ color: 'var(--color-primary)', marginBottom: 'var(--spacing-2)' }}><Clock size={32} /></div>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--color-text-main)' }}>24 Hours</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Owner Response SLA</div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                <div style={{ color: 'var(--color-primary)', marginBottom: 'var(--spacing-2)' }}><ShieldCheck size={32} /></div>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--color-text-main)' }}>100%</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>KYC Verified Owners</div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                <div style={{ color: 'var(--color-primary)', marginBottom: 'var(--spacing-2)' }}><Wrench size={32} /></div>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--color-text-main)' }}>6+</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Machinery Categories</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
