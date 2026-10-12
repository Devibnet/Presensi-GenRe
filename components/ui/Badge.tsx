import React from 'react';
import { getStatusBadgeClass } from '@/lib/utils';

interface BadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function Badge({ status, label, className = '' }: BadgeProps) {
  const displayLabel = label || status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize tracking-wide transition-all ${getStatusBadgeClass(
        status
      )} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {displayLabel}
    </span>
  );
}
