import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, MapPin, Tractor, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react';
import { equipmentService } from '../services/equipmentService';
import { formatCurrency } from '../utils/formatCurrency';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { getErrorMessage } from '../utils/errorHandler';

export default function EquipmentList() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state synced with searchParams
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [stateName, setStateName] = useState(searchParams.get('state') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'newest');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Data state
  const [equipmentList, setEquipmentList] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 12, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load equipment whenever params change
  useEffect(() => {
    fetchEquipment();
  }, [searchParams]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: searchParams.get('page') || 1,
        limit: 12,
        status: 'AVAILABLE'
      };

      if (searchParams.get('q')) params.search = searchParams.get('q');
      if (searchParams.get('category')) params.category = searchParams.get('category');
      if (searchParams.get('city')) params.city = searchParams.get('city');
      if (searchParams.get('state')) params.state = searchParams.get('state');
      if (searchParams.get('minPrice')) params.minPrice = searchParams.get('minPrice');
      if (searchParams.get('maxPrice')) params.maxPrice = searchParams.get('maxPrice');
      if (searchParams.get('sortBy')) params.sortBy = searchParams.get('sortBy');

      const response = await equipmentService.searchEquipment(params);

      // Equipment service returns { data: [...], pagination: { total, page, limit, pages } } or array
      if (response && response.data && Array.isArray(response.data)) {
        setEquipmentList(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else if (Array.isArray(response)) {
        setEquipmentList(response);
        setPagination({ total: response.length, pages: 1, limit: 12, page: 1 });
      } else {
        setEquipmentList([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setEquipmentList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    const newParams = new URLSearchParams();

    if (searchQuery.trim()) newParams.set('q', searchQuery.trim());
    if (category) newParams.set('category', category);
    if (city.trim()) newParams.set('city', city.trim());
    if (stateName.trim()) newParams.set('state', stateName.trim());
    if (minPrice) newParams.set('minPrice', minPrice);
    if (maxPrice) newParams.set('maxPrice', maxPrice);
    if (sortBy) newParams.set('sortBy', sortBy);
    newParams.set('page', '1');

    setSearchParams(newParams);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategory('');
    setCity('');
    setStateName('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setSearchParams(new URLSearchParams());
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: 'calc(100vh - 72px)', padding: 'var(--spacing-8) 0' }}>
      <div className="container">
        {/* Breadcrumb / Title */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <h1 style={{ fontSize: 'var(--font-2xl)', margin: '0 0 var(--spacing-1)', color: 'var(--color-text-main)' }}>
            Agricultural Equipment Directory
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)', margin: 0 }}>
            Browse verified tractors, harvesters, rotavators, and implements available for daily rental.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="card" style={{ padding: 'var(--spacing-5)', marginBottom: 'var(--spacing-8)' }}>
          <form onSubmit={handleApplyFilters}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-4)' }}>
              <div>
                <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Search Title / Keyword</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search machinery..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Category</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
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
                <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>City / Region</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Karnal, Ludhiana"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Max Price / Day</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="₹ Maximum"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  min="0"
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 'var(--font-xs)' }}>Sort Order</label>
                <select
                  className="form-control"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Recently Listed</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-3)', borderTop: '1px solid var(--color-border)' }}>
              <button type="button" onClick={handleClearFilters} className="btn btn-outline" style={{ fontSize: 'var(--font-xs)', padding: '6px 14px' }}>
                <X size={14} /> Reset Filters
              </button>
              <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--font-xs)', padding: '6px 18px' }}>
                <Filter size={14} /> Apply Filters
              </button>
            </div>
          </form>
        </div>

        {/* Results Area */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-6)' }}>
            <AlertCircle size={18} />
            <div>
              <strong>Failed to load equipment:</strong> {error}
              <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                Ensure the Equipment Microservice is running on <code>http://localhost:4001</code>.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner message="Searching verified equipment listings..." />
        ) : equipmentList.length === 0 ? (
          <EmptyState
            title="No Machinery Found"
            description="No equipment matches your current search filters. Try adjusting your category, price range, or location."
            actionLabel="Reset All Filters"
            onAction={handleClearFilters}
          />
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
              <span>Showing <strong>{equipmentList.length}</strong> {equipmentList.length === 1 ? 'equipment listing' : 'equipment listings'}</span>
              {pagination.pages > 1 && (
                <span>Page {pagination.page} of {pagination.pages}</span>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--spacing-6)'
            }}>
              {equipmentList.map((item) => (
                <div key={item._id || item.id} className="card card-hover" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Image banner */}
                  <div style={{
                    height: '200px',
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

                  {/* Card Content */}
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

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-10)' }}>
                <button
                  className="btn btn-outline"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  style={{ gap: '4px', fontSize: 'var(--font-xs)' }}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  className="btn btn-outline"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  style={{ gap: '4px', fontSize: 'var(--font-xs)' }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
