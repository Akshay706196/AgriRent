import React, { useState } from 'react';
import { Star, ShieldAlert } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { claimsApi } from '../../api/claims.api';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { useNotification } from '../../context/NotificationContext';
import { ApiError } from '../../api/errors';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  targetUserId: string;
  onSuccess?: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  targetUserId,
  onSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { key: idempotencyKey, refreshKey } = useIdempotencyKey(`review-${bookingId}`);
  const { showNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rating < 1 || rating > 5) {
      setError('Please select a rating between 1 and 5 stars.');
      return;
    }
    if (feedback.trim().length < 5) {
      setError('Please provide at least a brief comment about your rental experience.');
      return;
    }

    setIsSubmitting(true);
    try {
      await claimsApi.submitReview(
        bookingId,
        {
          targetUserId,
          rating,
          feedback: feedback.trim(),
        },
        idempotencyKey
      );
      showNotification('success', 'Your review and rating have been posted!');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.friendlyMessage);
      } else {
        setError(err.message || 'Failed to submit review.');
      }
      refreshKey();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rate & Review Rental Experience">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-2">
            Your Rating
          </label>
          <div className="flex items-center space-x-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                className="p-1 text-amber-400 hover:scale-110 transition-transform focus:outline-none"
              >
                <Star
                  className={`w-7 h-7 ${
                    (hoverRating !== null ? star <= hoverRating : star <= rating)
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-earth-300'
                  }`}
                />
              </button>
            ))}
            <span className="ml-3 text-sm font-bold text-earth-800">
              {rating} / 5 Stars
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-earth-700 uppercase tracking-wider mb-1.5">
            Feedback & Observations
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Share details about machinery condition, punctuality, and overall communication..."
            className="w-full px-3.5 py-2.5 bg-earth-50 border border-earth-300 rounded-xl text-earth-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start">
            <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Submit Review
          </Button>
        </div>
      </form>
    </Modal>
  );
};
