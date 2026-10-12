-- ==============================================================================
-- GENRE ATTENDANCE - SEED DATA UJI FIKTIF LENGKAP
-- File: supabase/seed.sql
-- Organisasi: Pemilihan Duta GenRe Kabupaten Buleleng
-- Zona Waktu: Asia/Makassar (WITA, UTC+8)
-- ==============================================================================

-- 0. Bersihkan Data Eksisting jika Menjalankan Ulang (Urutan Referential Integrity)
DELETE FROM audit_logs;
DELETE FROM notifications;
DELETE FROM clarification_requests;
DELETE FROM certificates;
DELETE FROM final_evaluations;
DELETE FROM performance_scores;
DELETE FROM performance_reviews;
DELETE FROM evaluation_criteria;
DELETE FROM evaluation_policies;
DELETE FROM manual_attendance_requests;
DELETE FROM attendances;
DELETE FROM attendance_sessions;
DELETE FROM task_assignments;
DELETE FROM tasks;
DELETE FROM assignment_history;
DELETE FROM activity_assignments;
DELETE FROM activity_fields;
DELETE FROM activities;
DELETE FROM profiles;
DELETE FROM fields;
DELETE FROM organization_periods;

-- ==============================================================================
-- 1. SEED: organization_periods
-- ==============================================================================
INSERT INTO organization_periods (
    id,
    period_name,
    period_code,
    start_date,
    end_date,
    period_status,
    certificate_threshold,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Pemilihan Duta GenRe Kabupaten Buleleng 2026/2027',
    'GENRE-BL-2026',
    '2026-03-01',
    '2026-07-31',
    'active',
    75.00,
    '2026-03-01 08:00:00+08',
    '2026-03-01 08:00:00+08'
);

-- ==============================================================================
-- 2. SEED: auth.users & profiles
-- Menggunakan UUID deterministik untuk panitia Pemilihan Duta GenRe Buleleng
-- ==============================================================================

-- Masukkan akun ke auth.users (Supabase Auth Mock)
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at) VALUES
('11111111-0000-0000-0000-000000000001', 'ketua.admin@genre-buleleng.org', '{"full_name":"Putu Gede Adnyana"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000002', 'sekretaris@genre-buleleng.org', '{"full_name":"Kadek Satria Wibawa"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000003', 'coord.acara@genre-buleleng.org', '{"full_name":"Kadek Dwi Lestari"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000004', 'coord.humas@genre-buleleng.org', '{"full_name":"Komang Agus Wiratama"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000005', 'coord.logistik@genre-buleleng.org', '{"full_name":"Ketut Budi Santosa"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000006', 'coord.konsumsi@genre-buleleng.org', '{"full_name":"Ni Luh Made Sintya"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000007', 'member.yoga@genre-buleleng.org', '{"full_name":"I Made Yoga Pratama"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000008', 'member.ayu@genre-buleleng.org', '{"full_name":"Ni Kadek Ayu Wardani"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000009', 'member.krisna@genre-buleleng.org', '{"full_name":"I Nyoman Gede Krisna"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000010', 'member.riko@genre-buleleng.org', '{"full_name":"I Gede Riko Gunawan"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000011', 'member.dian@genre-buleleng.org', '{"full_name":"Ni Wayan Dian Ekayanti"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08'),
('11111111-0000-0000-0000-000000000012', 'member.ari@genre-buleleng.org', '{"full_name":"I Ketut Ari Wibowo"}', '2026-03-01 08:00:00+08', '2026-03-01 08:00:00+08')
ON CONFLICT (id) DO NOTHING;

-- Masukkan Fields / Bidang Terlebih Dahulu
INSERT INTO fields (id, period_id, field_name, field_code, field_description, field_status) VALUES
('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Badan Pengurus Harian', 'BPH', 'Ketua, Sekretaris, dan Bendahara Panitia', 'active'),
('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Divisi Acara & Finalis', 'ACR', 'Konseptor rundown, seleksi, dan gladi', 'active'),
('22222222-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Divisi Humas & Publikasi', 'HMS', 'Publikasi media sosial, media partner, & sponsorship', 'active'),
('22222222-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Divisi Perlengkapan & Logistik', 'LOG', 'Venue, sound system, lighting, panggung', 'active'),
('22222222-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Divisi Konsumsi & Akomodasi', 'KNS', 'Penyediaan konsumsi panitia, juri, dan tamu undangan', 'active'),
('22222222-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Divisi Kesekretariatan', 'SEK', 'Surat-menyurat, presensi, sertifikat, dan administrasi', 'active');

