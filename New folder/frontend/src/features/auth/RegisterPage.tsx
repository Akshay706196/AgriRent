import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Tractor, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../api/errors';

const registerSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Valid 10-digit mobile number required').max(15),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerUser } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await registerUser(data);
      addNotification(
        'success',
        'Account Created',
        'Welcome to AgriRent! Your farmer account is ready.'
      );
      navigate('/kyc');
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'USER_EXISTS') {
        setErrorMessage('An account with this email address or phone number is already registered.');
      } else {
        setErrorMessage(err.message || 'Registration failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full shadow-elevated border-slate-200/80 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto shadow-soft">
            <Tractor className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">Create Farmer Account</h1>
          <p className="text-xs text-slate-500">
            One single account allows you to both rent and list equipment.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="Farmer Ramesh Patel"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="ramesh@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Mobile Number (for SMS & PINs)"
            type="tel"
            placeholder="9876543210"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="p-3 bg-brand-50/60 rounded-xl border border-brand-100 text-[11px] text-brand-900 space-y-1">
            <p className="font-semibold flex items-center gap-1 text-brand-800">
              <Check className="w-3.5 h-3.5 text-brand-600" />
              Unified Renter & Machinery Owner Account
            </p>
            <p className="text-slate-600">You don't need separate accounts to rent or list machinery.</p>
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            className="w-full font-bold text-sm py-3 mt-2 shadow-soft"
          >
            <span>Create Account</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-700 font-bold hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};
