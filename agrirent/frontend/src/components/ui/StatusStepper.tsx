import React from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { BookingStatus } from '../../api/types';

export interface StatusStepperProps {
  status?: BookingStatus;
  currentStatus?: BookingStatus;
  className?: string;
}

interface StepDef {
  key: string;
  label: string;
}

const STEPS: StepDef[] = [
  { key: 'PENDING_OWNER', label: 'Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PAID', label: 'Paid & Escrow' },
  { key: 'IN_RENTAL', label: 'In Rental' },
  { key: 'RETURNED', label: 'Returned' },
  { key: 'COMPLETED', label: 'Completed' },
];

export const StatusStepper: React.FC<StatusStepperProps> = ({ status, currentStatus, className = '' }) => {
  const activeStatus = currentStatus || status || 'PENDING_OWNER';
  const isTerminalFailure = ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(activeStatus);

  const getStepIndex = (st: BookingStatus): number => {
    switch (st) {
      case 'PENDING_OWNER':
        return 0;
      case 'APPROVED':
        return 1;
      case 'PAID':
        return 2;
      case 'IN_RENTAL':
        return 3;
      case 'RETURNED':
        return 4;
      case 'COMPLETED':
        return 5;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(activeStatus);

  if (isTerminalFailure) {
    return (
      <div className={`p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 ${className}`}>
        <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
          <X className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-rose-900 font-display">
            Booking Terminated: {activeStatus.replace(/_/g, ' ')}
          </h4>
          <p className="text-xs text-rose-700 mt-0.5">
            This rental was closed without completion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-x-auto py-2 ${className}`}>
      <div className="flex items-center min-w-[540px] justify-between relative">
        {/* Connector Line */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />
        <div
          className="absolute top-4 left-6 h-0.5 bg-brand-600 transition-all duration-300 -z-0"
          style={{ width: `${(currentIndex / (STEPS.length - 1)) * 90}%` }}
        />

        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 border-2 ${
                  isDone
                    ? 'bg-brand-600 border-brand-600 text-white shadow-soft'
                    : isCurrent
                    ? 'bg-white border-brand-600 text-brand-600 ring-4 ring-brand-100'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                ) : (
                  idx + 1
                )}
              </div>

              <span
                className={`text-[11px] mt-2 font-medium whitespace-nowrap ${
                  isCurrent
                    ? 'text-brand-800 font-bold'
                    : isDone
                    ? 'text-slate-800 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
