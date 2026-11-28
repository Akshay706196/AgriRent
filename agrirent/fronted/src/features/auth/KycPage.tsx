import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../utils/formatDate';

const kycSchema = z.object({
  documentType: z.enum([
    'AADHAAR',
    'PAN',
    'VOTER_ID',
    'PASSPORT',
    'DRIVING_LICENSE',
    'FARMER_ID',
  ]),
  documentReference: z
    .string()
    .min(4, 'Document reference must be at least 4 characters')
    .max(50),
});

type KycFormData = z.infer<typeof kycSchema>;

export const KycPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { addNotification } = useNotification();
  const queryClient = useQueryClient();
  const { key: idempotencyKey, resetKey } = useIdempotencyKey('kyc');

  const [isResubmitting, setIsResubmitting] = useState(false);

  // Fetch current KYC record
  const { data: kyc, isLoading } = useQuery({
    queryKey: ['my-kyc'],
    queryFn: () => authApi.getMyKYC(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KycFormData>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      documentType: 'AADHAAR',
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: KycFormData) => authApi.submitKYC(data, idempotencyKey),
    onSuccess: () => {
      addNotification(
        'success',
        'KYC Submitted',
        'Your identity document has been submitted for administrative verification.'
      );
      resetKey();
      reset();
      setIsResubmitting(false);
      queryClient.invalidateQueries({ queryKey: ['my-kyc'] });
      refreshUser();
    },
    onError: (err: any) => {
      addNotification('error', 'Submission Failed', err.message);
    },
  });

  const onSubmit = (data: KycFormData) => {
    submitMutation.mutate(data);
  };

  const status = kyc?.status || user?.kycStatus || 'NOT_SUBMITTED';
  const showForm = status === 'NOT_SUBMITTED' || status === 'REJECTED' || isResubmitting;

  const docOptions = [
    { value: 'AADHAAR', label: 'Aadhaar Card (12-digit UID)' },
    { value: 'PAN', label: 'PAN Card (Income Tax ID)' },
    { value: 'FARMER_ID', label: 'Kisan / Farmer Credit Card ID' },
    { value: 'VOTER_ID', label: 'Voter ID (Election Card)' },
    { value: 'DRIVING_LICENSE', label: 'Driving License' },
    { value: 'PASSPORT', label: 'Indian Passport' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
          Farmer Identity & KYC Verification
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Government-recognized identification is mandatory on AgriRent to safeguard machinery rentals and deposits.
        </p>
      </div>

      {/* Current Status Card */}
      <div className="card p-6 border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Current Verification Status</h2>
              <p className="text-[11px] text-slate-500">Linked to user: {user?.name}</p>
            </div>
          </div>

          <Badge status={status} size="md" />
        </div>

        {/* Dynamic Status Explanations */}
        {status === 'VERIFIED' && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Account Verified and Fully Active
            </p>
            <p>
              Your identity credentials have been confirmed by AgriRent administrators. You have complete access to request bookings and list equipment.
            </p>
            {kyc?.documentReference && (
              <p className="font-mono text-[11px] text-emerald-700 pt-1">
                Verified Document: {kyc.documentType} (•••• {kyc.documentReference.slice(-4)})
              </p>
            )}
          </div>
        )}

        {status === 'PENDING' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-900">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              Verification Under Review
            </p>
            <p>
              Your document ({kyc?.documentType || 'ID'}) was submitted on {formatDate(kyc?.submittedAt)}. Administrators typically review submissions within 2 to 4 hours.
            </p>
          </div>
        )}

        {status === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-rose-900">
              <XCircle className="w-4 h-4 text-rose-600" />
              Submission Rejected
            </p>
            <p>
              Reason: <span className="font-semibold">{kyc?.rejectionReason || 'Document details could not be validated.'}</span>
            </p>
            <p className="text-slate-600">Please review your document number and submit a fresh verification below.</p>
          </div>
        )}

        {status === 'NOT_SUBMITTED' && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            You have not submitted verification documents yet. Please fill the form below to activate your account.
          </div>
        )}
      </div>

      {/* KYC Submission Form */}
      {showForm && (
        <div className="card p-6 sm:p-8 border-slate-200/80 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                {status === 'REJECTED' ? 'Resubmit Verification' : 'Submit Identity Document'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                We store document numbers in encrypted format and never share raw data.
              </p>
            </div>
            {isResubmitting && (
              <button
                type="button"
                onClick={() => setIsResubmitting(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Select
              label="Select Document Type"
              options={docOptions}
              error={errors.documentType?.message}
              {...register('documentType')}
            />

            <Input
              label="Document Number / Reference"
              type="text"
              placeholder="e.g. 1234 5678 9012 or ABCDE1234F"
              helperText="Enter your official card ID number exactly as printed on the card."
              error={errors.documentReference?.message}
              {...register('documentReference')}
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={submitMutation.isPending}
                className="w-full font-bold text-sm py-3 shadow-soft"
              >
                <span>Submit for Verification</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
