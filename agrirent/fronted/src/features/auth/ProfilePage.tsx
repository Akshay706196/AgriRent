import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User as UserIcon, Shield, Star, CheckCircle, Phone, Mail, Hash } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { authApi } from '../../api/auth.api';
import { claimsApi } from '../../api/claims.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

const profileSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Valid 10-digit phone required'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { addNotification } = useNotification();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch peer review summary from Claims service
  const { data: reviewSummary } = useQuery({
    queryKey: ['my-review-summary', user?.userId],
    queryFn: () => claimsApi.getReviewSummary(user!.userId),
    enabled: Boolean(user?.userId),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) => authApi.updateProfile(data),
    onSuccess: () => {
      addNotification('success', 'Profile Updated', 'Your profile details have been saved.');
      setIsEditing(false);
      refreshUser();
    },
    onError: (err: any) => {
      addNotification('error', 'Update Failed', err.message);
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
          Farmer Account Profile
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your personal details, KYC credentials, and marketplace reputation.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="card p-6 sm:p-8 space-y-6 border-slate-200/80">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-6 border-b border-slate-100 text-center sm:text-left">
          <div className="w-16 h-16 rounded-3xl bg-brand-100 text-brand-800 font-extrabold text-2xl flex items-center justify-center font-display shadow-soft">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 font-display">{user?.name}</h2>
            <p className="text-xs text-slate-500 font-mono">User ID: {user?.userId}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <Badge status={user?.accountStatus || 'ACTIVE'} size="sm" />
              <Badge status={user?.kycStatus || 'NOT_SUBMITTED'} size="sm" />
              {user?.roles?.includes('ADMIN') && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                  ADMINISTRATOR
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reputation Summary from Claims Service */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
          <div className="space-y-1">
            <span className="text-xs text-slate-600 flex items-center gap-1 font-semibold">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Reputation Rating
            </span>
            <span className="text-xl font-black text-slate-900 font-display">
              {reviewSummary?.averageRating ? `${reviewSummary.averageRating.toFixed(1)} / 5.0` : '5.0'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-slate-600 font-semibold">Verified Reviews</span>
            <span className="text-xl font-black text-slate-900 font-display">
              {reviewSummary?.reviewCount || 0} reviews
            </span>
          </div>
        </div>

        {/* Profile Info / Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <Input label="Full Name" error={errors.name?.message} {...register('name')} />
            <Input label="Phone Number" error={errors.phone?.message} {...register('phone')} />

            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> Email Address
              </span>
              <span className="font-semibold text-slate-800">{user?.email}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> Mobile Phone
              </span>
              <span className="font-semibold text-slate-800">{user?.phone}</span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
