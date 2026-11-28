import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Tractor,
  Search,
  Shield,
  KeyRound,
  Banknote,
  ArrowRight,
  MapPin,
  Calendar,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { equipmentApi } from '../../api/equipment.api';
import { formatINR } from '../../utils/formatCurrency';
import { Badge } from '../../components/ui/Badge';
import { EquipmentCardSkeleton } from '../../components/ui/Skeleton';
import { useTranslation } from 'react-i18next';

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Fetch featured equipment
  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ['featured-equipment'],
    queryFn: () => equipmentApi.searchEquipment({ limit: 6 }),
    staleTime: 60000,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (searchTerm) query.set('q', searchTerm);
    if (selectedCategory !== 'ALL') query.set('category', selectedCategory);
    navigate(`/search?${query.toString()}`);
  };

  const categories = [
    { key: 'ALL', label: 'All Machinery', icon: '🚜' },
    { key: 'TRACTOR', label: 'Tractors', icon: '🚜' },
    { key: 'HARVESTER', label: 'Harvesters', icon: '🌾' },
    { key: 'ROTAVATOR', label: 'Rotavators', icon: '⚙️' },
    { key: 'SEEDER', label: 'Seeders', icon: '🌱' },
  ];

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* 1. HERO SECTION */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-brand-900 via-brand-950 to-slate-950 text-white p-6 sm:p-12 lg:p-16 shadow-elevated">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4ade80_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-800/60 border border-brand-500/30 text-xs font-semibold text-brand-300">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>India's Verified Farmer Rental Marketplace</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-display leading-[1.1] tracking-tight text-white">
            Rent Agricultural Equipment <span className="text-brand-400">Directly</span> from Fellow Farmers
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
            Access modern tractors, harvesters, and rotavators without heavy capital expenditure. Fully secured with government KYC, 6-digit PIN handovers, and escrow deposits.
          </p>

          {/* Quick Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="p-2 sm:p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col sm:flex-row gap-2 max-w-2xl shadow-elevated"
          >
            <div className="flex-1 relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tractor model, harvester, location..."
                className="w-full bg-white text-slate-900 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              className="btn-primary py-3 px-6 text-sm font-bold rounded-xl shadow-soft flex items-center justify-center gap-2"
            >
              <span>Search</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedCategory(c.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategory === c.key
                    ? 'bg-brand-500 text-white shadow-soft'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <span className="mr-1">{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS 4-STEP PROCESS */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
            How AgriRent Works
          </h2>
          <p className="text-sm text-slate-600">
            A transparent 4-stage rental process engineered for trust between farmers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card space-y-3 relative overflow-hidden group hover:border-brand-200 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="font-bold text-base text-slate-900 font-display">Search & Request</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Find verified equipment by category, location, and dates. Availability is checked across rental intervals.
            </p>
          </div>

          <div className="card space-y-3 relative overflow-hidden group hover:border-brand-200 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="font-bold text-base text-slate-900 font-display">Owner Approval</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The machinery owner has 24 hours to review and approve the booking request, guaranteeing responsive partners.
            </p>
          </div>

          <div className="card space-y-3 relative overflow-hidden group hover:border-brand-200 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-earth-50 text-earth-600 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="font-bold text-base text-slate-900 font-display">PIN Handover</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Renter generates a dynamic 6-digit PIN. The owner verifies it at physical handover along with an engine condition report.
            </p>
          </div>

          <div className="card space-y-3 relative overflow-hidden group hover:border-brand-200 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <h3 className="font-bold text-base text-slate-900 font-display">Return & Settlement</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Return PIN concludes rental. Deposit is settled automatically with transparent damage claims and peer review options.
            </p>
          </div>
        </div>
      </section>

      {/* 3. FEATURED EQUIPMENT SHOWCASE */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
              Featured Agricultural Machinery
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Top-rated machinery ready for immediate seasonal deployment.
            </p>
          </div>

          <Link
            to="/search"
            className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>View All ({equipmentData?.total || 0})</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <EquipmentCardSkeleton />
            <EquipmentCardSkeleton />
            <EquipmentCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(equipmentData?.data || []).slice(0, 6).map((eq) => (
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
                      {eq.pickupAddress?.city || 'Punjab'}, {eq.pickupAddress?.state || 'India'}
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
                    to={`/equipment/${eq.equipmentId}`}
                    className="btn-primary py-2 px-3.5 text-xs font-semibold rounded-xl"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. OWNER CTA CALLOUT */}
      <section className="rounded-3xl bg-gradient-to-r from-earth-700 to-earth-900 text-white p-8 sm:p-12 shadow-elevated flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl text-center md:text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white">
            Have idle farm machinery in your shed?
          </h2>
          <p className="text-sm text-earth-100 leading-relaxed">
            List your tractor, rotavator or harvester on AgriRent. Earn daily rental income with security deposits held in escrow and damage claim protection.
          </p>
        </div>

        <Link
          to="/owner/equipment/new"
          className="btn-primary bg-white text-earth-900 hover:bg-earth-50 font-bold px-6 py-3.5 rounded-2xl shadow-soft shrink-0"
        >
          List Your Machinery
        </Link>
      </section>
    </div>
  );
};
