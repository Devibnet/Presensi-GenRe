import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Environment variable NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus terisi di .env.local');
  process.exit(1);
}

console.log('--- SEEDING SUPABASE CLOUD DATABASE ---');
console.log('Target URL:', url);

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  try {
    // 1. Period
    console.log('1. Menyiapkan Organization Period...');
    const periodId = '00000000-0000-0000-0000-000000000001';
    const { error: pErr } = await supabase.from('organization_periods').upsert({
      id: periodId,
      period_name: 'Pemilihan Duta GenRe Kabupaten Buleleng 2026/2027',
      period_code: 'GENRE-BL-2026',
      start_date: '2026-03-01',
      end_date: '2026-07-31',
      period_status: 'active',
      certificate_threshold: 75.00,
    });
    if (pErr) console.warn('Period warning:', pErr.message);

    // 2. Fields
    console.log('2. Menyiapkan Fields / Divisi Kepanitiaan...');
    const fieldsData = [
      { id: '22222222-0000-0000-0000-000000000001', period_id: periodId, field_name: 'Badan Pengurus Harian', field_code: 'BPH', field_status: 'active' },
      { id: '22222222-0000-0000-0000-000000000002', period_id: periodId, field_name: 'Divisi Acara & Finalis', field_code: 'ACR', field_status: 'active' },
      { id: '22222222-0000-0000-0000-000000000003', period_id: periodId, field_name: 'Divisi Humas & Publikasi', field_code: 'HMS', field_status: 'active' },
      { id: '22222222-0000-0000-0000-000000000004', period_id: periodId, field_name: 'Divisi Perlengkapan & Logistik', field_code: 'LOG', field_status: 'active' },
      { id: '22222222-0000-0000-0000-000000000005', period_id: periodId, field_name: 'Divisi Konsumsi & Akomodasi', field_code: 'KNS', field_status: 'active' },
      { id: '22222222-0000-0000-0000-000000000006', period_id: periodId, field_name: 'Divisi Kesekretariatan', field_code: 'SEK', field_status: 'active' },
    ];
    for (const f of fieldsData) {
      await supabase.from('fields').upsert(f);
    }

    // 3. Evaluation Policy
    console.log('3. Menyiapkan Evaluation Policy...');
    const policyId = '44444444-0000-0000-0000-000000000001';
    // Dummy created_by for policy (akan diupdate setelah user dibuat)
    const { error: polErr } = await supabase.from('evaluation_policies').upsert({
      id: policyId,
      period_id: periodId,
      policy_version: 'v1.0',
      attendance_weight: 20.00,
      punctuality_weight: 10.00,
      task_completion_weight: 10.00,
      coordinator_evaluation_weight: 60.00,
      certificate_threshold: 75.00,
      effective_from: '2026-03-01',
      policy_status: 'active',
    });
    if (polErr) console.warn('Policy warning:', polErr.message);

    // 4. Evaluation Criteria (5 Rubrik)
    const criteriaData = [
      { policy_id: policyId, criterion_code: 'COMM', criterion_name: 'Komunikasi Efektif', criterion_description: 'Kelancaran koordinasi dan kejelasan komunikasi', weight_points: 15.00, display_order: 1 },
      { policy_id: policyId, criterion_code: 'RESP', criterion_name: 'Tanggung Jawab & Disiplin', criterion_description: 'Komitmen waktu dan penuntasan amanah jobdesk', weight_points: 15.00, display_order: 2 },
      { policy_id: policyId, criterion_code: 'TEAM', criterion_name: 'Kerjasama Tim & Solidaritas', criterion_description: 'Kemampuan bersinergi lintas seksi dan proaktif membantu', weight_points: 10.00, display_order: 3 },
      { policy_id: policyId, criterion_code: 'INIT', criterion_name: 'Inisiatif & Problem Solving', criterion_description: 'Responsif memberi alternatif solusi saat kendala lapangan', weight_points: 10.00, display_order: 4 },
      { policy_id: policyId, criterion_code: 'PROF', criterion_name: 'Profesionalisme & Sikap Budaya GenRe', criterion_description: 'Etika, kesantunan, dan menjunjung nilai luhur organisasi', weight_points: 10.00, display_order: 5 },
    ];
    for (const c of criteriaData) {
      await supabase.from('evaluation_criteria').upsert(c, { onConflict: 'policy_id,criterion_code' });
    }

    // 5. Auth Users & Profiles
    console.log('5. Membuat Akun Auth & Profil Panitia...');
    const usersToSeed = [
      {
        email: 'ketua.admin@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Putu Gede Adnyana',
        memberCode: 'GENRE-001',
        role: 'admin',
        position: 'Ketua Panitia',
        fieldId: '22222222-0000-0000-0000-000000000001',
        phone: '081234567801'
      },
      {
        email: 'sekretaris@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Kadek Satria Wibawa',
        memberCode: 'GENRE-002',
        role: 'admin',
        position: 'Sekretaris Panitia',
        fieldId: '22222222-0000-0000-0000-000000000006',
        phone: '081234567802'
      },
      {
        email: 'coord.acara@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Kadek Dwi Lestari',
        memberCode: 'GENRE-003',
        role: 'coordinator',
        position: 'Koordinator Divisi Acara',
        fieldId: '22222222-0000-0000-0000-000000000002',
        phone: '081234567803'
      },
      {
        email: 'coord.humas@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Komang Agus Wiratama',
        memberCode: 'GENRE-004',
        role: 'coordinator',
        position: 'Koordinator Divisi Humas',
        fieldId: '22222222-0000-0000-0000-000000000003',
        phone: '081234567804'
      },
      {
        email: 'coord.logistik@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Ketut Budi Santosa',
        memberCode: 'GENRE-005',
        role: 'coordinator',
        position: 'Koordinator Divisi Logistik',
        fieldId: '22222222-0000-0000-0000-000000000004',
        phone: '081234567805'
      },
      {
        email: 'coord.konsumsi@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Ni Luh Made Sintya',
        memberCode: 'GENRE-006',
        role: 'coordinator',
        position: 'Koordinator Divisi Konsumsi',
        fieldId: '22222222-0000-0000-0000-000000000005',
        phone: '081234567806'
      },
      {
        email: 'member.yoga@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'I Made Yoga Pratama',
        memberCode: 'GENRE-007',
        role: 'member',
        position: 'Anggota Divisi Acara',
        fieldId: '22222222-0000-0000-0000-000000000002',
        phone: '081234567807'
      },
      {
        email: 'member.ayu@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Ni Kadek Ayu Wardani',
        memberCode: 'GENRE-008',
        role: 'member',
        position: 'Anggota Divisi Humas',
        fieldId: '22222222-0000-0000-0000-000000000003',
        phone: '081234567808'
      },
      {
        email: 'member.krisna@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'I Nyoman Gede Krisna',
        memberCode: 'GENRE-009',
        role: 'member',
        position: 'Anggota Divisi Humas',
        fieldId: '22222222-0000-0000-0000-000000000003',
        phone: '081234567809'
      },
      {
        email: 'member.riko@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'I Gede Riko Gunawan',
        memberCode: 'GENRE-010',
        role: 'member',
        position: 'Anggota Divisi Logistik',
        fieldId: '22222222-0000-0000-0000-000000000004',
        phone: '081234567810'
      },
      {
        email: 'member.dian@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'Ni Wayan Dian Ekayanti',
        memberCode: 'GENRE-011',
        role: 'member',
        position: 'Anggota Divisi Konsumsi',
        fieldId: '22222222-0000-0000-0000-000000000005',
        phone: '081234567811'
      },
      {
        email: 'member.ari@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        fullName: 'I Ketut Ari Wibowo',
        memberCode: 'GENRE-012',
        role: 'member',
        position: 'Anggota Divisi Kesekretariatan',
        fieldId: '22222222-0000-0000-0000-000000000006',
        phone: '081234567812'
      },
    ];

    const createdUsers = [];

    for (const u of usersToSeed) {
      // 1. Cek atau Buat di Auth
      let userId = null;
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });

      if (createData?.user) {
        userId = createData.user.id;
        console.log(`✓ Akun auth dibuat: ${u.email} (ID: ${userId})`);
      } else if (createErr?.message?.includes('already been registered')) {
        // Jika sudah ada, cari ID user eksisting dan update passwordnya
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users?.find(usr => usr.email === u.email);
        if (existing) {
          userId = existing.id;
          await supabase.auth.admin.updateUserById(userId, {
            password: u.password,
            email_confirm: true,
          });
          console.log(`✓ Akun auth diperbarui: ${u.email} (ID: ${userId})`);
        }
      } else {
        console.error(`Gagal membuat auth ${u.email}:`, createErr?.message);
      }

      if (userId) {
        // 2. Simpan ke tabel profiles
        const { error: profErr } = await supabase.from('profiles').upsert({
          id: userId,
          member_code: u.memberCode,
          full_name: u.fullName,
          email: u.email,
          phone_number: u.phone,
          field_id: u.fieldId,
          system_role: u.role,
          organization_position: u.position,
          account_status: 'active',
          joined_at: '2026-03-01',
        });

        if (profErr) {
          console.error(`Gagal upsert profile ${u.email}:`, profErr.message);
        } else {
          createdUsers.push({ ...u, id: userId });
        }
      }
    }

    // Update coordinator_id pada tabel fields
    const coordAcara = createdUsers.find(u => u.email === 'coord.acara@genre-buleleng.org');
    if (coordAcara) {
      await supabase.from('fields').update({ coordinator_id: coordAcara.id }).eq('field_code', 'ACR');
    }
    const coordHumas = createdUsers.find(u => u.email === 'coord.humas@genre-buleleng.org');
    if (coordHumas) {
      await supabase.from('fields').update({ coordinator_id: coordHumas.id }).eq('field_code', 'HMS');
    }
    const coordLog = createdUsers.find(u => u.email === 'coord.logistik@genre-buleleng.org');
    if (coordLog) {
      await supabase.from('fields').update({ coordinator_id: coordLog.id }).eq('field_code', 'LOG');
    }

    // 6. Activities
    console.log('6. Menyiapkan Kegiatan / Agenda...');
    const adminUser = createdUsers.find(u => u.role === 'admin') || createdUsers[0];
    const activitiesData = [
      {
        id: '33333333-0000-0000-0000-000000000001',
        period_id: periodId,
        activity_code: 'ACT-001',
        activity_name: 'Rapat Perdana & Pembentukan Seksi Panitia',
        activity_location: 'Aula Bappeda Kab. Buleleng',
        start_at: '2026-03-10 09:00:00+08',
        end_at: '2026-03-10 13:00:00+08',
        check_in_opens_at: '2026-03-10 08:30:00+08',
        check_in_closes_at: '2026-03-10 09:30:00+08',
        check_out_opens_at: '2026-03-10 12:30:00+08',
        check_out_closes_at: '2026-03-10 13:30:00+08',
        activity_status: 'completed',
        attendance_required: true,
        created_by: adminUser.id,
      },
      {
        id: '33333333-0000-0000-0000-000000000002',
        period_id: periodId,
        activity_code: 'ACT-002',
        activity_name: 'Workshop Public Speaking & Grooming Finalis',
        activity_location: 'Hotel Aneka Lovina Buleleng',
        start_at: '2026-03-24 08:00:00+08',
        end_at: '2026-03-24 16:00:00+08',
        check_in_opens_at: '2026-03-24 07:30:00+08',
        check_in_closes_at: '2026-03-24 08:30:00+08',
        check_out_opens_at: '2026-03-24 15:30:00+08',
        check_out_closes_at: '2026-03-24 16:30:00+08',
        activity_status: 'completed',
        attendance_required: true,
        created_by: adminUser.id,
      },
      {
        id: '33333333-0000-0000-0000-000000000003',
        period_id: periodId,
        activity_code: 'ACT-003',
        activity_name: 'Gladi Bersih & Tata Panggung Grand Final',
        activity_location: 'Gedung Kesenian Gde Manik Singaraja',
        start_at: '2026-04-10 13:00:00+08',
        end_at: '2026-04-10 21:00:00+08',
        check_in_opens_at: '2026-04-10 12:30:00+08',
        check_in_closes_at: '2026-04-10 13:30:00+08',
        check_out_opens_at: '2026-04-10 20:30:00+08',
        check_out_closes_at: '2026-04-10 21:30:00+08',
        activity_status: 'ongoing',
        attendance_required: true,
        created_by: adminUser.id,
      },
      {
        id: '33333333-0000-0000-0000-000000000004',
        period_id: periodId,
        activity_code: 'ACT-004',
        activity_name: 'Malam Grand Final Pemilihan Duta GenRe Buleleng 2026',
        activity_location: 'Gedung Kesenian Gde Manik Singaraja',
        start_at: '2026-04-11 17:00:00+08',
        end_at: '2026-04-11 23:00:00+08',
        check_in_opens_at: '2026-04-11 16:00:00+08',
        check_in_closes_at: '2026-04-11 17:30:00+08',
        check_out_opens_at: '2026-04-11 22:30:00+08',
        check_out_closes_at: '2026-04-11 23:59:00+08',
        activity_status: 'scheduled',
        attendance_required: true,
        created_by: adminUser.id,
      },
    ];

    for (const a of activitiesData) {
      await supabase.from('activities').upsert(a);
    }

    // 7. Activity Assignments & Attendances
    console.log('7. Menugaskan Panitia ke Kegiatan & Mencatat Presensi...');
    for (const a of activitiesData) {
      for (const u of createdUsers) {
        const asgId = `${a.id.slice(0, 24)}${u.id.slice(24)}`;
        const { error: asgErr } = await supabase.from('activity_assignments').upsert({
          id: asgId,
          activity_id: a.id,
          member_id: u.id,
          assignment_type: 'attendance_required',
          assignment_status: 'active',
          assigned_by: adminUser.id,
        });

        if (!asgErr && a.activity_status === 'completed') {
          // Buat kehadiran
          await supabase.from('attendances').upsert({
            activity_assignment_id: asgId,
            check_in_at: a.start_at,
            check_out_at: a.end_at,
            check_in_method: 'qr',
            check_out_method: 'qr',
            check_in_status: 'on_time',
            check_out_status: 'normal',
            verification_status: 'approved',
            verified_by: adminUser.id,
          }, { onConflict: 'activity_assignment_id,attendance_session_id' });
        }
      }
    }

    // 8. Tasks
    console.log('8. Menyiapkan Tugas Operasional...');
    const sampleTasks = [
      {
        period_id: periodId,
        field_id: '22222222-0000-0000-0000-000000000002',
        task_title: 'Penyusunan Rundown & Script MC Malam Grand Final',
        task_description: 'Finalisasi rundown teknis bersama dewan juri dan pembawa acara',
        priority: 'high',
        task_status: 'completed',
        due_at: '2026-04-09 18:00:00+08',
        created_by: adminUser.id,
      },
      {
        period_id: periodId,
        field_id: '22222222-0000-0000-0000-000000000004',
        task_title: 'Persiapan Sound System 10.000 Watt & Lighting Panggung',
        task_description: 'Koordinasi loading vendor perlengkapan di Gedung Kesenian Gde Manik',
        priority: 'urgent',
        task_status: 'in_progress',
        due_at: '2026-04-10 12:00:00+08',
        created_by: adminUser.id,
      },
      {
        period_id: periodId,
        field_id: '22222222-0000-0000-0000-000000000003',
        task_title: 'Publikasi Feed IG & Press Release Media Partner',
        task_description: 'Unggah poster 10 pasang finalis Duta GenRe Buleleng 2026',
        priority: 'medium',
        task_status: 'completed',
        due_at: '2026-04-05 20:00:00+08',
        created_by: adminUser.id,
      },
    ];

    for (const t of sampleTasks) {
      await supabase.from('tasks').insert(t);
    }

    console.log('--- SEEDING DATABASE SELESAI DENGAN SUKSES! ---');
  } catch (err) {
    console.error('Error saat seeding:', err);
  }
}

seed();
