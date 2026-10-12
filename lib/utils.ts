import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format waktu dalam zona waktu Asia/Makassar (WITA, UTC+8)
export function formatDateTimeWITA(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' WITA';
  } catch {
    return dateString;
  }
}

export function formatDateWITA(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatTimeWITA(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' WITA';
  } catch {
    return dateString;
  }
}

export function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'coordinator':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    default:
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  }
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'BPH / Admin';
    case 'coordinator':
      return 'Koordinator Bidang';
    default:
      return 'Panitia Pelaksana';
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
    case 'approved':
    case 'completed':
    case 'on_time':
    case 'eligible':
    case 'issued':
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    case 'pending':
    case 'pending_approval':
    case 'pending_verification':
    case 'calculating':
    case 'submitted':
    case 'under_review':
    case 'in_progress':
    case 'scheduled':
    case 'open':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
    case 'late':
    case 'ineligible':
    case 'rejected':
    case 'cancelled':
    case 'returned':
    case 'revoked':
    case 'suspended':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
  }
}
