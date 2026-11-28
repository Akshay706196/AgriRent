import React, { useState } from 'react';
import { ShieldAlert, Camera, DollarSign } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { claimsApi } from '../../api/claims.api';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { useNotification } from '../../context/NotificationContext';
import { formatINR } from '../../utils/formatCurrency';
import { ApiError } from '../../api/errors';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  depositAmount: number;
  onSuccess: () => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  depositAmount,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [claimedAmount, setClaimedAmount] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { key: idempotencyKey, refreshKey } = useIdempotencyKey(`claim-${bookingId}`);
  const { showNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason.trim()) {
      setErrorMessage('Please describe the damage or issue.');
      return;
    }
    if (claimedAmount <= 0) {
      setErrorMessage('Claimed amount must be greater than ₹0.');
      return;
    }
    if (claimedAmount > depositAmount) {
      setErrorMessage(
        `Claim amount (${formatINR(claimedAmount)}) cannot exceed the held security deposit of ${formatINR(
          depositAmount
        )}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const photos = photoUrl.trim()
        ? [photoUrl.trim()]
        : ['https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=600&q=80'];

      await claimsApi.submitClaim(
        bookingId,
        {
          reason: reason.trim(),
          claimedAmount: Number(claimedAmount),
          evidence: {
            photos,
            notes: notes.trim() || undefined,
          },
        },
        idempotencyKey
      );

      showNotification('success', 'Damage claim submitted for admin review.');
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'CLAIM_WINDOW_CLOSED') {
          setErrorMessage('The 48-hour claim filing window has expired.');
        } else if (err.code === 'INVALID_DEDUCTION') {
          setErrorMessage('Claim amount exceeds allowable security deposit limits.');
        } else {
          setErrorMessage(err.friendlyMessage);
        }
      } else {
        setErrorMessage(err.message || 'Failed to submit claim.');
      }
      refreshKey();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="File Equipment Damage Claim">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
          <p className="font-bold">Security Deposit Protection</p>
          <p className="mt-0.5">
            Maximum claimable amount is capped at the held security deposit:{' '}
            <strong className="text-amber-950 font-mono">{formatINR(depositAmount)}</strong>.
            All claims require photo evidence and are reviewed by AgriRent support.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
            Damage Description / Reason *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Broken rotavator tines, bent hydraulic cylinder"
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
            Claim Amount (₹) *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-earth-400 font-semibold text-sm">₹</span>
            <input
              type="number"
              min="1"
              max={depositAmount}
              value={claimedAmount || ''}
              onChange={(e) => setClaimedAmount(Number(e.target.value))}
              placeholder="0"
              className="w-full pl-8 pr-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
            Evidence Photo URL (HTTPS)
          </label>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://images.example.com/broken-part.jpg"
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1">
            Additional Repair Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Estimated repair shop quotation or replacement parts required..."
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
            Submit Damage Claim
          </Button>
        </div>
      </form>
    </Modal>
  );
};
