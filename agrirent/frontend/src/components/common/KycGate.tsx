import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export interface KycGateProps {
  actionDescription?: string;
  actionName?: string;
}

export const KycGate: React.FC<KycGateProps> = ({
  actionDescription,
  actionName,
}) => {
  const { kycStatus } = useAuth();
  const description = actionName ? actionName : (actionDescription || 'rent or list agricultural machinery on AgriRent');

  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6 sm:p-8 text-center max-w-xl mx-auto shadow-soft my-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <div className="flex items-center justify-center gap-2 mb-2">
        <h3 className="text-lg font-bold text-slate-900 font-display">KYC Verification Required</h3>
        <Badge status={kycStatus} size="sm" />
      </div>

      <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        Government identity verification is mandatory to {description}. This protects both machinery owners and renters against fraud and equipment loss.
      </p>

      <div className="mt-6 flex justify-center">
        <Link
          to="/kyc"
          className="btn-primary flex items-center gap-2 shadow-soft font-semibold text-sm px-6 py-3 rounded-2xl"
        >
          <span>Complete Verification Now</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
