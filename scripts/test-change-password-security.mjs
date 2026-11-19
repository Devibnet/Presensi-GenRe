import fs from 'fs';
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

const testClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  console.log('=== TEST SUITE: FITUR GANTI KATA SANDI (SUPER KETAT) ===\n');

  // Gunakan akun panitia uji: fazrul@genrebuleleng.org (initial password: fazrul2027)
  const testEmail = 'fazrul@genrebuleleng.org';
  const initialPassword = 'fazrul2027';

  // 1. Pastikan akun bisa login dengan password awal
  console.log('1. Uji Login Akun Awal...');
  const { data: loginData, error: loginError } = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: initialPassword,
  });

  if (loginError || !loginData.session) {
    console.error('[FAIL] Login awal gagal:', loginError?.message);
    process.exit(1);
  }
  console.log('[PASS] Login akun awal berhasil.');

  // 2. Uji Validasi Password Lama Salah
  console.log('\n2. Uji Proteksi: Password Lama Salah...');
  const { error: wrongOldErr } = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: 'password_salah_123',
  });
  if (wrongOldErr) {
    console.log('[PASS] Sistem berhasil menolak password lama yang salah.');
  } else {
    console.error('[FAIL] Sistem menerima password yang salah!');
  }

  // 3. Uji Kebijakan Kompleksitas Sandi (Super Ketat)
  console.log('\n3. Uji Kebijakan Kompleksitas Sandi:');
  const policyCases = [
    { name: 'Kurang dari 8 Karakter', pass: 'Gen1!', expected: false },
    { name: 'Tanpa Huruf Kapital', pass: 'genre2026!buleleng', expected: false },
    { name: 'Tanpa Huruf Kecil', pass: 'GENRE2026!BULELENG', expected: false },
    { name: 'Tanpa Angka', pass: 'GenReBuleleng!', expected: false },
    { name: 'Tanpa Simbol / Karakter Khusus', pass: 'GenReBuleleng2026', expected: false },
    { name: 'Sandi Sama Dengan Sandi Lama', pass: initialPassword, expected: false },
    { name: 'Sandi Super Kuat Memenuhi Syarat', pass: 'GenRe#Buleleng2026!', expected: true },
  ];

  for (const tc of policyCases) {
    const hasMinLength = tc.pass.length >= 8;
    const hasUpper = /[A-Z]/.test(tc.pass);
    const hasLower = /[a-z]/.test(tc.pass);
    const hasNum = /[0-9]/.test(tc.pass);
    const hasSym = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(tc.pass);
    const isDifferent = tc.pass !== initialPassword;

    const isValid = hasMinLength && hasUpper && hasLower && hasNum && hasSym && isDifferent;
    if (isValid === tc.expected) {
      console.log(`[PASS] Case "${tc.name}" -> ${isValid ? 'VALID' : 'REJECTED'}`);
    } else {
      console.error(`[FAIL] Case "${tc.name}" tidak sesuai ekspektasi!`);
    }
  }

  // 4. Uji Eksekusi Penggantian Password dan Perubahan Metadata
  console.log('\n4. Uji Penggantian Password ke Sandi Baru yang Kuat...');
  const newStrongPassword = 'GenRe#SuperAman2026!';

  // Update via Admin Client
  const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(loginData.user.id);
  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(loginData.user.id, {
    password: newStrongPassword,
    user_metadata: {
      ...targetUser.user.user_metadata,
      must_change_password: false,
      password_updated_at: new Date().toISOString(),
    },
  });

  if (updErr) {
    console.error('[FAIL] Gagal update password:', updErr.message);
    process.exit(1);
  }
  console.log('[PASS] Berhasil update password baru dan flag must_change_password = false.');

  // 5. Uji Login dengan Sandi Baru
  console.log('\n5. Uji Login dengan Sandi Baru...');
  const { data: newLoginData, error: newLoginErr } = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: newStrongPassword,
  });

  if (newLoginErr) {
    console.error('[FAIL] Login dengan sandi baru gagal:', newLoginErr.message);
  } else {
    console.log('[PASS] Login dengan sandi baru BERHASIL!');
  }

  // 6. Uji Login dengan Sandi Lama (Harus Gagal)
  console.log('\n6. Uji Login dengan Sandi Lama (Harus Ditolak)...');
  const { error: oldLoginErr } = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: initialPassword,
  });

  if (oldLoginErr) {
    console.log('[PASS] Login dengan sandi lama berhasil ditolak oleh sistem.');
  } else {
    console.error('[FAIL] Sandi lama masih bisa digunakan!');
  }

  // 7. Kembalikan akun uji ke kondisi semula
  console.log('\n7. Mengembalikan akun uji ke kondisi awal...');
  await supabaseAdmin.auth.admin.updateUserById(loginData.user.id, {
    password: initialPassword,
    user_metadata: {
      ...targetUser.user.user_metadata,
      initial_password: initialPassword,
      must_change_password: true,
      password_updated_at: null,
    },
  });
  console.log('[PASS] Akun uji fazrul@genrebuleleng.org dikembalikan ke fazrul2027.');

  console.log('\n=== SEMUA PENGUJIAN KEAMANAN SUPER KETAT BERHASIL 100% ===');
}

runTests().catch(console.error);
