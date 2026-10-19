import React from 'react';
import { getStatusBadgeClass } from '@/lib/utils';

interface BadgeProps {
  status: string;
  label?: string;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  on_time: 'Tepat Waktu',
  late: 'Terlambat',
  early_departure: 'Mendahului',
  normal: 'Sesuai Jadwal',
  scheduled: 'Dijadwalkan',
  ongoing: 'Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  active: 'Aktif',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  pending: 'Menunggu',
  pending_approval: 'Menunggu Persetujuan',
  pending_verification: 'Menunggu Verifikasi',
  eligible: 'Layak Sertifikat',
  ineligible: 'Belum Layak',
  open: 'Dibuka',
  closed: 'Ditutup',
  submitted: 'Diajukan',
  under_review: 'Dalam Peninjauan',
  resolved: 'Diselesaikan',
};

export function Badge({ status, label, className = '' }: BadgeProps) {
  const displayLabel = label || STATUS_LABELS[status] || status.replace(/_/g, ' ');

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
