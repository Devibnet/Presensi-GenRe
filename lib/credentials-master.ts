import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

let cachedMasterMap: Map<string, string> | null = null;

/**
 * Memuat pemetaan kredensial master dari berkas CSV 2026 dan XLSX 2027.
 * Menghasilkan map case-insensitive untuk email dan member_code -> password asli.
 */
export function getMasterCredentialsMap(): Map<string, string> {
  if (cachedMasterMap) {
    return cachedMasterMap;
  }

  const map = new Map<string, string>();

  // 1. Muat CSV Panitia 2026 (42 Akun)
  try {
    const csvPath = path.join(process.cwd(), 'akun_panitia_genre_buleleng_2026.csv');
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf8');
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      for (const row of parsed.data as any[]) {
        if (row.email && row.password) {
          const pass = String(row.password).trim();
          map.set(String(row.email).toLowerCase().trim(), pass);
          if (row.member_code) {
            map.set(String(row.member_code).toUpperCase().trim(), pass);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Gagal membaca berkas akun_panitia_genre_buleleng_2026.csv:', err);
  }

  // 2. Muat XLSX Panitia Baru 2027 (36 Akun)
  try {
    const xlsxPath = path.join(process.cwd(), 'akun_panitia_baru_aksara_genre_buleleng_2027.xlsx');
    if (fs.existsSync(xlsxPath)) {
      const wb = XLSX.readFile(xlsxPath);
      const sheetName = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];
      for (const row of data) {
        if (row.email && row.password) {
          const pass = String(row.password).trim();
          map.set(String(row.email).toLowerCase().trim(), pass);
          if (row.member_code) {
            map.set(String(row.member_code).toUpperCase().trim(), pass);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Gagal membaca berkas akun_panitia_baru_aksara_genre_buleleng_2027.xlsx:', err);
  }

  cachedMasterMap = map;
  return map;
}

/**
 * Resolusi password awal panitia:
 * 1. Prioritas Utama: user_metadata.initial_password dari Supabase Auth
 * 2. Prioritas Kedua: Master map dari CSV 2026 / XLSX 2027
 * 3. Prioritas Ketiga: Pola username ({prefix}2026 atau {prefix}2027)
 * 4. Fallback Default
 */
export function resolveMemberInitialPassword(
  email?: string | null,
  memberCode?: string | null,
  userMetaPassword?: string | null
): string {
  if (userMetaPassword && typeof userMetaPassword === 'string' && userMetaPassword.trim().length > 0) {
    return userMetaPassword.trim();
  }

  const map = getMasterCredentialsMap();

  if (email) {
    const fromEmail = map.get(email.toLowerCase().trim());
    if (fromEmail) return fromEmail;
  }

  if (memberCode) {
    const fromCode = map.get(memberCode.toUpperCase().trim());
    if (fromCode) return fromCode;
  }

  // Fallback berbasis username email jika ada
  if (email && email.includes('@')) {
    const username = email.split('@')[0].toLowerCase().trim();
    if (username.length >= 3) {
      return `${username}2026`;
    }
  }

  return 'GenRe2026!Buleleng';
}
