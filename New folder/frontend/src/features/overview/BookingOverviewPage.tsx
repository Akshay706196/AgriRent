import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Star,
  DollarSign,
  Clock,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { graphqlApi } from '../../api/graphql.api';
import { claimsApi } from '../../api/claims.api';
import { BookingOverview } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { DisputeModal } from '../claims/DisputeModal';
import { formatINR } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import { useNotification } from '../../context/NotificationContext';

export const BookingOverviewPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { showNotification } = useNotification();
  const [activeDisputeClaimId, setActiveDisputeClaimId] = useState<string | null>(null);

  // Fetch single-request GraphQL BookingOverview
  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = useQuery<BookingOverview>({
    queryKey: ['graphql-booking-overview', bookingId],
    queryFn: async () => {
      try {
        return await graphqlApi.getBookingOverview(bookingId!);
      } catch (err) {
        // Fallback to REST settlement & reviews if GraphQL fails
        console.warn('GraphQL query failed, falling back to REST', err);
        const [settlement, reviews, claimsRes] = await Promise.all([
          claimsApi.getSettlementStatus(bookingId!).catch(() => null),
          claimsApi.listReviews({ bookingId }).catch(() => ({ items: [] })),
          claimsApi.listClaims({ bookingId }).catch(() => ({ items: [] })),
        ]);
        return {
          bookingId: bookingId!,
          settlementStatus: settlement as any,
          claims: claimsRes.items || [],
          reviews: reviews.items || [],
        };
      }
    },
    enabled: !!bookingId,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-earth-900 mb-2">Failed to Load Overview</h2>
        <p className="text-earth-600 mb-6">Unable to retrieve GraphQL booking overview.</p>
        <Button variant="primary" onClick={() => refetch()}>
          Retry Query
        </Button>
      </div>
    );
  }

  const settlement = overview.settlementStatus;
  const claims = overview.claims || [];
  const reviews = overview.reviews || [];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      <Link
        to={`/renter/bookings/${bookingId}`}
        className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to Booking #{bookingId}
      </Link>

      {/* Header with GraphQL Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-purple-100 text-purple-900 rounded-lg text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
            <span>Single-Request Claims GraphQL Query</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
            Booking Audit & Settlement Overview
          </h1>
          <p className="text-earth-500 text-xs mt-1">
            Booking Ref: <span className="font-mono font-bold">#{bookingId}</span>
          </p>
        </div>
      </div>

      {/* 1. Settlement Status Card */}
      {settlement && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-soft space-y-6">
          <div className="flex items-center justify-between border-b border-earth-100 pb-4">
            <h2 className="text-lg font-bold text-earth-900 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-emerald-600" />
              Security Deposit & Escrow Settlement
            </h2>
            <Badge status={settlement.caseStatus || 'SETTLED'} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-earth-50 p-4 rounded-2xl">
              <span className="text-earth-500 block mb-1">Deposit Held in Escrow</span>
              <span className="text-base font-extrabold text-emerald-800">
                {formatINR(settlement.depositHeld || 0)}
              </span>
            </div>
            <div className="bg-earth-50 p-4 rounded-2xl">
              <span className="text-earth-500 block mb-1">Late Return Fine</span>
              <span className={`text-base font-extrabold ${settlement.lateFine > 0 ? 'text-red-700' : 'text-earth-900'}`}>
                {formatINR(settlement.lateFine || 0)}
              </span>
            </div>
            <div className="bg-earth-50 p-4 rounded-2xl">
              <span className="text-earth-500 block mb-1">Damage Deductions</span>
              <span className={`text-base font-extrabold ${settlement.totalDamageDeduction > 0 ? 'text-red-700' : 'text-earth-900'}`}>
                {formatINR(settlement.totalDamageDeduction || 0)}
              </span>
            </div>
            <div className="bg-earth-50 p-4 rounded-2xl">
              <span className="text-earth-500 block mb-1">Settlement Status</span>
              <span className="text-base font-bold text-earth-900">
                {settlement.eligibleForSettlement ? 'Eligible' : 'In Review / Waiting'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Damage Claims & Disputes Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-soft space-y-6">
        <h2 className="text-lg font-bold text-earth-900 flex items-center">
          <ShieldCheck className="w-5 h-5 mr-2 text-earth-600" />
          Damage Claims & Arbitration ({claims.length})
        </h2>

        {claims.length === 0 ? (
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-900">
            <p className="font-bold">No damage claims filed</p>
            <p className="mt-0.5">
              The rental concluded cleanly without damage deductions. Escrow release will execute normally.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div key={claim.claimId} className="border border-earth-200 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-earth-500">#{claim.claimId}</span>
                      <Badge status={claim.status} />
                    </div>
                    <h4 className="font-bold text-earth-900 text-sm mt-1">{claim.reason}</h4>
                  </div>
                  <span className="font-extrabold text-red-700 text-base">
                    {formatINR(claim.claimedAmount)}
                  </span>
                </div>

                {/* Evidence */}
                {claim.evidence && (
                  <div className="flex gap-2 pt-2">
                    {(Array.isArray(claim.evidence) ? claim.evidence : [claim.evidence]).map((ev: any, i: number) =>
                      ev.photos?.map((p: string, pIdx: number) => (
                        <a key={`${i}-${pIdx}`} href={p} target="_blank" rel="noopener noreferrer">
                          <img
                            src={p}
                            alt="Damage Evidence"
                            className="w-16 h-16 object-cover rounded-xl border border-earth-200 hover:scale-105 transition-transform"
                          />
                        </a>
                      ))
                    )}
                  </div>
                )}

                {/* Decision */}
                {claim.decision && (
                  <div className="bg-earth-50 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-earth-900">
                      <span>Decision: {claim.decision.decision}</span>
                      <span>Approved Amount: {formatINR(claim.decision.approvedAmount)}</span>
                    </div>
                    <p className="text-earth-600">Reason: {claim.decision.reason}</p>
                  </div>
                )}

                {/* Disputes on Claim */}
                {claim.disputes && claim.disputes.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-900">
                    <span className="font-bold block mb-1">Dispute Active:</span>
                    <p>{claim.disputes[0].reason}</p>
                    <span className="text-[10px] text-red-600 block mt-1">
                      Status: {claim.disputes[0].status}
                    </span>
                  </div>
                )}

                {/* Dispute Button for Renter */}
                {(!claim.disputes || claim.disputes.length === 0) && !claim.decision && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveDisputeClaimId(claim.claimId)}
                      className="text-red-700 border-red-300 hover:bg-red-50"
                    >
                      Dispute Claim
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Peer Reviews Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-earth-200 shadow-soft space-y-6">
        <h2 className="text-lg font-bold text-earth-900 flex items-center">
          <Star className="w-5 h-5 mr-2 text-amber-500 fill-amber-400" />
          Rental Peer Reviews ({reviews.length})
        </h2>

        {reviews.length === 0 ? (
          <p className="text-xs text-earth-500 italic">No reviews submitted yet for this booking.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => (
              <div key={rev.reviewId} className="bg-earth-50 rounded-2xl p-4 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rev.rating ? 'fill-amber-400 text-amber-500' : 'text-earth-300'
                        }`}
                      />
                    ))}
                    <span className="font-bold text-earth-800 ml-1.5">{rev.rating}/5</span>
                  </div>
                  <span className="text-earth-400 text-[10px]">{formatDateTime(rev.createdAt)}</span>
                </div>
                <p className="text-earth-800 text-sm mt-1">{rev.feedback}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Modal */}
      {activeDisputeClaimId && (
        <DisputeModal
          isOpen={!!activeDisputeClaimId}
          onClose={() => setActiveDisputeClaimId(null)}
          claimId={activeDisputeClaimId}
          onSuccess={() => {
            showNotification('success', 'Dispute filed successfully!');
            refetch();
          }}
        />
      )}
    </div>
  );
};