-- Masukkan Profiles Anggota Panitia
INSERT INTO profiles (
    id, member_code, full_name, email, phone_number, field_id, 
    system_role, organization_position, account_status, joined_at
) VALUES
('11111111-0000-0000-0000-000000000001', 'GENRE-001', 'Putu Gede Adnyana', 'ketua.admin@genre-buleleng.org', '081234567801', '22222222-0000-0000-0000-000000000001', 'admin', 'Ketua Panitia', 'active', '2026-03-01'),
('11111111-0000-0000-0000-000000000002', 'GENRE-002', 'Kadek Satria Wibawa', 'sekretaris@genre-buleleng.org', '081234567802', '22222222-0000-0000-0000-000000000006', 'admin', 'Sekretaris Panitia', 'active', '2026-03-01'),
('11111111-0000-0000-0000-000000000003', 'GENRE-003', 'Kadek Dwi Lestari', 'coord.acara@genre-buleleng.org', '081234567803', '22222222-0000-0000-0000-000000000002', 'coordinator', 'Koordinator Divisi Acara', 'active', '2026-03-01'),
('11111111-0000-0000-0000-000000000004', 'GENRE-004', 'Komang Agus Wiratama', 'coord.humas@genre-buleleng.org', '081234567804', '22222222-0000-0000-0000-000000000003', 'coordinator', 'Koordinator Divisi Humas', 'active', '2026-03-01'),
('11111111-0000-0000-0000-000000000005', 'GENRE-005', 'Ketut Budi Santosa', 'coord.logistik@genre-buleleng.org', '081234567805', '22222222-0000-0000-0000-000000000004', 'coordinator', 'Koordinator Divisi Logistik', 'active', '2026-03-01'),
('11111111-0000-0000-0000-000000000006', 'GENRE-006', 'Ni Luh Made Sintya', 'coord.konsumsi@genre-buleleng.org', '081234567806', '22222222-0000-0000-0000-000000000005', 'coordinator', 'Koordinator Divisi Konsumsi', 'active', '2026-03-01'),
('11111111-0000-0000-0000-000000000007', 'GENRE-007', 'I Made Yoga Pratama', 'member.yoga@genre-buleleng.org', '081234567807', '22222222-0000-0000-0000-000000000002', 'member', 'Anggota Divisi Acara', 'active', '2026-03-02'),
('11111111-0000-0000-0000-000000000008', 'GENRE-008', 'Ni Kadek Ayu Wardani', 'member.ayu@genre-buleleng.org', '081234567808', '22222222-0000-0000-0000-000000000003', 'member', 'Anggota Divisi Humas', 'active', '2026-03-02'),
('11111111-0000-0000-0000-000000000009', 'GENRE-009', 'I Nyoman Gede Krisna', 'member.krisna@genre-buleleng.org', '081234567809', '22222222-0000-0000-0000-000000000003', 'member', 'Anggota Divisi Humas', 'active', '2026-03-02'),
('11111111-0000-0000-0000-000000000010', 'GENRE-010', 'I Gede Riko Gunawan', 'member.riko@genre-buleleng.org', '081234567810', '22222222-0000-0000-0000-000000000004', 'member', 'Anggota Divisi Logistik', 'active', '2026-03-02'),
('11111111-0000-0000-0000-000000000011', 'GENRE-011', 'Ni Wayan Dian Ekayanti', 'member.dian@genre-buleleng.org', '081234567811', '22222222-0000-0000-0000-000000000005', 'member', 'Anggota Divisi Konsumsi', 'active', '2026-03-02'),
('11111111-0000-0000-0000-000000000012', 'GENRE-012', 'I Ketut Ari Wibowo', 'member.ari@genre-buleleng.org', '081234567812', '22222222-0000-0000-0000-000000000002', 'member', 'Anggota Divisi Acara', 'inactive', '2026-03-02');

