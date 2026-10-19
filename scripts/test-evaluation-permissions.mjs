import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

console.log('=== TEST SUITE: PENGUJIAN ATURAN HAK AKSES EVALUASI KINERJA ===\n');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.trim().split('='))
);

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
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

async function run() {
  let admin1, admin2, coordAcara, coordHumas, memberAcara, memberHumas;
  try {
    // 1. Ambil data panitia uji dari database
    const { data: a1 } = await supabase.from('profiles').select('*').eq('email', 'angga@genrebuleleng.org').single();
    const { data: a2 } = await supabase.from('profiles').select('*').eq('email', 'sukkun@genrebuleleng.org').single();
    const { data: ca } = await supabase.from('profiles').select('*').eq('email', 'elena@genrebuleleng.org').single();
    const { data: ch } = await supabase.from('profiles').select('*').eq('email', 'yoga@genrebuleleng.org').single();
    const { data: ma } = await supabase.from('profiles').select('*').eq('email', 'galang@genrebuleleng.org').single();
    const { data: mh } = await supabase.from('profiles').select('*').eq('email', 'audry@genrebuleleng.org').single();

    admin1 = a1; admin2 = a2; coordAcara = ca; coordHumas = ch; memberAcara = ma; memberHumas = mh;

    assert(admin1 && admin2, 'Akun Admin Penanggung Jawab dan Ketua Panitia ditemukan');
    assert(coordAcara && coordHumas, 'Akun Koordinator Sie Acara dan Sie Humas ditemukan');
    assert(memberAcara && memberHumas, 'Akun Anggota Sie Acara dan Sie Humas ditemukan');

    // Helper untuk memanggil endpoint API internal
    async function testSaveEvaluation(reviewerId, memberId, scores = {}) {
      const baseUrl = 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/api/evaluations/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId,
          memberId,
          communicationScore: scores.comm || 4.5,
          responsibilityScore: scores.resp || 4.5,
          teamworkScore: scores.team || 5.0,
          initiativeScore: scores.init || 4.0,
          professionalismScore: scores.prof || 5.0,
          evidenceNote: 'Uji integrasi hak akses evaluasi kinerja panitia',
        }),
      });
      const data = await res.json();
      return { status: res.status, ok: res.ok, data };
    }

    console.log('\n--- 1. UJI ATURAN: TIDAK BISA MENILAI AKUN SENDIRI ---');
    // Koordinator menilai diri sendiri
    const resCoordSelf = await testSaveEvaluation(coordAcara.id, coordAcara.id);
    assert(
      !resCoordSelf.ok && resCoordSelf.status === 400 && resCoordSelf.data.error.includes('sendiri'),
      'Koordinator DITOLAK saat mencoba menilai dirinya sendiri'
    );

    // Admin menilai diri sendiri
    const resAdminSelf = await testSaveEvaluation(admin1.id, admin1.id);
    assert(
      !resAdminSelf.ok && resAdminSelf.status === 400 && resAdminSelf.data.error.includes('sendiri'),
      'Admin DITOLAK saat mencoba menilai dirinya sendiri'
    );

    console.log('\n--- 2. UJI ATURAN: AKUN ADMIN HANYA BISA DINILAI OLEH AKUN ADMIN LAIN ---');
    // Admin 2 (Sukkun) menilai Admin 1 (Angga) -> HARUS BOLEH
    const resAdminToAdmin = await testSaveEvaluation(admin2.id, admin1.id);
    assert(
      resAdminToAdmin.ok && resAdminToAdmin.status === 200,
      'Admin lain (Ketua Panitia) BERHASIL menilai Admin Penanggung Jawab'
    );

    // Koordinator Sie Acara (Elena) mencoba menilai Admin 1 (Angga) -> HARUS DITOLAK
    const resCoordToAdmin = await testSaveEvaluation(coordAcara.id, admin1.id);
    assert(
      !resCoordToAdmin.ok && resCoordToAdmin.status === 403 && resCoordToAdmin.data.error.includes('admin lain'),
      'Koordinator DITOLAK saat mencoba menilai akun Admin'
    );

    // Anggota Sie Acara (Galang) mencoba menilai Admin 1 (Angga) -> HARUS DITOLAK
    const resMemberToAdmin = await testSaveEvaluation(memberAcara.id, admin1.id);
    assert(
      !resMemberToAdmin.ok && resMemberToAdmin.status === 403,
      'Anggota biasa DITOLAK saat mencoba menilai akun Admin'
    );

    console.log('\n--- 3. UJI ATURAN: KOORDINATOR HANYA BISA DINILAI OLEH ADMIN ---');
    // Admin 1 (Angga) menilai Koordinator Sie Acara (Elena) -> HARUS BOLEH
    const resAdminToCoord = await testSaveEvaluation(admin1.id, coordAcara.id);
    assert(
      resAdminToCoord.ok && resAdminToCoord.status === 200,
      'Admin BERHASIL menilai Koordinator Sie Acara'
    );

    // Koordinator Sie Humas (Yoga) mencoba menilai Koordinator Sie Acara (Elena) -> HARUS DITOLAK
    const resCoordToCoord = await testSaveEvaluation(coordHumas.id, coordAcara.id);
    assert(
      !resCoordToCoord.ok && resCoordToCoord.status === 403 && resCoordToCoord.data.error.includes('dinilai oleh admin'),
      'Koordinator DITOLAK saat mencoba menilai sesama Koordinator'
    );

    // Anggota biasa (Galang) mencoba menilai Koordinator (Elena) -> HARUS DITOLAK
    const resMemberToCoord = await testSaveEvaluation(memberAcara.id, coordAcara.id);
    assert(
      !resMemberToCoord.ok && resMemberToCoord.status === 403,
      'Anggota biasa DITOLAK saat mencoba menilai Koordinator'
    );

    console.log('\n--- 4. UJI ATURAN: KOORDINATOR HANYA BISA MENILAI ANGGOTA SIE NYA ---');
    // Koordinator Sie Acara (Elena) menilai Anggota Sie Acara (Galang) -> HARUS BOLEH
    const resCoordToOwnMember = await testSaveEvaluation(coordAcara.id, memberAcara.id);
    assert(
      resCoordToOwnMember.ok && resCoordToOwnMember.status === 200,
      'Koordinator Sie Acara BERHASIL menilai anggota sie nya sendiri (Galang)'
    );

    // Koordinator Sie Acara (Elena) mencoba menilai Anggota Sie Humas (Ayu Kartika) -> HARUS DITOLAK
    const resCoordToOtherMember = await testSaveEvaluation(coordAcara.id, memberHumas.id);
    assert(
      !resCoordToOtherMember.ok && resCoordToOtherMember.status === 403 && resCoordToOtherMember.data.error.includes('sie nya'),
      'Koordinator Sie Acara DITOLAK saat mencoba menilai anggota sie lain (Sie Humas)'
    );

    // Admin menilai Anggota Sie Acara -> HARUS BOLEH
    const resAdminToMember = await testSaveEvaluation(admin1.id, memberAcara.id);
    assert(
      resAdminToMember.ok && resAdminToMember.status === 200,
      'Admin BERHASIL menilai anggota sie manapun'
    );

    console.log('\n--- 5. UJI ATURAN: ANGGOTA BIASA TIDAK MEMILIKI HAK MENILAI ---');
    // Anggota Sie Acara (Galang) mencoba menilai Anggota Sie Humas (Ayu Kartika) -> HARUS DITOLAK
    const resMemberToMember = await testSaveEvaluation(memberAcara.id, memberHumas.id);
    assert(
      !resMemberToMember.ok && resMemberToMember.status === 403 && resMemberToMember.data.error.includes('kewenangan'),
      'Anggota biasa DITOLAK saat mencoba memberikan penilaian kinerja'
    );

    console.log('\n======================================================');
    console.log(`HASIL PENGUJIAN HAK AKSES EVALUASI: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled error during test:', err);
    process.exit(1);
  } finally {
    // Bersihkan seluruh data uji evaluasi kinerja agar tidak mengotori database operasional
    try {
      const idsToClean = [admin1?.id, coordAcara?.id, memberAcara?.id].filter(Boolean);
      await supabase
        .from('performance_reviews')
        .delete()
        .eq('evidence_note', 'Uji integrasi hak akses evaluasi kinerja panitia');

      if (idsToClean.length > 0) {
        await supabase
          .from('final_evaluations')
          .update({
            coordinator_score: 0,
            system_score: 0,
            final_score: 0,
            evaluation_status: 'calculating',
            certificate_eligibility_status: 'pending',
          })
          .in('member_id', idsToClean);
      }
    } catch (cleanupErr) {
      console.warn('Peringatan saat membersihkan data uji:', cleanupErr.message);
    }
  }
}

run();
