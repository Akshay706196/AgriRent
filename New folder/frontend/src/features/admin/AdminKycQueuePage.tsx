import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, Check, X, FileText, UserCheck, AlertCircle } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { KYCSubmission } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { formatDateTime } from '../../utils/formatDate';
import { useNotification } from '../../context/NotificationContext';

export const AdminKycQueuePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [selectedKyc, setSelectedKyc] = useState<KYCSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const { data: queue, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-kyc-queue'],
    queryFn: () => authApi.listPendingKYC(),
  });

  const approveMutation = useMutation({
    mutationFn: (kycId: string) => authApi.approveKYC(kycId, 'Verified document against state registry'),
    onSuccess: () => {
      showNotification('success', 'KYC approved! Farmer account is now VERIFIED.');
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-queue'] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to approve KYC.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ kycId, reason }: { kycId: string; reason: string }) =>
      authApi.rejectKYC(kycId, reason),
    onSuccess: () => {
      showNotification('info', 'KYC submission rejected.');
      setIsRejectModalOpen(false);
      setSelectedKyc(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-queue'] });
    },
    onError: (err: any) => {
      showNotification('error', err.friendlyMessage || err.message || 'Failed to reject KYC.');
    },
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-earth-900">
          Admin KYC Verification Queue
        </h1>
        <p className="text-earth-600 text-sm mt-1">
          Review government document submissions from farmers and verify identity credentials.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="font-semibold">Unable to load pending KYC submissions.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Retry
          </Button>
        </div>
      ) : (queue || []).length === 0 ? (
        <EmptyState
          title="KYC Queue is Clear"
          description="There are currently no pending KYC identity submissions awaiting verification."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-earth-200 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-earth-800">
              <thead className="bg-earth-50 text-xs uppercase font-semibold text-earth-600 border-b border-earth-200">
                <tr>
                  <th className="px-6 py-4">Submission ID</th>
                  <th className="px-6 py-4">User ID</th>
                  <th className="px-6 py-4">Document Type</th>
                  <th className="px-6 py-4">Masked Reference</th>
                  <th className="px-6 py-4">Submitted At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-100">
                {(queue || []).map((kyc) => (
                  <tr key={kyc.kycId} className="hover:bg-earth-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-xs text-earth-600">
                      #{kyc.kycId}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-earth-900">
                      {kyc.userId}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg bg-earth-100 text-earth-800">
                        {kyc.documentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-earth-700">
                      {kyc.documentReference}
                    </td>
                    <td className="px-6 py-4 text-xs text-earth-500">
                      {formatDateTime(kyc.submittedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedKyc(kyc);
                            setIsRejectModalOpen(true);
                          }}
                          className="text-red-700 border-red-200 hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => approveMutation.mutate(kyc.kycId)}
                          isLoading={approveMutation.isPending && approveMutation.variables === kyc.kycId}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {selectedKyc && (
        <ConfirmationDialog
          isOpen={isRejectModalOpen}
          onClose={() => {
            setIsRejectModalOpen(false);
            setSelectedKyc(null);
          }}
          onConfirm={() =>
            rejectMutation.mutate({
              kycId: selectedKyc.kycId,
              reason: rejectReason || 'Document photo blurred or reference mismatch',
            })
          }
          title="Reject KYC Submission"
          description="Provide a clear explanation for the farmer so they can correct and resubmit their documents."
          confirmText="Confirm Rejection"
          variant="danger"
          isLoading={rejectMutation.isPending}
        >
          <div className="mt-3">
            <label className="block text-xs font-semibold text-earth-700 mb-1">
              Rejection Reason *
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document reference does not match UIDAI / PAN format"
              className="w-full px-3 py-2 bg-earth-50 border border-earth-300 rounded-lg text-sm text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
        </ConfirmationDialog>
      )}
    </div>
  );
};