-- Hubungkan Koordinator Bidang ke fields
UPDATE fields SET coordinator_id = '11111111-0000-0000-0000-000000000001' WHERE id = '22222222-0000-0000-0000-000000000001';
UPDATE fields SET coordinator_id = '11111111-0000-0000-0000-000000000003' WHERE id = '22222222-0000-0000-0000-000000000002';
UPDATE fields SET coordinator_id = '11111111-0000-0000-0000-000000000004' WHERE id = '22222222-0000-0000-0000-000000000003';
UPDATE fields SET coordinator_id = '11111111-0000-0000-0000-000000000005' WHERE id = '22222222-0000-0000-0000-000000000004';
UPDATE fields SET coordinator_id = '11111111-0000-0000-0000-000000000006' WHERE id = '22222222-0000-0000-0000-000000000005';
UPDATE fields SET coordinator_id = '11111111-0000-0000-0000-000000000002' WHERE id = '22222222-0000-0000-0000-000000000006';

UPDATE organization_periods SET created_by = '11111111-0000-0000-0000-000000000001';


-- ==============================================================================
-- 3. SEED: evaluation_policies & evaluation_criteria
-- ==============================================================================
INSERT INTO evaluation_policies (
    id, period_id, policy_version, attendance_weight, punctuality_weight, 
    task_completion_weight, coordinator_evaluation_weight, certificate_threshold, 
    effective_from, policy_status, created_by
) VALUES (
    '33333333-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'v1.0',
    20.00,
    10.00,
    10.00,
    60.00,
    75.00,
    '2026-03-01',
    'active',
    '11111111-0000-0000-0000-000000000001'
);

