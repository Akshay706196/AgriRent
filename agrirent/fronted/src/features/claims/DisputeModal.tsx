import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { claimsApi } from '../../api/claims.api';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { useNotification } from '../../context/NotificationContext';
import { ApiError } from '../../api/errors';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  claimId: string;
  onSuccess: () => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({
  isOpen,
  onClose,
  claimId,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { key: idempotencyKey, refreshKey } = useIdempotencyKey(`dispute-${claimId}`);
  const { showNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason.trim()) {
      setErrorMessage('Please state the reason you are disputing this claim.');
      return;
    }

    setIsSubmitting(true);
    try {
      await claimsApi.raiseDispute(
        claimId,
        {
          reason: reason.trim(),
          evidence: notes.trim() ? { notes: notes.trim() } : undefined,
        },
        idempotencyKey
      );

      showNotification('success', 'Dispute raised! AgriRent admin will arbitrate this case.');
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.friendlyMessage);
      } else {
        setErrorMessage(err.message || 'Failed to raise dispute.');
      }
      refreshKey();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Raise Dispute on Damage Claim">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-900 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Formal Arbitration Request</p>
            <p className="mt-0.5">
              Disputes pause automatic deposit deductions and send both handover condition reports and photos
              to an AgriRent admin for neutral resolution.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
            Reason for Disputing Claim *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Damage existed prior to rental, pickup photo proves wear"
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
            Rebuttal Evidence Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Explain timeline, witnesses, or provide counter-arguments..."
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start">
            <ShieldAlert className="w-4 h-4 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Submit Dispute
          </Button>
        </div>
      </form>
    </Modal>
  );
};
