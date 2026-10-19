import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

console.log('=== TEST SUITE: PENGUJIAN LOGIN & HAK AKSES PERAN (ADMIN, KOORDINATOR, ANGGOTA) ===\n');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.trim().split('='))
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

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

async function runRoleTests() {
  // Client Admin (Service Role) untuk inspeksi independen
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---------------------------------------------------------------------------
  // 1. UJI LOGIN & AKSES PENANGGUNG JAWAB (ADMIN)
  // ---------------------------------------------------------------------------
  console.log('--- 1. UJI AKUN PENANGGUNG JAWAB (ADMIN: angga@genrebuleleng.org) ---');
  const clientAngga = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: loginAngga, error: errAngga } = await clientAngga.auth.signInWithPassword({
    email: 'angga@genrebuleleng.org',
    password: 'angga2026',
  });

  assert(!errAngga && loginAngga?.session, 'Login autentikasi Supabase Auth Penanggung Jawab berhasil');
  assert(loginAngga?.user?.email === 'angga@genrebuleleng.org', 'Email terverifikasi: angga@genrebuleleng.org');

  const { data: profAngga } = await clientAngga
    .from('profiles')
    .select('id, member_code, full_name, system_role, organization_position')
    .eq('id', loginAngga?.user?.id)
    .single();

  assert(profAngga?.system_role === 'admin', `Role sistem Penanggung Jawab adalah 'admin' (Aktual: ${profAngga?.system_role})`);
  assert(profAngga?.organization_position === 'Penanggung Jawab', `Jabatan resmi: ${profAngga?.organization_position}`);

  // Admin dapat membaca seluruh profil
  const { data: allProfilesAngga } = await clientAngga.from('profiles').select('id');
  assert(allProfilesAngga && allProfilesAngga.length === 42, `Admin memiliki akses membaca seluruh data panitia (Total: ${allProfilesAngga?.length})`);

  // ---------------------------------------------------------------------------
  // 2. UJI LOGIN & AKSES KETUA PANITIA (ADMIN)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. UJI AKUN KETUA PANITIA (ADMIN: sukkun@genrebuleleng.org) ---');
  const clientSukkun = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: loginSukkun, error: errSukkun } = await clientSukkun.auth.signInWithPassword({
    email: 'sukkun@genrebuleleng.org',
    password: 'sukkun2026',
  });

  assert(!errSukkun && loginSukkun?.session, 'Login autentikasi Supabase Auth Ketua Panitia berhasil');
  assert(loginSukkun?.user?.email === 'sukkun@genrebuleleng.org', 'Email terverifikasi: sukkun@genrebuleleng.org');

  const { data: profSukkun } = await clientSukkun
    .from('profiles')
    .select('id, member_code, full_name, system_role, organization_position')
    .eq('id', loginSukkun?.user?.id)
    .single();

  assert(profSukkun?.system_role === 'admin', `Role sistem Ketua Panitia adalah 'admin' (Aktual: ${profSukkun?.system_role})`);
  assert(profSukkun?.organization_position === 'Ketua Panitia', `Jabatan resmi: ${profSukkun?.organization_position}`);

  // ---------------------------------------------------------------------------
  // 3. UJI LOGIN & AKSES KOORDINATOR SIE (COORDINATOR: elena@genrebuleleng.org)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. UJI AKUN KOORDINATOR SIE ACARA (COORDINATOR: elena@genrebuleleng.org) ---');
  const clientElena = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: loginElena, error: errElena } = await clientElena.auth.signInWithPassword({
    email: 'elena@genrebuleleng.org',
    password: 'elena2026',
  });

  assert(!errElena && loginElena?.session, 'Login autentikasi Supabase Auth Koordinator Sie Acara berhasil');

  const { data: profElena } = await clientElena
    .from('profiles')
    .select('id, member_code, full_name, system_role, organization_position, field_id')
    .eq('id', loginElena?.user?.id)
    .single();

  assert(profElena?.system_role === 'coordinator', `Role sistem Koordinator Sie Acara adalah 'coordinator' (Aktual: ${profElena?.system_role})`);
  assert(profElena?.organization_position === 'Koordinator Sie Acara', `Jabatan resmi: ${profElena?.organization_position}`);

  // Verifikasi divisi Sie Acara terhubung ke Elena sebagai coordinator_id
  const { data: fieldAcr } = await clientElena
    .from('fields')
    .select('id, field_code, field_name, coordinator_id')
    .eq('id', profElena?.field_id)
    .single();

  assert(fieldAcr?.coordinator_id === profElena?.id, `Divisi ${fieldAcr?.field_name} (${fieldAcr?.field_code}) terhubung ke coordinator_id Elena`);

  // UJI PEMBATASAN KEAMANAN KOORDINATOR:
  // 3A. Koordinator TIDAK BOLEH mengubah role dirinya menjadi admin
  const { error: errElevate } = await clientElena
    .from('profiles')
    .update({ system_role: 'admin' })
    .eq('id', profElena?.id);

  assert(Boolean(errElevate), 'RLS WITH CHECK berhasil menolak koordinator mengubah role dirinya menjadi admin');

  // 3B. Koordinator TIDAK BOLEH mengubah profil admin
  const { data: updateAdminAttempt, error: errTamperAdmin } = await clientElena
    .from('profiles')
    .update({ full_name: 'Admin Dibajak' })
    .eq('id', profAngga?.id)
    .select();

  const { data: verifyAngga } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', profAngga?.id)
    .single();

  assert(
    (Boolean(errTamperAdmin) || !updateAdminAttempt || updateAdminAttempt.length === 0) &&
    verifyAngga?.full_name === 'Ida Bagus Angga Prabaswara',
    'RLS USING berhasil mencegah koordinator memodifikasi akun admin (0 baris diubah, data admin tetap utuh)'
  );

  // ---------------------------------------------------------------------------
  // 4. UJI LOGIN & AKSES ANGGOTA BIASA (MEMBER: galang@genrebuleleng.org)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. UJI AKUN ANGGOTA BIASA (MEMBER: galang@genrebuleleng.org) ---');
  const clientGalang = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: loginGalang, error: errGalang } = await clientGalang.auth.signInWithPassword({
    email: 'galang@genrebuleleng.org',
    password: 'galang2026',
  });

  assert(!errGalang && loginGalang?.session, 'Login autentikasi Supabase Auth Anggota (Sekretaris Sie Acara) berhasil');

  const { data: profGalang } = await clientGalang
    .from('profiles')
    .select('id, member_code, full_name, system_role, organization_position')
    .eq('id', loginGalang?.user?.id)
    .single();

  assert(profGalang?.system_role === 'member', `Role sistem anggota adalah 'member' (Aktual: ${profGalang?.system_role})`);

  // UJI PEMBATASAN KEAMANAN ANGGOTA:
  // 4A. Anggota TIDAK BOLEH mengubah role atau status akun
  const { error: errMemberElevate } = await clientGalang
    .from('profiles')
    .update({ system_role: 'coordinator' })
    .eq('id', profGalang?.id);

  assert(Boolean(errMemberElevate), 'RLS WITH CHECK berhasil menolak anggota mengubah role sistem dirinya');

  // 4B. Anggota TIDAK BOLEH mengubah data anggota/koordinator lain
  const { data: updateOtherAttempt, error: errMemberTamper } = await clientGalang
    .from('profiles')
    .update({ full_name: 'Nama Diubah Anggota' })
    .eq('id', profElena?.id)
    .select();

  const { data: verifyElena } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', profElena?.id)
    .single();

  assert(
    (Boolean(errMemberTamper) || !updateOtherAttempt || updateOtherAttempt.length === 0) &&
    verifyElena?.full_name === 'Elena Gloria Velerie',
    'RLS USING berhasil mencegah anggota memodifikasi profil anggota/koordinator lain'
  );

  console.log(`\n======================================================`);
  console.log(`HASIL PENGUJIAN HAK AKSES: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runRoleTests();
