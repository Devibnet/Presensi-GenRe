import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.trim().split('='))
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const supabaseClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== SINKRONISASI INITIAL PASSWORD KE METADATA SUPABASE AUTH ===\n');

  // 1. Baca data 2026 dari CSV
  const csvPath = path.resolve('akun_panitia_genre_buleleng_2026.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const parsed2026 = Papa.parse(csvContent, { header: true, skipEmptyLines: true }).data;

  // 2. Baca data 2027 dari XLSX
  const xlsxPath = path.resolve('akun_panitia_baru_aksara_genre_buleleng_2027.xlsx');
  const wb2027 = XLSX.readFile(xlsxPath);
  const parsed2027 = XLSX.utils.sheet_to_json(wb2027.Sheets['Akun Panitia Baru']);

  const credentialMap = new Map();
  for (const r of parsed2026) {
    if (r.email) {
      credentialMap.set(r.email.toLowerCase().trim(), {
        password: r.password?.trim(),
        code: r.member_code?.trim(),
        name: r.full_name?.trim(),
      });
    }
  }

  for (const r of parsed2027) {
    if (r.email) {
      credentialMap.set(r.email.toLowerCase().trim(), {
        password: r.password?.trim(),
        code: r.member_code?.trim(),
        name: r.full_name?.trim(),
      });
    }
  }

  console.log(`Berhasil memuat ${credentialMap.size} kredensial master dari CSV 2026 dan XLSX 2027.`);

  // 3. Ambil seluruh user dari Supabase Auth
  const { data: authData, error: authListError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (authListError || !authData?.users) {
    console.error('Gagal mengambil daftar pengguna auth:', authListError?.message);
    process.exit(1);
  }

  console.log(`Ditemukan ${authData.users.length} pengguna di Supabase Auth.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const u of authData.users) {
    const email = (u.email || '').toLowerCase().trim();
    const cred = credentialMap.get(email);

    if (cred && cred.password) {
      const currentMeta = u.user_metadata || {};
      if (currentMeta.initial_password !== cred.password) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
          user_metadata: {
            ...currentMeta,
            initial_password: cred.password,
          },
        });

        if (updateError) {
          console.error(`Gagal update metadata ${email}:`, updateError.message);
        } else {
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    }
  }

  console.log(`\nSelesai memperbarui metadata auth: ${updatedCount} diperbarui, ${skippedCount} sudah sinkron.`);

  // 4. Test login untuk beberapa akun representatif
  console.log('\n--- UJI LOGIN DENGAN PASSWORD MASTER ---');
  const testAccounts = [
    { email: 'angga@genrebuleleng.org', role: 'Penanggung Jawab' },
    { email: 'sukkun@genrebuleleng.org', role: 'Ketua Panitia' },
    { email: 'elena@genrebuleleng.org', role: 'Koordinator Acara' },
    { email: 'marieta@genrebuleleng.org', role: 'Anggota Acara 2027' },
    { email: 'deswita@genrebuleleng.org', role: 'Anggota Official Duta 2027' },
  ];

  for (const acc of testAccounts) {
    const cred = credentialMap.get(acc.email.toLowerCase().trim());
    if (!cred) {
      console.error(`[SKIP] Kredensial tidak ditemukan untuk ${acc.email}`);
      continue;
    }

    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: acc.email,
      password: cred.password,
    });

    if (signInError) {
      console.error(`[FAIL] Login ${acc.email} (${acc.role}) GAGAL dengan password "${cred.password}": ${signInError.message}`);
    } else {
      console.log(`[PASS] Login ${acc.email} (${acc.role}) BERHASIL dengan password "${cred.password}"!`);
      // logout session
      await supabaseClient.auth.signOut();
    }
  }
}

main().catch(console.error);