INSERT INTO evaluation_criteria (
    id, policy_id, criterion_code, criterion_name, criterion_description, maximum_rating, weight_points, display_order
) VALUES
('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'COMMUNICATION', 'Komunikasi & Responsivitas', 'Kecepatan merespons koordinasi dan kejelasan komunikasi tim', 5.00, 15.00, 1),
('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 'RESPONSIBILITY', 'Tanggung Jawab & Komitmen', 'Konsistensi menjalankan tugas dan dedikasi pada jadwal', 5.00, 15.00, 2),
('44444444-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001', 'TEAMWORK', 'Kerja Sama Tim', 'Kemampuan bersinergi dan tolong-menolong antarrekan sebidang', 5.00, 10.00, 3),
('44444444-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000001', 'INITIATIVE', 'Inisiatif & Kontribusi', 'Proaktif memberi solusi dan ide tanpa harus selalu disuruh', 5.00, 10.00, 4),
('44444444-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000001', 'PROFESSIONALISM', 'Sikap & Profesionalisme', 'Etika berkomunikasi, kesopanan, dan kepatuhan norma organisasi', 5.00, 10.00, 5);


-- ==============================================================================
-- 4. SEED: activities & activity_fields
-- ==============================================================================
INSERT INTO activities (
    id, period_id, activity_code, activity_name, activity_description, activity_location,
    start_at, end_at, check_in_opens_at, check_in_closes_at, check_out_opens_at, check_out_closes_at,
    activity_status, attendance_required, created_by
) VALUES
(
    '55555555-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'ACT-PLENO-1',
    'Rapat Pleno 1 & Kick-Off Kepanitiaan',
    'Pemaparan program kerja, timeline, dan anggaran tiap divisi',
    'Ruang Rapat Dinas P2KBP3A Kab. Buleleng',
    '2026-03-10 14:00:00+08', '2026-03-10 17:00:00+08',
    '2026-03-10 13:30:00+08', '2026-03-10 14:15:00+08',
    '2026-03-10 16:50:00+08', '2026-03-10 17:30:00+08',
    'completed', true, '11111111-0000-0000-0000-000000000001'
),
(
    '55555555-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'ACT-WORKSHOP-1',
    'Workshop Pembekalan Finalis Duta GenRe Buleleng',
    'Pemberian materi public speaking & substansi GenRe kepada 20 besar finalis',
    'Gedung Sasana Budaya Singaraja',
    '2026-04-12 09:00:00+08', '2026-04-12 16:00:00+08',
    '2026-04-12 08:30:00+08', '2026-04-12 09:15:00+08',
    '2026-04-12 15:50:00+08', '2026-04-12 16:30:00+08',
    'completed', true, '11111111-0000-0000-0000-000000000003'
),
(
    '55555555-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'ACT-GLADI-FINAL',
    'Gladi Bersih Grand Final Duta GenRe',
    'Simulasi penuh tata panggung, lighting, dan parade finalis',
    'Gedung Kesenian Gde Manik Singaraja',
    '2026-05-15 13:00:00+08', '2026-05-15 21:00:00+08',
    '2026-05-15 12:30:00+08', '2026-05-15 13:15:00+08',
    '2026-05-15 20:50:00+08', '2026-05-15 21:30:00+08',
    'completed', true, '11111111-0000-0000-0000-000000000001'
),
(
    '55555555-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'ACT-GRAND-FINAL',
    'Malam Grand Final Pemilihan Duta GenRe Buleleng 2026',
    'Acara puncak penobatan Juara Duta GenRe Kabupaten Buleleng',
    'Gedung Kesenian Gde Manik Singaraja',
    '2026-05-16 17:00:00+08', '2026-05-16 23:00:00+08',
    '2026-05-16 16:00:00+08', '2026-05-16 17:15:00+08',
    '2026-05-16 22:50:00+08', '2026-05-16 23:45:00+08',
    'scheduled', true, '11111111-0000-0000-0000-000000000001'
);

-- activity_fields
INSERT INTO activity_fields (id, activity_id, field_id, notes) VALUES
('5a5a5a5a-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Seluruh divisi wajib hadir'),
('5a5a5a5a-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Divisi Acara sebagai PIC Utama'),
('5a5a5a5a-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', 'Humas publikasi liputan live story'),
('5a5a5a5a-0000-0000-0000-000000000004', '55555555-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', 'Acara memandu gladi'),
('5a5a5a5a-0000-0000-0000-000000000005', '55555555-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004', 'Logistik setting panggung dan sound'),
('5a5a5a5a-0000-0000-0000-000000000006', '55555555-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', 'Grand final melibatkan segenap panitia');


-- ==============================================================================
-- 5. SEED: activity_assignments
-- ==============================================================================
-- Anggota Yoga (Acara), Ayu (Humas), Riko (Logistik) ditugaskan pada kegiatan 1, 2, dan 3
INSERT INTO activity_assignments (
    id, activity_id, member_id, assignment_type, assignment_description, assignment_status, assigned_by
) VALUES
-- Rapat Pleno 1
('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000007', 'attendance_required', 'Hadir tepat waktu dan mencatat masukan rundown', 'active', '11111111-0000-0000-0000-000000000001'),
('66666666-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000008', 'attendance_required', 'Hadir tepat waktu dan dokumentasi pleno', 'active', '11111111-0000-0000-0000-000000000001'),
('66666666-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000010', 'attendance_required', 'Hadir tepat waktu dan cek kelengkapan proyektor', 'active', '11111111-0000-0000-0000-000000000001'),

-- Workshop 1
('66666666-0000-0000-0000-000000000004', '55555555-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000007', 'work_assignment', 'Time keeper materi pembekalan', 'active', '11111111-0000-0000-0000-000000000003'),
('66666666-0000-0000-0000-000000000005', '55555555-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000008', 'work_assignment', 'Operator kamera dan reels dokumentasi', 'active', '11111111-0000-0000-0000-000000000004'),

-- Gladi Bersih
('66666666-0000-0000-0000-000000000006', '55555555-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000007', 'work_assignment', 'Koordinator panggung dan mic finalis', 'active', '11111111-0000-0000-0000-000000000003'),
('66666666-0000-0000-0000-000000000007', '55555555-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000008', 'work_assignment', 'Live report story instagram', 'active', '11111111-0000-0000-0000-000000000004'),
('66666666-0000-0000-0000-000000000008', '55555555-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000010', 'work_assignment', 'Standby operator genset & tata lampu', 'active', '11111111-0000-0000-0000-000000000005');


-- ==============================================================================
-- 6. SEED: attendance_sessions & attendances
-- ==============================================================================
INSERT INTO attendance_sessions (
    id, activity_id, session_name, session_code, session_status, created_by
) VALUES
('77777777-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'Presensi Masuk Pleno 1', 'PLENO1-IN', 'closed', '11111111-0000-0000-0000-000000000001'),
('77777777-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002', 'Presensi Workshop Sesi Pagi', 'WORK1-IN', 'closed', '11111111-0000-0000-0000-000000000003'),
('77777777-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000003', 'Presensi Gladi Bersih', 'GLADI-IN', 'closed', '11111111-0000-0000-0000-000000000001');

-- Rekam Presensi Anggota Yoga (Hadir semua, tepat waktu)
INSERT INTO attendances (
    id, activity_assignment_id, attendance_session_id, check_in_at, check_out_at, 
    check_in_method, check_out_method, check_in_status, check_out_status, 
    verification_status, verified_by, verified_at, attendance_note
) VALUES
(
    '88888888-0000-0000-0000-000000000001',
    '66666666-0000-0000-0000-000000000001',
    '77777777-0000-0000-0000-000000000001',
    '2026-03-10 13:45:00+08', '2026-03-10 17:05:00+08',
    'qr', 'qr', 'on_time', 'normal', 'approved',
    '11111111-0000-0000-0000-000000000001', '2026-03-10 17:10:00+08', 'Hadir lengkap'
),
(
    '88888888-0000-0000-0000-000000000002',
    '66666666-0000-0000-0000-000000000004',
    '77777777-0000-0000-0000-000000000002',
    '2026-04-12 08:45:00+08', '2026-04-12 16:10:00+08',
    'qr', 'qr', 'on_time', 'normal', 'approved',
    '11111111-0000-0000-0000-000000000003', '2026-04-12 16:15:00+08', 'Tepat waktu di Sasana Budaya'
),
(
    '88888888-0000-0000-0000-000000000003',
    '66666666-0000-0000-0000-000000000006',
    '77777777-0000-0000-0000-000000000003',
    '2026-05-15 12:40:00+08', '2026-05-15 21:05:00+08',
    'qr', 'qr', 'on_time', 'normal', 'approved',
    '11111111-0000-0000-0000-000000000001', '2026-05-15 21:10:00+08', 'Gladi selesai dengan baik'
);

-- Presensi Anggota Ayu (Hadir Pleno on time, Hadir Workshop agak terlambat 09:20)
INSERT INTO attendances (
    id, activity_assignment_id, attendance_session_id, check_in_at, check_out_at, 
    check_in_method, check_out_method, check_in_status, check_out_status, 
    verification_status, verified_by, verified_at, attendance_note
) VALUES
(
    '88888888-0000-0000-0000-000000000004',
    '66666666-0000-0000-0000-000000000002',
    '77777777-0000-0000-0000-000000000001',
    '2026-03-10 13:55:00+08', '2026-03-10 17:00:00+08',
    'qr', 'qr', 'on_time', 'normal', 'approved',
    '11111111-0000-0000-0000-000000000001', '2026-03-10 17:10:00+08', 'Hadir'
),
(
    '88888888-0000-0000-0000-000000000005',
    '66666666-0000-0000-0000-000000000005',
    '77777777-0000-0000-0000-000000000002',
    '2026-04-12 09:22:00+08', '2026-04-12 16:05:00+08',
    'qr', 'qr', 'late', 'normal', 'approved',
    '11111111-0000-0000-0000-000000000004', '2026-04-12 16:15:00+08', 'Terlambat karena ambil spanduk dari percetakan'
);


-- ==============================================================================
-- 7. SEED: tasks & task_assignments
-- ==============================================================================
INSERT INTO tasks (
    id, period_id, activity_id, field_id, task_title, task_description, priority, task_status, due_at, created_by
) VALUES
(
    '99999999-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000002',
    'Penyusunan Lembar Penilaian Juri Workshop',
    'Mencetak dan menyiapkan form penilaian substansi modul GenRe untuk 3 dewan juri',
    'high', 'completed', '2026-04-11 18:00:00+08',
    '11111111-0000-0000-0000-000000000003'
),
(
    '99999999-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000003',
    'Desain Feed Instagram Profil 20 Finalis',
    'Membuat template carousel instagram profil finalis duta genre dengan format resmi',
    'medium', 'completed', '2026-04-10 23:59:00+08',
    '11111111-0000-0000-0000-000000000004'
),
(
    '99999999-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000003',
    '22222222-0000-0000-0000-000000000004',
    'Pengujian Akustik & Wireless Mic Panggung',
    'Memastikan 10 unit wireless mic berfungsi tanpa interferensi frekuensi di Gedung Gde Manik',
    'urgent', 'completed', '2026-05-14 17:00:00+08',
    '11111111-0000-0000-0000-000000000005'
);

-- task_assignments
INSERT INTO task_assignments (
    id, task_id, member_id, assigned_by, assignment_status, progress_note, submitted_at, verified_by, verified_at, verification_note
) VALUES
(
    'aaaaaaaa-0000-0000-0000-000000000001',
    '99999999-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000007',
    '11111111-0000-0000-0000-000000000003',
    'completed', 'Formulir selesai dicetak rangkap 3 dan map siap.',
    '2026-04-11 16:00:00+08', '11111111-0000-0000-0000-000000000003', '2026-04-11 17:00:00+08', 'Sesuai format resmi'
),
(
    'aaaaaaaa-0000-0000-0000-000000000002',
    '99999999-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000008',
    '11111111-0000-0000-0000-000000000004',
    'completed', 'File SVG & PNG telah di-upload ke drive dan di-publish ke IG @genre_buleleng.',
    '2026-04-10 21:00:00+08', '11111111-0000-0000-0000-000000000004', '2026-04-10 22:00:00+08', 'Desain rapi dan tepat waktu'
),
(
    'aaaaaaaa-0000-0000-0000-000000000003',
    '99999999-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000010',
    '11111111-0000-0000-0000-000000000005',
    'completed', '10 mic dites, baterai cadangan alkaline disiapkan di backstage.',
    '2026-05-14 16:30:00+08', '11111111-0000-0000-0000-000000000005', '2026-05-14 17:15:00+08', 'Bagus dan siap pakai'
);


-- ==============================================================================
-- 8. SEED: performance_reviews & performance_scores
-- Evaluasi oleh Koordinator Acara untuk I Made Yoga Pratama
-- ==============================================================================
INSERT INTO performance_reviews (
    id,
    period_id,
    member_id,
    reviewer_id,
    policy_id,
    review_status,
    communication_score,
    responsibility_score,
    teamwork_score,
    initiative_score,
    professionalism_score,
    total_weighted_score,
    evidence_note,
    submitted_at,
    reviewed_by_admin,
    reviewed_at,
    reviewer_feedback
) VALUES (
    'bbbbbbbb-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000007', -- Yoga
    '11111111-0000-0000-0000-000000000003', -- Kadek Dwi Lestari (Coord Acara)
    '33333333-0000-0000-0000-000000000001',
    'approved',
    4.80, -- Komunikasi (14.4 pts)
    5.00, -- Tanggung Jawab (15.0 pts)
    4.70, -- Kerja Sama Tim (9.4 pts)
    4.50, -- Inisiatif (9.0 pts)
    4.90, -- Profesionalisme (9.8 pts)
    57.60, -- Total Koordinator
    'Yoga sangat bertanggung jawab dalam pengelolaan panggung dan koordinasi rundown.',
    '2026-05-20 10:00:00+08',
    '11111111-0000-0000-0000-000000000001',
    '2026-05-21 14:00:00+08',
    'Pertahankan dedikasi luar biasa ini di kegiatan GenRe mendatang.'
);

-- Rincian Butir Skor Yoga
INSERT INTO performance_scores (
    id, performance_review_id, criterion_id, criterion_code, criterion_name, score, maximum_score, weight_points, weighted_points, evidence_note
) VALUES
('b1b1b1b1-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'COMMUNICATION', 'Komunikasi & Responsivitas', 4.80, 5.00, 15.00, 14.40, 'Cepat tanggap di grup koordinasi acara'),
('b1b1b1b1-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002', 'RESPONSIBILITY', 'Tanggung Jawab & Komitmen', 5.00, 5.00, 15.00, 15.00, 'Selalu datang sebelum acara dimulai'),
('b1b1b1b1-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000003', 'TEAMWORK', 'Kerja Sama Tim', 4.70, 5.00, 10.00, 9.40, 'Membantu divisi logistik saat setting gladi'),
('b1b1b1b1-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000004', 'INITIATIVE', 'Inisiatif & Kontribusi', 4.50, 5.00, 10.00, 9.00, 'Mengusulkan skenario cadangan saat gladi panggung'),
('b1b1b1b1-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000005', 'PROFESSIONALISM', 'Sikap & Profesionalisme', 4.90, 5.00, 10.00, 9.80, 'Sopan santun dan berpenampilan rapi');


-- ==============================================================================
-- 9. SEED: final_evaluations & certificates
-- ==============================================================================
-- Nilai Yoga:
-- Attendance 3/3 = 20.00 pts
-- Punctuality 3/3 = 10.00 pts
-- Task completion 1/1 = 10.00 pts
-- System score = 40.00 pts
-- Coordinator score = 57.60 pts
-- Final score = 97.60 pts (Layak Sertifikat, ambang batas 75)
INSERT INTO final_evaluations (
    id,
    period_id,
    member_id,
    policy_id,
    attendance_points,
    punctuality_points,
    task_completion_points,
    system_score,
    coordinator_score,
    final_score,
    evaluation_status,
    certificate_eligibility_status,
    calculated_at,
    approved_by,
    approved_at,
    approval_note
) VALUES (
    'cccccccc-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000007', -- Yoga
    '33333333-0000-0000-0000-000000000001',
    20.00,
    10.00,
    10.00,
    40.00,
    57.60,
    97.60,
    'approved',
    'eligible',
    '2026-05-22 09:00:00+08',
    '11111111-0000-0000-0000-000000000001',
    '2026-05-22 10:30:00+08',
    'Disahkan oleh Ketua Panitia dengan predikat Sangat Memuaskan'
);

-- Terbitkan Sertifikat Resmi untuk Yoga
INSERT INTO certificates (
    id,
    final_evaluation_id,
    certificate_number,
    certificate_status,
    issued_at,
    issued_by,
    file_path
) VALUES (
    'dddddddd-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000001',
    '018/GENRE-BL/SERT/PANITIA/V/2026',
    'issued',
    '2026-05-23 09:00:00+08',
    '11111111-0000-0000-0000-000000000001',
    'certificates/2026/018-GENRE-BL-SERT-YOGA.pdf'
);


-- ==============================================================================
-- 10. SEED: clarification_requests (Contoh Sanggahan Presensi oleh Anggota Ayu)
-- ==============================================================================
INSERT INTO clarification_requests (
    id,
    period_id,
    member_id,
    related_activity_id,
    related_attendance_id,
    request_type,
    request_description,
    request_status,
    assigned_reviewer_id,
    resolution_note,
    resolved_by,
    resolved_at
) VALUES (
    'eeeeeeee-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000008', -- Ayu
    '55555555-0000-0000-0000-000000000002', -- Workshop 1
    '88888888-0000-0000-0000-000000000005', -- Presensi terlambat
    'attendance_dispute',
    'Keterlambatan pada Workshop 1 disebabkan oleh penugasan mendadak dari Koordinator Humas untuk mengambil spanduk backdrop di percetakan sebelum acara dimulai.',
    'resolved',
    '11111111-0000-0000-0000-000000000004', -- Agus Wiratama
    'Klarifikasi diverifikasi benar. Dispensasi penugasan disetujui.',
    '11111111-0000-0000-0000-000000000004',
    '2026-04-14 11:00:00+08'
);


-- ==============================================================================
-- 11. SEED: notifications & audit_logs
-- ==============================================================================
INSERT INTO notifications (
    id, user_id, title, message, notification_type, action_url, is_read
) VALUES
('ffffffff-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000007', 'Sertifikat Kelulusan Panitia Telah Terbit', 'Selamat! Sertifikat resmi kepanitiaan Pemilihan Duta GenRe 2026 Anda telah disahkan.', 'certificate', '/certificates', false),
('ffffffff-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000008', 'Tanggapan Klarifikasi Presensi', 'Permohonan klarifikasi presensi Workshop 1 Anda telah disetujui oleh Koordinator.', 'clarification', '/clarifications', true);

INSERT INTO audit_logs (
    actor_id, action_type, entity_type, entity_id, old_values, new_values, reason
) VALUES
('11111111-0000-0000-0000-000000000001', 'CERTIFICATE_ISSUED', 'certificates', 'dddddddd-0000-0000-0000-000000000001', NULL, '{"certificate_number": "018/GENRE-BL/SERT/PANITIA/V/2026", "recipient": "I Made Yoga Pratama"}'::jsonb, 'Penerbitan sertifikat kepanitiaan nilai 97.60');
