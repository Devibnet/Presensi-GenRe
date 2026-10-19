import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    // 1. Verifikasi Otorisasi: Hanya Admin yang Boleh Mengakses Data Preset
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk sebagai Admin.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('system_role, account_status')
      .eq('id', user.id)
      .maybeSingle();

    if (
      !callerProfile ||
      callerProfile.system_role !== 'admin' ||
      callerProfile.account_status !== 'active'
    ) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Admin aktif yang dapat memuat berkas preset panitia.' },
        { status: 403 }
      );
    }

    // 2. Baca file akun_panitia_genre_buleleng_2026.csv dari root proyek
    const filePath = path.join(process.cwd(), 'akun_panitia_genre_buleleng_2026.csv');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Berkas akun_panitia_genre_buleleng_2026.csv tidak ditemukan di direktori sistem.' },
        { status: 404 }
      );
    }

    const csvContent = fs.readFileSync(filePath, 'utf8');

    // Parse CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    return NextResponse.json({
      success: true,
      filename: 'akun_panitia_genre_buleleng_2026.csv',
      totalRows: parsed.data.length,
      data: parsed.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal membaca berkas CSV preset' },
      { status: 500 }
    );
  }
}
