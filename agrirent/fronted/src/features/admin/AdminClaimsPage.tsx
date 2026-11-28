import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, FileText, Image as ImageIcon } from 'lucide-react';
import { claimsApi } from '../../api/claims.api';
import { DamageClaim, EvidenceItem } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatINR } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import { useNotification } from '../../context/NotificationContext';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { ApiError } from '../../api/errors';

export const AdminClaimsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [selectedClaim, setSelectedClaim] = useState<DamageClaim | null>(null);

  // Decision Modal State
  const [decision, setDecision] = useState<'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'>('APPROVED');
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [decisionReason, setDecisionReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { key: idempotencyKey, refreshKey } = useIdempotencyKey('admin-claim-decision');

  const { data: claimsData, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-claims'],
    queryFn: () => claimsApi.listClaims({ limit: 50 }),
  });

  const decisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClaim) return;
      return claimsApi.reviewClaimDecision(
        selectedClaim.claimId,
        {
          decision,
          approvedAmount: decision === 'REJECTED' ? 0 : Number(approvedAmount),
          reason: decisionReason.trim(),
        },
        idempotencyKey
      );
    },
    onSuccess: () => {
      showNotification('success', 'Claim decision finalized and recorded.');
      setSelectedClaim(null);
      setDecisionReason('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_DEDUCTION') {
          setFormError('Approved amount exceeds the claimed damage or maximum allowable security deposit.');
        } else {
          setFormError(err.friendlyMessage);
        }
      } else {
        setFormError(err.message || 'Failed to submit decision.');
      }
      refreshKey();
    },
  });

  const handleOpenDecision = (claim: DamageClaim) => {
    setSelectedClaim(claim);
    setDecision('APPROVED');
    setApprovedAmount(claim.claimedAmount);
    setDecisionReason('');
    setFormError(null);
  };

  const handleDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedClaim) return;

    if (!decisionReason.trim()) {
      setFormError('A detailed reason is required for audit and arbitration records.');
      return;
    }

    if (decision !== 'REJECTED') {
      if (approvedAmount <= 0) {
        setFormError('Approved amount must be greater than ₹0 for approved/partially approved claims.');
        return;
      }
      if (approvedAmount > selectedClaim.claimedAmount) {
        setFormError(`Approved amount cannot exceed the claimed amount of ${formatINR(selectedClaim.claimedAmount)}.`);
        return;
      }
    }

    decisionMutation.mutate();
  };

  const claims = claimsData?.items || [];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
          Admin Claims & Disputes Arbitration
        </h1>
        <p className="text-earth-600 text-sm mt-1">
          Review damage claims submitted by owners, inspect photographic evidence, and approve security deposit deductions.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <p className="font-semibold">Unable to load claims list.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Retry
          </Button>
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          title="No claims filed"
          description="There are currently no damage claims or active disputes requiring admin attention."
        />
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.claimId}
              className="bg-white rounded-2xl border border-earth-200 shadow-soft p-5 sm:p-6 transition-all hover:shadow-card"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-semibold text-earth-500">#{claim.claimId}</span>
                    <Badge status={claim.status} />
                  </div>
                  <h3 className="text-lg font-bold text-earth-900 mt-1">
                    Damage Claim for Booking #{claim.bookingId}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-earth-500 block">Claimed Amount</span>
                  <span className="text-lg font-extrabold text-red-700">
                    {formatINR(claim.claimedAmount)}
                  </span>
                </div>
              </div>

              <div className="bg-earth-50 rounded-xl p-4 text-sm text-earth-800 space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-earth-500 text-xs">Reason:</span>
                  <span className="font-semibold">{claim.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-earth-500 text-xs">Claimant (Owner):</span>
                  <span className="font-mono text-xs">{claim.claimantId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-earth-500 text-xs">Filed At:</span>
                  <span className="text-xs">{formatDateTime(claim.createdAt)}</span>
                </div>
              </div>

              {/* Photo Evidence Thumbnail */}
              {claim.evidence && (
                <div className="mb-4">
                  <span className="text-xs font-bold text-earth-600 uppercase tracking-wider block mb-2">
                    Evidence Photos
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(claim.evidence) ? claim.evidence : [claim.evidence]).map((ev: EvidenceItem, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        {ev.photos?.map((p: string, pIdx: number) => (
                          <a key={pIdx} href={p} target="_blank" rel="noopener noreferrer">
                            <img
                              src={p}
                              alt="Evidence"
                              className="w-20 h-20 object-cover rounded-xl border border-earth-200 hover:scale-105 transition-transform"
                            />
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Decision */}
              {claim.decision && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 mb-4">
                  <div className="flex justify-between font-bold mb-1">
                    <span>Admin Decision: {claim.decision.decision}</span>
                    <span>Approved: {formatINR(claim.decision.approvedAmount)}</span>
                  </div>
                  <p className="text-emerald-800">Note: {claim.decision.reason}</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                {!claim.decision && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenDecision(claim)}
                  >
                    Review & Decide Claim
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {selectedClaim && (
        <Modal
          isOpen={!!selectedClaim}
          onClose={() => setSelectedClaim(null)}
          title={`Arbitrate Claim #${selectedClaim.claimId}`}
        >
          <form onSubmit={handleDecisionSubmit} className="space-y-4">
            <div className="bg-earth-50 rounded-xl p-3.5 text-xs text-earth-700 space-y-1">
              <div className="flex justify-between">
                <span>Claimed Damage Amount:</span>
                <span className="font-bold text-red-700">{formatINR(selectedClaim.claimedAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Claimed Reason:</span>
                <span className="font-medium">{selectedClaim.reason}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
                Admin Decision *
              </label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                <option value="APPROVED">Full Approval (Deduct entire claimed amount)</option>
                <option value="PARTIALLY_APPROVED">Partial Approval (Adjust deduction)</option>
                <option value="REJECTED">Reject Claim (Release deposit to renter)</option>
              </select>
            </div>

            {decision !== 'REJECTED' && (
              <div>
                <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
                  Approved Deduction Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedClaim.claimedAmount}
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
                Decision Rationale / Audit Notes *
              </label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                rows={3}
                placeholder="State basis for decision based on comparison of handover and return reports..."
                className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                required
              />
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start">
                <ShieldAlert className="w-4 h-4 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedClaim(null)}
                disabled={decisionMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={decisionMutation.isPending}>
                Finalize Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
