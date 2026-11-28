import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Tractor,
  MapPin,
  Calendar,
  Shield,
  Star,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { equipmentApi } from '../../api/equipment.api';
import { claimsApi } from '../../api/claims.api';
import { formatINR } from '../../utils/formatCurrency';
import { calculateRentalDays, formatRentalRange } from '../../utils/formatDate';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';

export const EquipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, isKycVerified } = useAuth();

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  // 1. Fetch Equipment Details
  const {
    data: equipment,
    isLoading: isEquipmentLoading,
    isError,
  } = useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentApi.getEquipmentById(id!),
    enabled: Boolean(id),
  });

  // 2. Fetch Owner Review Summary from Claims Service
  const { data: ownerReviews } = useQuery({
    queryKey: ['owner-review-summary', equipment?.ownerId],
    queryFn: () => claimsApi.getReviewSummary(equipment!.ownerId),
    enabled: Boolean(equipment?.ownerId),
  });

  // 3. Check Live Availability
  const rentalDays = calculateRentalDays(startDate, endDate);
  const isDateInvalid = Boolean(startDate && endDate && rentalDays <= 0);

  const { data: availabilityData, isFetching: isCheckingAvailability } = useQuery({
    queryKey: ['equipment-availability', id, startDate, endDate],
    queryFn: () => equipmentApi.checkAvailability(id!, startDate, endDate),
    enabled: Boolean(id && startDate && endDate && !isDateInvalid),
  });

  const isAvailable = availabilityData?.isAvailable;

  // Price calculations
  const pricePerDay = equipment?.pricePerDay || 0;
  const securityDeposit = equipment?.securityDeposit || 0;
  const rentalAmount = pricePerDay * rentalDays;
  const platformFee = Math.round(rentalAmount * 0.1); // 10% platform fee
  const totalAmount = rentalAmount + platformFee + securityDeposit;

  const isOwner = Boolean(user && equipment && user.userId === equipment.ownerId);

  const handleProceedToBooking = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/equipment/${id}?startDate=${startDate}&endDate=${endDate}` } });
      return;
    }
    navigate(`/book/${id}?startDate=${startDate}&endDate=${endDate}`);
  };

  if (isEquipmentLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-96 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-72 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !equipment) {
    return (
      <div className="card p-12 text-center max-w-md mx-auto space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 font-display">Equipment Listing Not Found</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The requested machinery listing does not exist or has been deactivated by its owner.
        </p>
        <Link to="/search" className="btn-primary inline-flex text-xs">
          Browse Other Machinery
        </Link>
      </div>
    );
  }

  const photos = equipment.photos && equipment.photos.length > 0 ? equipment.photos : [
    'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=1200&auto=format&fit=crop&q=80',
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Photo Gallery Carousel */}
      <div className="space-y-3">
        <div className="h-72 sm:h-96 lg:h-[420px] rounded-3xl bg-slate-100 overflow-hidden relative shadow-soft border border-slate-200">
          <img
            src={photos[activePhotoIndex]}
            alt={equipment.name}
            className="w-full h-full object-cover transition-all duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=1200&auto=format&fit=crop&q=80';
            }}
          />
          <div className="absolute top-4 left-4 flex gap-2">
            <Badge status={equipment.condition} size="md" />
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-sm text-slate-800 shadow-sm uppercase">
              {equipment.category}
            </span>
          </div>
        </div>

        {photos.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {photos.map((photo, index) => (
              <button
                key={index}
                onClick={() => setActivePhotoIndex(index)}
                className={`w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  activePhotoIndex === index
                    ? 'border-brand-600 scale-105 shadow-sm'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Details & Booking Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Equipment Info */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
              {equipment.category} Listing
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mt-1">
              {equipment.name}
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>
                {equipment.pickupAddress?.address}, {equipment.pickupAddress?.city},{' '}
                {equipment.pickupAddress?.state} {equipment.pickupAddress?.postalCode}
              </span>
            </p>
          </div>

          {/* Owner Trust Card */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-earth-100 text-earth-800 font-bold flex items-center justify-center font-display">
                {equipment.ownerId.slice(-2)}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Equipment Owner</h4>
                <p className="text-[11px] text-slate-500 font-mono">ID: {equipment.ownerId}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>
                {ownerReviews?.averageRating
                  ? `${ownerReviews.averageRating.toFixed(1)} (${ownerReviews.reviewCount} reviews)`
                  : 'New Partner'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="card space-y-3">
            <h3 className="text-sm font-bold text-slate-900 font-display">Machinery Description</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {equipment.description}
            </p>
          </div>

          {/* Specs */}
          <div className="card space-y-4">
            <h3 className="text-sm font-bold text-slate-900 font-display">Technical Specifications</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Brand</span>
                <span className="font-semibold text-slate-800">{equipment.brand || 'Standard'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Model</span>
                <span className="font-semibold text-slate-800">{equipment.model || 'Heavy Duty'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Manufacturing Year</span>
                <span className="font-semibold text-slate-800">{equipment.manufacturingYear || '2022'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Condition</span>
                <span className="font-semibold text-slate-800">{equipment.condition}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Daily Rate</span>
                <span className="font-semibold text-brand-700">{formatINR(equipment.pricePerDay)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Escrow Deposit</span>
                <span className="font-semibold text-slate-800">{formatINR(equipment.securityDeposit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Date Availability Reservation Box */}
        <div className="lg:col-span-1">
          <div className="card p-6 space-y-5 sticky top-24 border-slate-200">
            <div className="pb-3 border-b border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-slate-900 font-display">
                  {formatINR(equipment.pricePerDay)}
                </span>
                <span className="text-xs text-slate-500"> / day</span>
              </div>
              <span className="text-xs text-slate-500">
                Deposit: <span className="font-bold text-slate-700">{formatINR(equipment.securityDeposit)}</span>
              </span>
            </div>

            {/* Date Pickers */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Select Rental Dates
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
                  <span className="text-[10px] text-slate-500 block mb-1">Return Date (Exclusive)</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field text-xs p-2"
                  />
                </div>
              </div>

              {isDateInvalid && (
                <p className="text-xs text-rose-600 font-medium">
                  Return date must be strictly after the start date.
                </p>
              )}

              {/* Live Availability Status Indicator */}
              {startDate && endDate && !isDateInvalid && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-xl border bg-slate-50">
                    <span className="text-slate-600">Calendar Availability:</span>
                    {isCheckingAvailability ? (
                      <span className="text-slate-500 text-xs">Checking...</span>
                    ) : isAvailable ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Available
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Conflict
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 italic">
                    * Availability is verified in real-time and locked upon booking request creation.
                  </p>
                </div>
              )}
            </div>

            {/* Live Price Calculation Breakdown */}
            {rentalDays > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    {formatINR(pricePerDay)} × {rentalDays} rental days:
                  </span>
                  <span className="font-semibold text-slate-800">{formatINR(rentalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Platform Fee (10%):</span>
                  <span className="font-semibold text-slate-800">{formatINR(platformFee)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Refundable Escrow Deposit:</span>
                  <span className="font-semibold text-slate-800">{formatINR(securityDeposit)}</span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Amount:</span>
                  <span className="text-brand-700 text-base">{formatINR(totalAmount)}</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            {isOwner ? (
              <div className="p-3 bg-earth-50 rounded-xl text-center text-xs text-earth-800 font-semibold border border-earth-200">
                You are the owner of this equipment listing.
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleProceedToBooking}
                disabled={!startDate || !endDate || isDateInvalid || isAvailable === false}
                className="w-full font-bold shadow-soft text-sm py-3"
              >
                <span>{isAuthenticated ? 'Request to Book' : 'Log in to Request Booking'}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}

            <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 space-y-1">
              <p className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Shield className="w-3.5 h-3.5 text-brand-600" />
                AgriRent Escrow Guarantee
              </p>
              <p>Security deposit remains protected and is refunded automatically after verified return.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
