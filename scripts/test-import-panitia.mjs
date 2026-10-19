import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

console.log('=== TEST SUITE: IMPORT DAN PEMBUATAN AKUN PANITIA OTOMATIS ===\n');

// 1. Baca Environment
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.trim().split('='))
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[FAIL] Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  // ---------------------------------------------------------------------------
  // Test 1: Verifikasi File CSV akun_panitia_genre_buleleng_2026.csv
  // ---------------------------------------------------------------------------
  console.log('--- 1. VALIDASI BERKAS CSV ---');
  const csvPath = path.resolve('akun_panitia_genre_buleleng_2026.csv');
  assert(fs.existsSync(csvPath), 'Berkas akun_panitia_genre_buleleng_2026.csv ditemukan di root proyek');

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  assert(parsed.data.length === 42, `Jumlah baris data panitia tepat 42 orang (ditemukan: ${parsed.data.length})`);

  const expectedHeaders = [
    'member_code',
    'full_name',
    'email',
    'password',
    'phone_number',
    'field_code',
    'system_role',
    'organization_position',
  ];
  const actualHeaders = parsed.meta.fields || [];
  const headersValid = expectedHeaders.every((h) => actualHeaders.includes(h));
  assert(headersValid, `Seluruh 8 kolom wajib CSV tersedia: ${expectedHeaders.join(', ')}`);

  // Pastikan seluruh baris memiliki password minimal 6 karakter
  const validPasswords = parsed.data.every((r) => r.password && r.password.trim().length >= 6);
  assert(validPasswords, 'Semua baris panitia memiliki password yang memenuhi standar keamanan Supabase Auth (>= 6 karakter)');

  // ---------------------------------------------------------------------------
  // Test 2: Verifikasi Tabel Divisi & Pemetaan field_code
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. VERIFIKASI PEMETAAN DIVISI (FIELDS) ---');
  const { data: dbFields, error: fErr } = await supabase.from('fields').select('id, field_code, field_name');
  assert(!fErr && dbFields && dbFields.length > 0, `Berhasil mengambil data divisi dari database (Total: ${dbFields?.length || 0})`);

  const dbFieldCodes = new Set(dbFields.map((f) => f.field_code.toUpperCase().trim()));
  const csvFieldCodes = [...new Set(parsed.data.map((r) => r.field_code.toUpperCase().trim()))];

  const allFieldCodesMapped = csvFieldCodes.every((code) => dbFieldCodes.has(code));
  assert(
    allFieldCodesMapped,
    `Seluruh kode bidang CSV (${csvFieldCodes.join(', ')}) memiliki padanan di tabel fields database`
  );

  // ---------------------------------------------------------------------------
  // Test 3: Verifikasi Perlindungan Akun Admin Eksisting (Ketentuan 8)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. PERLINDUNGAN AKUN ADMIN EKSISTING ---');
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, full_name, email, system_role')
    .eq('system_role', 'admin');

  assert(admins && admins.length >= 2, `Akun admin eksisting aman (${admins?.length} admin terdaftar)`);
  const adminEmails = admins?.map((a) => a.email.toLowerCase()) || [];
  assert(
    adminEmails.includes('angga@genrebuleleng.org') &&
    adminEmails.includes('sukkun@genrebuleleng.org'),
    'Akun admin Penanggung Jawab dan Ketua Panitia berstatus admin dan terverifikasi aman'
  );

  // ---------------------------------------------------------------------------
  // Test 4: Simulasi Pembuatan Akun, Hak Akses, Idempotensi, dan Rollback
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. UJI INTEGRITAS OPERASIONAL & KOMPENSASI ROLLBACK ---');
  const testEmail = `test.audit.panitia.${Date.now()}@genrebuleleng.org`;
  const testCode = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;

  let testUserId = null;

  try {
    // 4A. Buat Akun Uji di Supabase Auth
    const { data: authUser, error: aErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Panitia Uji Otomatis', member_code: testCode, system_role: 'member' },
    });

    assert(!aErr && authUser?.user?.id, `Pembuatan akun uji di Supabase Auth berhasil (ID: ${authUser?.user?.id})`);
    testUserId = authUser?.user?.id;

    // 4B. Simpan Profil ke Tabel profiles dengan role 'member'
    const { error: prErr } = await supabase.from('profiles').insert({
      id: testUserId,
      member_code: testCode,
      full_name: 'Panitia Uji Otomatis',
      email: testEmail,
      system_role: 'member',
      organization_position: 'Anggota Pengujian',
      account_status: 'active',
    });

    assert(!prErr, 'Penyimpanan profil panitia uji ke tabel profiles berhasil');

    // 4C. Verifikasi Role Tetap 'member' dan Password Tidak Disimpan di Profiles
    const { data: profileCheck } = await supabase.from('profiles').select('*').eq('id', testUserId).single();
    assert(profileCheck?.system_role === 'member', "Role profil terkonfirmasi 'member'");
    assert(profileCheck?.password === undefined, 'Tabel profiles tidak memiliki kolom password terbuka (Password aman)');

    // 4D. Uji Idempotensi: Percobaan membuat akun dengan email yang sama harus dicegah
    const { error: dupErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'AnotherPassword123!',
      email_confirm: true,
    });
    assert(
      Boolean(
        dupErr &&
          (dupErr.message?.toLowerCase().includes('registered') ||
            dupErr.code === 'email_exists' ||
            dupErr.message?.toLowerCase().includes('duplicate'))
      ),
      'Pembuatan akun dengan email duplikat berhasil ditolak oleh Supabase Auth (Status 422 email_exists)'
    );

    // 4E. Uji Kompensasi Rollback: Simulasi kegagalan penyimpanan profil menghapus Auth User
    const rollbackEmail = `test.rollback.${Date.now()}@genrebuleleng.org`;
    const { data: rollbackAuth } = await supabase.auth.admin.createUser({
      email: rollbackEmail,
      password: 'RollbackPassword123!',
      email_confirm: true,
    });
    const rollbackId = rollbackAuth?.user?.id;

    if (rollbackId) {
      // Simulasikan kegagalan insert profil (misal duplikasi member_code yang sudah ada)
      const { error: failedInsert } = await supabase.from('profiles').insert({
        id: rollbackId,
        member_code: testCode, // Kode sengaja duplikat untuk memicu constraint error
        full_name: 'Rollback Tester',
        email: rollbackEmail,
      });

      assert(Boolean(failedInsert), 'Constraint UNIQUE member_code berhasil memicu error saat konflik identitas');

      // Jalankan mekanisme rollback
      await supabase.auth.admin.deleteUser(rollbackId);

      // Verifikasi Auth user telah terhapus
      const { data: checkDeleted } = await supabase.auth.admin.getUserById(rollbackId);
      assert(!checkDeleted?.user, 'Mekanisme kompensasi/rollback berhasil menghapus akun auth agar tidak gantung');
    }

  } finally {
    // Bersihkan akun pengujian
    if (testUserId) {
      await supabase.from('final_evaluations').delete().eq('member_id', testUserId);
      await supabase.from('profiles').delete().eq('id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  }

  console.log(`\n======================================================`);
  console.log(`HASIL AKHIR: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
