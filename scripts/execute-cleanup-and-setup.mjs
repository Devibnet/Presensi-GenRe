import fs from 'fs';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

console.log('=== EKSEKUSI PEMBERSIHAN DATA LAMA & PENERAPAN STRUKTUR KEPANITIAAN GENRE 2026/2027 ===\n');

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

async function run() {
  const periodId = '00000000-0000-0000-0000-000000000001';

  // ---------------------------------------------------------------------------
  // 1. BERSIHKAN DATA TRANSAKSIONAL LAMA & RELASI MOCK
  // ---------------------------------------------------------------------------
  console.log('1. Membersihkan data transaksional lama kepanitiaan mock...');

  // Hapus data penugasan, presensi, review, dan sertifikat lama
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('clarification_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('certificates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('final_evaluations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('performance_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('performance_reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('attendances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('manual_attendance_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('attendance_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('task_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('assignment_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('activity_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('activity_fields').delete().neq('activity_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Lepaskan coordinator_id lama dari fields
  await supabase.from('fields').update({ coordinator_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('[OK] Data transaksional lama berhasil dibersihkan.');

  // ---------------------------------------------------------------------------
  // 2. HAPUS PROFIL & AKUN PANITIA MOCK LAMA (GENRE-001 s.d. GENRE-012)
  // ---------------------------------------------------------------------------
  console.log('\n2. Menghapus 12 profil & akun panitia mock lama...');
  const oldCodes = [
    'GENRE-001', 'GENRE-002', 'GENRE-003', 'GENRE-004', 'GENRE-005', 'GENRE-006',
    'GENRE-007', 'GENRE-008', 'GENRE-009', 'GENRE-010', 'GENRE-011', 'GENRE-012'
  ];

  const { data: oldProfiles } = await supabase
    .from('profiles')
    .select('id, member_code, email')
    .in('member_code', oldCodes);

  if (oldProfiles && oldProfiles.length > 0) {
    for (const op of oldProfiles) {
      await supabase.from('profiles').delete().eq('id', op.id);
      await supabase.auth.admin.deleteUser(op.id);
      console.log(` - Terhapus: ${op.member_code} (${op.email})`);
    }
  }
  console.log('[OK] Seluruh akun mock lama telah dihapus.');

  // ---------------------------------------------------------------------------
  // 3. PASTIKAN SELURUH DIVISI RESMI TERSEDIA
  // ---------------------------------------------------------------------------
  console.log('\n3. Menyiapkan master divisi kepanitiaan 2026/2027...');
  const fieldsData = [
    { period_id: periodId, field_code: 'PNJ', field_name: 'Penanggung Jawab', field_description: 'Pelindung dan Penanggung Jawab Kepanitiaan', field_status: 'active' },
    { period_id: periodId, field_code: 'KPT', field_name: 'Pimpinan Panitia', field_description: 'Ketua dan Wakil Ketua Panitia Pelaksana', field_status: 'active' },
    { period_id: periodId, field_code: 'SEK', field_name: 'Divisi Kesekretariatan', field_description: 'Sekretariat, Administrasi, dan Notulensi', field_status: 'active' },
    { period_id: periodId, field_code: 'BEN', field_name: 'Bendahara Panitia', field_description: 'Pengelolaan Anggaran dan Keuangan Panitia', field_status: 'active' },
    { period_id: periodId, field_code: 'ACR', field_name: 'Divisi Acara & Finalis', field_description: 'Konsep Acara, Rundown, Gladi, dan Pengisi Acara', field_status: 'active' },
    { period_id: periodId, field_code: 'HMS', field_name: 'Divisi Humas & Publikasi', field_description: 'Kesekretariatan, Hubungan Masyarakat, & Komunikasi', field_status: 'active' },
    { period_id: periodId, field_code: 'KON', field_name: 'Sie Konsumsi dan Rohani', field_description: 'Penyediaan Konsumsi dan Kegiatan Kerohanian', field_status: 'active' },
    { period_id: periodId, field_code: 'PER', field_name: 'Sie Perlengkapan, Tempat dan Keamanan', field_description: 'Logistik, Keamanan, Venue, dan Perlengkapan Acara', field_status: 'active' },
    { period_id: periodId, field_code: 'PUB', field_name: 'Sie Publikasi dan Dokumentasi', field_description: 'Dokumentasi, Fotografi, Videografi, dan Publikasi Media Sosial', field_status: 'active' },
    { period_id: periodId, field_code: 'DAN', field_name: 'Sie Penggalian Dana', field_description: 'Sponsorship, Donatur, dan Penggalian Dana Kegiatan', field_status: 'active' },
    { period_id: periodId, field_code: 'ILM', field_name: 'Sie Ilmiah dan Lomba', field_description: 'Penyusunan Materi Uji, Seleksi Ilmiah, dan Teknis Perlombaan', field_status: 'active' },
    { period_id: periodId, field_code: 'OFF', field_name: 'Sie Official Duta', field_description: 'Pendampingan, Pengawalan, dan Koordinasi Finalis Duta GenRe', field_status: 'active' }
  ];

  for (const f of fieldsData) {
    await supabase.from('fields').upsert(f, { onConflict: 'period_id,field_code' });
  }

  const { data: currentFields } = await supabase.from('fields').select('id, field_code, field_name');
  const fieldMap = new Map();
  currentFields.forEach(f => fieldMap.set(f.field_code.toUpperCase(), f.id));
  console.log(`[OK] Master divisi siap (Total: ${currentFields.length} divisi).`);

  // ---------------------------------------------------------------------------
  // 4. BACA BERKAS CSV & PENETAPAN ROLE BERDASARKAN JABATAN
  // ---------------------------------------------------------------------------
  console.log('\n4. Membaca CSV akun_panitia_genre_buleleng_2026.csv dan menerapkan role...');
  const csvRaw = fs.readFileSync('akun_panitia_genre_buleleng_2026.csv', 'utf8');
  const parsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  // Logika pembagian role resmi:
  // - Penanggung Jawab — Ida Bagus Angga Prabaswara: admin
  // - Ketua Panitia — Sukkun Siregar: admin
  // - Koordinator setiap sie: coordinator
  // - Sekretaris, bendahara, dan seluruh anggota sie: member
  function determineRole(email, position) {
    const e = (email || '').toLowerCase().trim();
    const pos = (position || '').toLowerCase().trim();

    if (e === 'angga@genrebuleleng.org' || pos === 'penanggung jawab') {
      return 'admin';
    }
    if (e === 'sukkun@genrebuleleng.org' || (pos.includes('ketua panitia') && !pos.includes('wakil'))) {
      return 'admin';
    }
    if (pos.startsWith('koordinator') || pos.includes('koordinator sie')) {
      return 'coordinator';
    }
    return 'member';
  }

  const summary = {
    total: rows.length,
    admins: 0,
    coordinators: 0,
    members: 0,
    created: 0,
    updated: 0
  };

  const coordinatorAssignments = []; // { field_code, coordinator_id, name }

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    const fullName = row.full_name.trim();
    const memberCode = row.member_code.trim().toUpperCase();
    const password = row.password.trim();
    const fieldCode = row.field_code.trim().toUpperCase();
    const position = row.organization_position.trim();
    const phone = row.phone_number?.trim() || null;

    const assignedRole = determineRole(email, position);
    if (assignedRole === 'admin') summary.admins++;
    else if (assignedRole === 'coordinator') summary.coordinators++;
    else summary.members++;

    const fieldId = fieldMap.get(fieldCode) || null;

    // Cek apakah akun Auth sudah ada
    const { data: userList } = await supabase.auth.admin.listUsers();
    let authUser = userList?.users?.find(u => u.email.toLowerCase() === email);

    if (!authUser) {
      // Buat akun baru di Auth
      const { data: createdAuth, error: aErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          member_code: memberCode,
          system_role: assignedRole,
          organization_position: position,
          must_change_password: true,
        }
      });
      if (aErr) {
        console.error(`Gagal membuat auth untuk ${email}:`, aErr.message);
        continue;
      }
      authUser = createdAuth.user;
      summary.created++;
    } else {
      // Pastikan password & metadata tersinkron
      await supabase.auth.admin.updateUserById(authUser.id, {
        password,
        user_metadata: {
          full_name: fullName,
          member_code: memberCode,
          system_role: assignedRole,
          organization_position: position,
          must_change_password: true,
        }
      });
      summary.updated++;
    }

    // Upsert profil dengan role yang tepat
    const { error: prErr } = await supabase.from('profiles').upsert({
      id: authUser.id,
      member_code: memberCode,
      full_name: fullName,
      email: email,
      phone_number: phone,
      field_id: fieldId,
      system_role: assignedRole,
      organization_position: position,
      account_status: 'active',
      joined_at: '2026-03-01',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (prErr) {
      console.error(`Gagal upsert profil ${memberCode}:`, prErr.message);
    }

    // Inisialisasi evaluasi nilai akhir untuk anggota
    try {
      await supabase.rpc('calculate_and_upsert_final_evaluation', {
        p_period_id: periodId,
        p_member_id: authUser.id
      });
    } catch {}

    // Kumpulkan penugasan koordinator ke bidang
    if (assignedRole === 'coordinator') {
      coordinatorAssignments.push({
        field_code: fieldCode,
        coordinator_id: authUser.id,
        name: fullName,
        position
      });
    }

    console.log(`[${assignedRole.toUpperCase().padEnd(11)}] ${memberCode} - ${fullName} (${position})`);
  }

  // ---------------------------------------------------------------------------
  // 5. HUBUNGKAN KOORDINATOR KE TABEL FIELDS (fields.coordinator_id)
  // ---------------------------------------------------------------------------
  console.log('\n5. Menghubungkan koordinator ke divisi masing-masing (fields.coordinator_id)...');
  for (const ca of coordinatorAssignments) {
    const { error: fUpErr } = await supabase
      .from('fields')
      .update({ coordinator_id: ca.coordinator_id })
      .eq('period_id', periodId)
      .eq('field_code', ca.field_code);

    if (fUpErr) {
      console.error(`Gagal menghubungkan koordinator ke divisi ${ca.field_code}:`, fUpErr.message);
    } else {
      console.log(`[TERHUBUNG] Divisi ${ca.field_code} dipimpin oleh ${ca.name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. CATAT AUDIT LOG
  // ---------------------------------------------------------------------------
  const { data: adminAngga } = await supabase.from('profiles').select('id').eq('email', 'angga@genrebuleleng.org').single();
  if (adminAngga) {
    await supabase.from('audit_logs').insert({
      actor_id: adminAngga.id,
      action_type: 'reorganize_committee_roles_2026',
      entity_type: 'profiles',
      entity_id: adminAngga.id,
      new_values: summary,
      reason: 'Penerapan susunan resmi kepanitiaan Pemilihan Duta GenRe Kabupaten Buleleng 2026/2027'
    });
  }

  console.log('\n======================================================');
  console.log('REKAPITULASI SUSUNAN KEPANITIAAN GENRE 2026/2027:');
  console.log(`Total Panitia   : ${summary.total} orang`);
  console.log(`Admin           : ${summary.admins} orang (Penanggung Jawab & Ketua Panitia)`);
  console.log(`Coordinator     : ${summary.coordinators} orang (Koordinator Sie)`);
  console.log(`Member          : ${summary.members} orang (Sekretaris, Bendahara, Anggota)`);
  console.log(`Akun Baru Dibuat: ${summary.created}`);
  console.log(`Akun Diperbarui : ${summary.updated}`);
  console.log('======================================================\n');
}

run();
