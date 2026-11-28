import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  Tractor,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { equipmentApi } from '../../api/equipment.api';
import { formatINR } from '../../utils/formatCurrency';
import { calculateRentalDays, formatRentalRange } from '../../utils/formatDate';
import { Badge } from '../../components/ui/Badge';
import { EquipmentCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [category, setCategory] = useState(searchParams.get('category') || 'ALL');
  const [state, setState] = useState(searchParams.get('state') || '');
  const [district, setDistrict] = useState(searchParams.get('district') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  // Calculate rental duration preview under exclusive end-date convention
  const rentalDays = calculateRentalDays(startDate, endDate);
  const isDateInvalid = Boolean(startDate && endDate && rentalDays <= 0);

  // Sync state with URL params
  const updateUrlParams = () => {
    const p = new URLSearchParams();
    if (category && category !== 'ALL') p.set('category', category);
    if (state) p.set('state', state);
    if (district) p.set('district', district);
    if (minPrice) p.set('minPrice', minPrice);
    if (maxPrice) p.set('maxPrice', maxPrice);
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    setSearchParams(p);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams();
  };

  const resetFilters = () => {
    setCategory('ALL');
    setState('');
    setDistrict('');
    setMinPrice('');
    setMaxPrice('');
    setStartDate('');
    setEndDate('');
    setSearchParams({});
  };

  // TanStack Query for searching equipment
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['equipment-search', category, state, district, minPrice, maxPrice],
    queryFn: () =>
      equipmentApi.searchEquipment({
        category: category !== 'ALL' ? category : undefined,
        state: state || undefined,
        district: district || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        limit: 50,
      }),
  });

  return (
    <div className="space-y-8">
      {/* Search Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
          Browse Farm Machinery
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Explore tractors, harvesters, and specialized tools available for rent across India.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1">
          <form
            onSubmit={handleFilterSubmit}
            className="card p-6 space-y-5 sticky top-24 border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand-600" />
                Filter Machinery
              </h2>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field text-xs"
              >
                <option value="ALL">All Categories</option>
                <option value="TRACTOR">Tractors</option>
                <option value="HARVESTER">Harvesters</option>
                <option value="ROTAVATOR">Rotavators</option>
                <option value="SEEDER">Seeders</option>
                <option value="OTHER">Other Machinery</option>
              </select>
            </div>

            {/* Location (State & District) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">State / Region</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Punjab, Maharashtra..."
                className="input-field text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">District / City</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Ludhiana, Nagpur..."
                className="input-field text-xs"
              />
            </div>

            {/* Date Range with Exclusive End-Date Validator */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Rental Dates (End Date Exclusive)
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block mb-1">Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field text-xs p-2"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-1">Return Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field text-xs p-2"
                  />
                </div>
              </div>

              {isDateInvalid && (
                <p className="text-[11px] text-rose-600 font-medium">
                  Return date must be strictly after the start date.
                </p>
              )}

              {startDate && endDate && !isDateInvalid && (
                <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200/80 text-[11px] text-brand-900 font-medium">
                  Duration: <span className="font-bold">{rentalDays} rental days</span>
                  <p className="text-[10px] text-brand-700 mt-0.5">Under [start, end) exclusive rule</p>
                </div>
              )}
            </div>

            {/* Price Per Day Range */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700">Daily Rate (INR)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min ₹"
                  className="input-field text-xs"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max ₹"
                  className="input-field text-xs"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full text-xs font-semibold">
              Apply Filters
            </Button>
          </form>
        </aside>

        {/* Results Grid */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Showing {data?.data?.length || 0} listings
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              <EquipmentCardSkeleton />
              <EquipmentCardSkeleton />
              <EquipmentCardSkeleton />
              <EquipmentCardSkeleton />
              <EquipmentCardSkeleton />
              <EquipmentCardSkeleton />
            </div>
          ) : isError ? (
            <EmptyState
              title="Failed to Load Machinery"
              description="Could not connect to the Equipment Service. Please verify your connection or try again."
              actionLabel="Retry Search"
              onAction={() => refetch()}
            />
          ) : !data?.data || data.data.length === 0 ? (
            <EmptyState
              title="No Machinery Found"
              description="No equipment matches your current filter criteria. Try adjusting the category, location, or price filters."
              actionLabel="Clear Filters"
              onAction={resetFilters}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.data.map((eq) => (
                <div
                  key={eq.equipmentId}
                  className="card p-4 space-y-4 hover:shadow-elevated transition-all group border-slate-200/80 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="h-48 rounded-2xl bg-slate-100 overflow-hidden relative">
                      {eq.photos && eq.photos.length > 0 ? (
                        <img
                          src={eq.photos[0]}
                          alt={eq.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=800&auto=format&fit=crop&q=60';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-50 text-brand-600">
                          <Tractor className="w-12 h-12 opacity-40" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <Badge status={eq.condition} size="sm" />
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                        {eq.category}
                      </span>
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-1">
                        {eq.name}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {eq.pickupAddress?.city || 'City'}, {eq.pickupAddress?.state || 'State'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-extrabold text-slate-900">
                        {formatINR(eq.pricePerDay)}
                      </span>
                      <span className="text-xs text-slate-500 font-normal"> / day</span>
                      <p className="text-[10px] text-slate-500">Deposit: {formatINR(eq.securityDeposit)}</p>
                    </div>

                    <Link
                      to={`/equipment/${eq.equipmentId}${
                        startDate && endDate && !isDateInvalid ? `?startDate=${startDate}&endDate=${endDate}` : ''
                      }`}
                      className="btn-primary py-2 px-3.5 text-xs font-semibold rounded-xl"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
