import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Tractor,
  Calendar,
  Clock,
  ShieldCheck,
  CreditCard,
  KeyRound,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  FileCheck,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { bookingApi } from '../../api/booking.api';
import { equipmentApi } from '../../api/equipment.api';
import { authApi } from '../../api/auth.api';
import { claimsApi } from '../../api/claims.api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { KycGate } from '../../components/common/KycGate';
import { formatINR } from '../../utils/formatCurrency';
import { formatShortDate } from '../../utils/formatDate';

export const DashboardPage: React.FC = () => {
  const { user, mode, setMode } = useAuth();

  // Queries for Renter mode
  const { data: renterBookings, isLoading: isRenterLoading } = useQuery({
    queryKey: ['renter-bookings'],
    queryFn: () => bookingApi.getMyBookings(),
    enabled: mode === 'RENTER',
  });

  // Queries for Owner mode
  const { data: ownerRequests, isLoading: isOwnerRequestsLoading } = useQuery({
    queryKey: ['owner-requests'],
    queryFn: () => bookingApi.getOwnerRequests(),
    enabled: mode === 'OWNER',
  });

  const { data: myEquipment, isLoading: isEquipmentLoading } = useQuery({
    queryKey: ['my-equipment'],
    queryFn: () => equipmentApi.getMyEquipment(),
    enabled: mode === 'OWNER',
  });

  // Queries for Admin mode
  const { data: pendingKycList } = useQuery({
    queryKey: ['admin-kyc-queue'],
    queryFn: () => authApi.listPendingKYC(),
    enabled: mode === 'ADMIN',
  });

  const { data: claimsList } = useQuery({
    queryKey: ['admin-claims'],
    queryFn: () => claimsApi.listClaims({ limit: 10 }),
    enabled: mode === 'ADMIN',
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white shadow-soft relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-emerald-700/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-emerald-200 mb-3">
            <span>Active View:</span>
            <span className="uppercase text-white tracking-wider font-bold">{mode} MODE</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold">
            Welcome back, {user?.name || 'Farmer'}!
          </h1>
          <p className="text-emerald-100/90 text-sm mt-2 leading-relaxed">
            {mode === 'RENTER'
              ? 'Browse verified tractors, monitor active rental requests, and complete PIN handovers.'
              : mode === 'OWNER'
              ? 'Manage your agricultural machinery listings, approve booking requests, and verify equipment returns.'
              : 'Administrative command center for KYC document verification and damage claim arbitration.'}
          </p>
        </div>
      </div>

      {/* KYC Warning if not verified */}
      {user?.kycStatus !== 'VERIFIED' && mode !== 'ADMIN' && (
        <KycGate actionName={mode === 'OWNER' ? 'list machinery' : 'book equipment'} />
      )}

      {/* RENTER DASHBOARD */}
      {mode === 'RENTER' && (
        <div className="space-y-6">
          {/* Next Best Action Card */}
          {renterBookings && renterBookings.some((b) => b.status === 'APPROVED') && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                    Next Best Action
                  </span>
                  <h3 className="text-lg font-bold text-amber-950 mt-0.5">
                    Payment Required for Approved Rental
                  </h3>
                  <p className="text-xs text-amber-800 mt-1">
                    Your request was accepted by the owner. Complete payment & escrow deposit within 24h to lock in dates.
                  </p>
                </div>
              </div>
              {(() => {
                const approvedBooking = renterBookings.find((b) => b.status === 'APPROVED');
                return (
                  <Link to={`/payments/checkout?bookingId=${approvedBooking?.bookingId}`}>
                    <Button variant="primary" size="lg">
                      Pay Now
                    </Button>
                  </Link>
                );
              })()}
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-earth-200 shadow-soft">
              <span className="text-xs text-earth-500 font-semibold block">Total Rentals</span>
              <span className="text-2xl font-bold text-earth-900 mt-1 block">
                {renterBookings?.length || 0}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-earth-200 shadow-soft">
              <span className="text-xs text-earth-500 font-semibold block">Active in Field</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block">
                {renterBookings?.filter((b) => b.status === 'IN_RENTAL').length || 0}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-earth-200 shadow-soft">
              <span className="text-xs text-earth-500 font-semibold block">Awaiting Approval</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">
                {renterBookings?.filter((b) => b.status === 'PENDING_OWNER').length || 0}
              </span>
            </div>
          </div>

          {/* Recent Bookings List */}
          <div className="bg-white rounded-3xl p-6 border border-earth-200 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-earth-900">Recent Equipment Rentals</h2>
              <Link to="/renter/bookings" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                View All
              </Link>
            </div>

            {isRenterLoading ? (
              <Skeleton className="h-32 w-full rounded-2xl" />
            ) : (renterBookings || []).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-earth-500 mb-4">You have no booking requests yet.</p>
                <Link to="/search">
                  <Button variant="primary">Search Farm Machinery</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {renterBookings!.slice(0, 3).map((b) => (
                  <div
                    key={b.bookingId}
                    className="p-4 rounded-2xl border border-earth-100 hover:border-earth-200 bg-earth-50/50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-semibold text-earth-600">#{b.bookingId}</span>
                        <Badge status={b.status} />
                      </div>
                      <p className="text-xs text-earth-600 mt-1">
                        {formatShortDate(b.startDate)} to {formatShortDate(b.endDate)}
                      </p>
                    </div>
                    <Link to={`/renter/bookings/${b.bookingId}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OWNER DASHBOARD */}
      {mode === 'OWNER' && (
        <div className="space-y-6">
          {/* Next Best Action Card for Owner */}
          {ownerRequests && ownerRequests.some((b) => b.status === 'PENDING_OWNER') && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-soft">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
                    Action Required
                  </span>
                  <h3 className="text-lg font-bold text-emerald-950 mt-0.5">
                    Incoming Booking Awaiting Your Approval
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    You have 24 hours to approve or decline before the booking request expires.
                  </p>
                </div>
              </div>
              <Link to="/owner/requests">
                <Button variant="primary" size="lg">
                  Review Requests
                </Button>
              </Link>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-earth-200 shadow-soft">
              <span className="text-xs text-earth-500 font-semibold block">Listed Machinery</span>
              <span className="text-2xl font-bold text-earth-900 mt-1 block">
                {myEquipment?.length || 0}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-earth-200 shadow-soft">
              <span className="text-xs text-earth-500 font-semibold block">Pending Requests</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">
                {ownerRequests?.filter((b) => b.status === 'PENDING_OWNER').length || 0}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-earth-200 shadow-soft">
              <span className="text-xs text-earth-500 font-semibold block">Active Rented Out</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block">
                {ownerRequests?.filter((b) => b.status === 'IN_RENTAL').length || 0}
              </span>
            </div>
          </div>

          {/* Equipment & Requests Shortcut */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-earth-200 shadow-soft flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-earth-900 text-lg mb-2">My Equipment</h3>
                <p className="text-xs text-earth-600 mb-4">
                  Keep machinery availability and rates up to date to attract nearby farmer rentals.
                </p>
              </div>
              <div className="flex space-x-2">
                <Link to="/owner/equipment" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Manage Fleet
                  </Button>
                </Link>
                <Link to="/owner/equipment/new">
                  <Button variant="primary">
                    <Plus className="w-4 h-4 mr-1" />
                    List New
                  </Button>
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-earth-200 shadow-soft flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-earth-900 text-lg mb-2">Rental Requests & PINs</h3>
                <p className="text-xs text-earth-600 mb-4">
                  Enter 6-digit Handover PINs when handing over machines, and Return PINs upon return.
                </p>
              </div>
              <Link to="/owner/requests">
                <Button variant="primary" className="w-full">
                  Go to Owner Requests
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DASHBOARD */}
      {mode === 'ADMIN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-earth-200 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-earth-900 text-lg">KYC Review Queue</h3>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
                  {pendingKycList?.length || 0} Pending
                </span>
              </div>
              <p className="text-xs text-earth-600 mb-6">
                Review and verify farmer Aadhaar and PAN documents to approve marketplace access.
              </p>
              <Link to="/admin/kyc">
                <Button variant="primary" className="w-full">
                  Process KYC Queue
                </Button>
              </Link>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-earth-200 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-earth-900 text-lg">Claims & Disputes</h3>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-earth-100 text-earth-800 rounded-full">
                  {claimsList?.items?.length || 0} Claims
                </span>
              </div>
              <p className="text-xs text-earth-600 mb-6">
                Arbitrate owner damage deductions against security deposit escrow with photographic evidence.
              </p>
              <Link to="/admin/claims">
                <Button variant="outline" className="w-full">
                  Review Damage Claims
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
