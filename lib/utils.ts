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
      return 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold';
    case 'coordinator':
      return 'bg-teal-50 text-teal-700 border border-teal-200 font-semibold';
    default:
      return 'bg-sky-50 text-sky-700 border border-sky-200 font-semibold';
  }
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'coordinator':
      return 'Koordinator';
    case 'member':
    default:
      return 'Anggota';
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
    case 'approved':
    case 'completed':
    case 'on_time':
    case 'normal':
    case 'eligible':
    case 'issued':
    case 'resolved':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold';
    case 'early_departure':
      return 'bg-amber-50 text-amber-800 border border-amber-300 font-semibold';
    case 'pending':
    case 'pending_approval':
    case 'pending_verification':
    case 'calculating':
    case 'submitted':
    case 'under_review':
    case 'in_progress':
    case 'scheduled':
    case 'open':
      return 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold';
    case 'late':
    case 'ineligible':
    case 'rejected':
    case 'cancelled':
    case 'returned':
    case 'revoked':
    case 'suspended':
      return 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold';
  }
}

export function sanitizeSupabaseUrl(url?: string | null): string {
  if (!url) return 'https://placeholder-genre.supabase.co';
  let cleaned = url.trim();
  // Tangani typo double http/https (misal: hhttps://)
  if (cleaned.startsWith('hhttps://')) {
    cleaned = cleaned.replace(/^hhttps:\/\//, 'https://');
  } else if (cleaned.startsWith('http://') === false && cleaned.startsWith('https://') === false) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
}

export function isValidHttpUrl(string?: string | null): boolean {
  if (!string) return false;
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Generator otomatis kode kegiatan resmi yang rapi, bermakna, dan unik per periode.
 * Mendukung 3 format:
 * - 'smart': Berdasarkan nama acara (contoh: ACT-WORKSHOP-2, ACT-PLENO-1, ACT-GLADI-1)
 * - 'sequence': Berdasarkan tahun dan nomor urut (contoh: ACT-2026-001)
 * - 'date': Berdasarkan tanggal & kode acak (contoh: ACT-20261016-832)
 */
export function generateActivityCode(
  name?: string,
  existingList?: (string | { activity_code?: string; [key: string]: any })[],
  format: 'smart' | 'sequence' | 'date' = 'smart'
): string {
  const currentYear = new Date().getFullYear();
  const existingCodes = (existingList || [])
    .map((item) => {
      if (typeof item === 'string') return item.toUpperCase().trim();
      return (item?.activity_code || '').toUpperCase().trim();
    })
    .filter(Boolean);

  const trimmed = (name || '').trim();

  // Mode Sequence (Urutan per tahun)
  if (format === 'sequence') {
    let seq = 1;
    let candidate = `ACT-${currentYear}-${String(seq).padStart(3, '0')}`;
    while (existingCodes.includes(candidate)) {
      seq++;
      candidate = `ACT-${currentYear}-${String(seq).padStart(3, '0')}`;
    }
    return candidate;
  }

  // Mode Date (Tanggal & Angka Acak)
  if (format === 'date') {
    const now = new Date();
    const dStr =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    let rand = Math.floor(100 + Math.random() * 900);
    let candidate = `ACT-${dStr}-${rand}`;
    while (existingCodes.includes(candidate)) {
      rand = Math.floor(100 + Math.random() * 900);
      candidate = `ACT-${dStr}-${rand}`;
    }
    return candidate;
  }

  // Mode Smart: Jika nama belum diisi, fallback ke format sequence
  if (!trimmed) {
    let seq = 1;
    let candidate = `ACT-${currentYear}-${String(seq).padStart(3, '0')}`;
    while (existingCodes.includes(candidate)) {
      seq++;
      candidate = `ACT-${currentYear}-${String(seq).padStart(3, '0')}`;
    }
    return candidate;
  }

  const words = trimmed
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stopWords = new Set([
    'DAN', '&', 'DI', 'KE', 'DARI', 'UNTUK', 'YANG', 'PADA', 'DENGAN', 'OLEH',
    'TENTANG', 'SEBAGAI', 'DALAM', 'KABUPATEN', 'BULELENG', 'TAHUN', 'GENRE',
    'DUTA', 'ACARA', 'KEGIATAN', 'FINALIS', 'PANITIA'
  ]);

  let explicitNumber: number | null = null;
  for (let i = words.length - 1; i >= 0; i--) {
    const num = parseInt(words[i], 10);
    if (!isNaN(num) && num > 0 && num < 1000) {
      explicitNumber = num;
      break;
    }
  }

  const significantWords = words
    .map((w) => w.toUpperCase())
    .filter((w) => !stopWords.has(w) && isNaN(parseInt(w, 10)));

  let baseKeyword = '';
  const fullTextUpper = trimmed.toUpperCase();

  if (fullTextUpper.includes('RAPAT PLENO') || fullTextUpper.includes('PLENO')) {
    baseKeyword = 'PLENO';
  } else if (fullTextUpper.includes('WORKSHOP')) {
    baseKeyword = 'WORKSHOP';
  } else if (fullTextUpper.includes('GRAND FINAL')) {
    baseKeyword = 'GRAND-FINAL';
  } else if (
    fullTextUpper.includes('GLADI BERSIH') ||
    fullTextUpper.includes('GLADI KOTOR') ||
    fullTextUpper.includes('GLADI')
  ) {
    baseKeyword = 'GLADI';
  } else if (fullTextUpper.includes('TECHNICAL MEETING') || fullTextUpper.includes('TM')) {
    baseKeyword = 'TM';
  } else if (fullTextUpper.includes('RAPAT KOORDINASI') || fullTextUpper.includes('RAKOR')) {
    baseKeyword = 'RAKOR';
  } else if (fullTextUpper.includes('PELATIHAN')) {
    baseKeyword = 'PELATIHAN';
  } else if (fullTextUpper.includes('SOSIALISASI')) {
    baseKeyword = 'SOSIALISASI';
  } else if (fullTextUpper.includes('SEMINAR')) {
    baseKeyword = 'SEMINAR';
  } else if (fullTextUpper.includes('WEBINAR')) {
    baseKeyword = 'WEBINAR';
  } else if (fullTextUpper.includes('EVALUASI')) {
    baseKeyword = 'EVALUASI';
  } else if (fullTextUpper.includes('BRIEFING')) {
    baseKeyword = 'BRIEFING';
  } else if (fullTextUpper.includes('AUDIENSI')) {
    baseKeyword = 'AUDIENSI';
  } else if (fullTextUpper.includes('BIMBINGAN TEKNIS') || fullTextUpper.includes('BIMTEK')) {
    baseKeyword = 'BIMTEK';
  } else if (fullTextUpper.includes('SIMULASI')) {
    baseKeyword = 'SIMULASI';
  } else if (fullTextUpper.includes('SELEKSI')) {
    baseKeyword = 'SELEKSI';
  } else if (fullTextUpper.includes('KARANTINA')) {
    baseKeyword = 'KARANTINA';
  } else if (significantWords.length > 0) {
    baseKeyword = significantWords.slice(0, 2).join('-');
    if (baseKeyword.length > 15) {
      baseKeyword = significantWords[0].slice(0, 15);
    }
  } else {
    baseKeyword = 'EVENT';
  }

  if (baseKeyword === 'GRAND-FINAL' && explicitNumber === null) {
    const candidate = 'ACT-GRAND-FINAL';
    if (!existingCodes.includes(candidate)) return candidate;
  }

  const prefix = `ACT-${baseKeyword}`;

  if (explicitNumber !== null) {
    let candidate = `${prefix}-${explicitNumber}`;
    let counter = explicitNumber;
    while (existingCodes.includes(candidate)) {
      counter++;
      candidate = `${prefix}-${counter}`;
    }
    return candidate;
  }

  let maxNum = 0;
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  for (const code of existingCodes) {
    const match = code.match(regex);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  let nextNum = maxNum > 0 ? maxNum + 1 : 1;
  let candidate = `${prefix}-${nextNum}`;
  while (existingCodes.includes(candidate)) {
    nextNum++;
    candidate = `${prefix}-${nextNum}`;
  }

  return candidate;
}

