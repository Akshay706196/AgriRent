import React from 'react';

export interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'sm', className = '' }) => {
  const norm = (status || '').toUpperCase().trim();

  let colorStyle = 'bg-slate-100 text-slate-700 border-slate-200';

  if (['VERIFIED', 'APPROVED', 'CONFIRMED', 'COMPLETED', 'ACTIVE', 'PUBLISHED', 'OPEN'].includes(norm)) {
    colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['PENDING', 'PENDING_OWNER', 'SUBMITTED', 'UNDER_REVIEW'].includes(norm)) {
    colorStyle = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['IN_RENTAL', 'HELD'].includes(norm)) {
    colorStyle = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['RETURNED', 'PARTIALLY_APPROVED'].includes(norm)) {
    colorStyle = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (['REJECTED', 'BLOCKED', 'CANCELLED', 'FAILED', 'PIN_LOCKED'].includes(norm)) {
    colorStyle = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['EXPIRED', 'NOT_SUBMITTED', 'INACTIVE', 'SUSPENDED'].includes(norm)) {
    colorStyle = 'bg-slate-100 text-slate-600 border-slate-200';
  }

  const sizeStyle = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colorStyle} ${sizeStyle} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 mr-1.5" />
      {norm.replace(/_/g, ' ')}
    </span>
  );
};
