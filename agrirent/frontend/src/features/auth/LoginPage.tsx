import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Tractor, Lock, Mail, Phone, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiError } from '../../api/errors';

const loginSchema = z.object({
  identifier: z.string().min(3, 'Email or phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login(data.identifier, data.password);
      addNotification('success', 'Logged In', 'Welcome back to AgriRent!');
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_BLOCKED') {
          setErrorMessage('This account is blocked. Please contact AgriRent Support.');
        } else if (err.code === 'ACCOUNT_LOCKED' || err.statusCode === 423) {
          setErrorMessage('Account locked due to multiple failed login attempts. Please wait 15 minutes.');
        } else {
          setErrorMessage('Invalid identifier or password. Please verify your credentials.');
        }
      } else {
        setErrorMessage(err.message || 'Login failed.');
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
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">Sign In to AgriRent</h1>
          <p className="text-xs text-slate-500">
            Access your agricultural machinery rentals, listings and claims.
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
            label="Email or Mobile Phone"
            type="text"
            placeholder="farmer@example.com or 9876543210"
            error={errors.identifier?.message}
            {...register('identifier')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            className="w-full font-bold text-sm py-3 mt-2 shadow-soft"
          >
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
          <p>
            Don't have an AgriRent account yet?{' '}
            <Link to="/register" className="text-brand-700 font-bold hover:underline">
              Register here
            </Link>
          </p>
          <p className="text-[11px] text-slate-400">
            Demo Admin: <span className="font-mono">admin@agrirent.internal</span> / <span className="font-mono">AdminStrongPass123!</span>
          </p>
        </div>
      </div>
    </div>
  );
};
