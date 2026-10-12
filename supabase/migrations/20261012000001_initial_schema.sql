-- ==============================================================================
-- GENRE ATTENDANCE - SUPABASE POSTGRESQL SCHEMA
-- Migration: 20261012000001_initial_schema.sql
-- Description: Core tables, columns, data types, and integrity constraints
-- Organization: Pemilihan Duta GenRe Kabupaten Buleleng
-- Timezone Standard: Asia/Makassar (WITA, UTC+8)
-- ==============================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE: organization_periods
-- Tujuan: Menyimpan periode kepanitiaan / organisasi
-- ==============================================================================
CREATE TABLE organization_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name VARCHAR(150) NOT NULL,
    period_code VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    period_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (period_status IN ('draft', 'active', 'completed', 'archived')),
    certificate_threshold NUMERIC(5,2) NOT NULL DEFAULT 75.00
        CHECK (certificate_threshold >= 0 AND certificate_threshold <= 100),
    created_by UUID NULL, -- FK ke profiles(id) ditambahkan setelah tabel profiles dibuat
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_period_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE organization_periods IS 'Menyimpan siklus periode kepanitiaan Pemilihan Duta GenRe Buleleng';
COMMENT ON COLUMN organization_periods.certificate_threshold IS 'Ambang batas nilai kelayakan sertifikat kelulusan panitia (skala 0-100)';

-- ==============================================================================
-- 3. TABLE: fields
-- Tujuan: Menyimpan divisi / seksi / bidang dalam struktur kepanitiaan
-- ==============================================================================
CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES organization_periods(id) ON DELETE RESTRICT,
    field_name VARCHAR(100) NOT NULL,
    field_code VARCHAR(30) NOT NULL,
    field_description TEXT NULL,
    coordinator_id UUID NULL, -- FK ke profiles(id) ditambahkan setelah tabel profiles dibuat
    field_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (field_status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_period_field_code UNIQUE (period_id, field_code)
);

COMMENT ON TABLE fields IS 'Bidang / divisi kepanitiaan seperti Acara, Humas, Logistik, dll.';

-- ==============================================================================
-- 4. TABLE: profiles
-- Tujuan: Menyimpan data panitia yang berelasi 1-to-1 dengan auth.users
-- ==============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    member_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(30) NULL,
    field_id UUID NULL REFERENCES fields(id) ON DELETE SET NULL,
    system_role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (system_role IN ('admin', 'coordinator', 'member')),
    organization_position VARCHAR(100) NOT NULL DEFAULT 'Anggota',
    account_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'inactive', 'suspended')),
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    avatar_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE profiles IS 'Profil anggota kepanitiaan yang terikat dengan Supabase Auth';
COMMENT ON COLUMN profiles.system_role IS 'Peran sistem (admin, coordinator, member) untuk kontrol otorisasi RLS';
COMMENT ON COLUMN profiles.organization_position IS 'Jabatan organisasi (misal Ketua Panitia, Koordinator Sie Acara)';

-- Tautkan Foreign Key yang tertunda (menghindari circular deadlock saat DDL)
ALTER TABLE organization_periods 
    ADD CONSTRAINT fk_periods_created_by FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE fields 
    ADD CONSTRAINT fk_fields_coordinator FOREIGN KEY (coordinator_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ==============================================================================
-- 5. TABLE: activities
-- Tujuan: Menyimpan kegiatan resmi kepanitiaan (rapat, gladi, workshop, malam final)
-- ==============================================================================
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES organization_periods(id) ON DELETE RESTRICT,
    activity_code VARCHAR(50) NOT NULL,
    activity_name VARCHAR(255) NOT NULL,
    activity_description TEXT NULL,
    activity_location VARCHAR(255) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    check_in_opens_at TIMESTAMPTZ NOT NULL,
    check_in_closes_at TIMESTAMPTZ NOT NULL,
    check_out_opens_at TIMESTAMPTZ NOT NULL,
    check_out_closes_at TIMESTAMPTZ NOT NULL,
    activity_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (activity_status IN ('draft', 'scheduled', 'ongoing', 'completed', 'cancelled')),
    attendance_required BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_period_activity_code UNIQUE (period_id, activity_code),
    CONSTRAINT chk_activity_times CHECK (end_at > start_at),
    CONSTRAINT chk_checkin_window CHECK (check_in_closes_at >= check_in_opens_at),
    CONSTRAINT chk_checkout_window CHECK (check_out_closes_at >= check_out_opens_at),
    CONSTRAINT chk_checkout_after_checkin CHECK (check_out_opens_at >= check_in_opens_at)
);

COMMENT ON TABLE activities IS 'Daftar kegiatan kepanitiaan yang memiliki jadwal dan jendela presensi';

-- ==============================================================================
-- 6. TABLE: activity_fields (Supporting Table: Many-to-Many Kegiatan ke Bidang)
-- ==============================================================================
CREATE TABLE activity_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES fields(id) ON DELETE RESTRICT,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_activity_field UNIQUE (activity_id, field_id)
);

COMMENT ON TABLE activity_fields IS 'Menghubungkan kegiatan dengan satu atau lebih bidang penanggung jawab';

-- ==============================================================================
-- 7. TABLE: activity_assignments
-- Tujuan: Mencatat penugasan resmi panitia pada kegiatan tertentu
-- ==============================================================================
CREATE TABLE activity_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assignment_type VARCHAR(30) NOT NULL DEFAULT 'attendance_required'
        CHECK (assignment_type IN ('attendance_required', 'work_assignment', 'coordinator_duty', 'committee_support')),
    assignment_description TEXT NULL,
    assignment_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (assignment_status IN ('active', 'cancelled', 'completed', 'excused')),
    assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    cancelled_at TIMESTAMPTZ NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_activity_member_assignment UNIQUE (activity_id, member_id)
);

COMMENT ON TABLE activity_assignments IS 'Surat tugas/penugasan anggota pada suatu kegiatan sebagai dasar presensi sah';

-- ==============================================================================
-- 8. TABLE: assignment_history (Supporting Table: Riwayat Perubahan Penugasan)
-- ==============================================================================
CREATE TABLE assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_assignment_id UUID NOT NULL REFERENCES activity_assignments(id) ON DELETE CASCADE,
    previous_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    action_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    change_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE assignment_history IS 'Log audit perubahan status penugasan kegiatan';

-- ==============================================================================
-- 9. TABLE: tasks
-- Tujuan: Definisi tugas kepanitiaan (terpisah dari penugasan individu)
-- ==============================================================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES organization_periods(id) ON DELETE RESTRICT,
    activity_id UUID NULL REFERENCES activities(id) ON DELETE SET NULL,
    field_id UUID NULL REFERENCES fields(id) ON DELETE SET NULL,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    task_status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (task_status IN ('open', 'in_progress', 'pending_review', 'completed', 'cancelled')),
    due_at TIMESTAMPTZ NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE tasks IS 'Master tugas operasional kepanitiaan per bidang atau per kegiatan';

-- ==============================================================================
-- 10. TABLE: task_assignments
-- Tujuan: Menghubungkan tugas dengan anggota yang bertanggung jawab
-- ==============================================================================
CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    assignment_status VARCHAR(20) NOT NULL DEFAULT 'assigned'
        CHECK (assignment_status IN ('assigned', 'in_progress', 'submitted', 'completed', 'rejected', 'cancelled')),
    progress_note TEXT NULL,
    submitted_at TIMESTAMPTZ NULL,
    verified_by UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NULL,
    verification_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_task_member UNIQUE (task_id, member_id)
);

COMMENT ON TABLE task_assignments IS 'Penetapan penanggung jawab tugas dan verifikasi hasil pengerjaan';

-- ==============================================================================
-- 11. TABLE: attendance_sessions
-- Tujuan: Mengelola sesi presensi dinamis (misal Sesi Rapat Pagi / Gladi Resik)
-- ==============================================================================
CREATE TABLE attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    session_name VARCHAR(100) NOT NULL,
    session_code VARCHAR(50) NOT NULL,
    session_status VARCHAR(20) NOT NULL DEFAULT 'closed'
        CHECK (session_status IN ('scheduled', 'open', 'closed', 'cancelled')),
    token_hash VARCHAR(128) NULL, -- Hash token dinamis (HMAC-SHA256) bukan plain secret
    token_expires_at TIMESTAMPTZ NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_activity_session_code UNIQUE (activity_id, session_code)
);

COMMENT ON TABLE attendance_sessions IS 'Sesi presensi berbatas waktu untuk validasi QR dinamis';

-- ==============================================================================
-- 12. TABLE: attendances
-- Tujuan: Catatan presensi sah anggota berdasarkan penugasan kegiatan
-- ==============================================================================
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_assignment_id UUID NOT NULL REFERENCES activity_assignments(id) ON DELETE RESTRICT,
    attendance_session_id UUID NULL REFERENCES attendance_sessions(id) ON DELETE SET NULL,
    check_in_at TIMESTAMPTZ NULL,
    check_out_at TIMESTAMPTZ NULL,
    check_in_method VARCHAR(20) NOT NULL DEFAULT 'qr'
        CHECK (check_in_method IN ('qr', 'manual', 'system')),
    check_out_method VARCHAR(20) NULL
        CHECK (check_out_method IN ('qr', 'manual', 'system')),
    check_in_status VARCHAR(30) NOT NULL DEFAULT 'pending_verification'
        CHECK (check_in_status IN ('on_time', 'late', 'absent', 'excused', 'pending_verification')),
    check_out_status VARCHAR(30) NULL
        CHECK (check_out_status IN ('normal', 'early_departure', 'pending_verification')),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    verified_by UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NULL,
    attendance_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_assignment_session UNIQUE (activity_assignment_id, attendance_session_id),
    CONSTRAINT chk_attendance_times CHECK (
        check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at
    )
);

COMMENT ON TABLE attendances IS 'Pencatatan check-in dan check-out presensi panitia';

-- ==============================================================================
-- 13. TABLE: manual_attendance_requests
-- Tujuan: Pengajuan presensi manual dengan verifikasi berjenjang
-- ==============================================================================
CREATE TABLE manual_attendance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_assignment_id UUID NOT NULL REFERENCES activity_assignments(id) ON DELETE RESTRICT,
    attendance_id UUID NULL REFERENCES attendances(id) ON DELETE SET NULL,
    attendance_type VARCHAR(20) NOT NULL
        CHECK (attendance_type IN ('check_in', 'check_out', 'both')),
    claimed_event_time TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    reason TEXT NOT NULL,
    evidence_url TEXT NULL,
    requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    review_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NULL,
    review_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE manual_attendance_requests IS 'Form permohonan kehadiran manual jika kendala teknis/kamera QR';

-- ==============================================================================
-- 14. TABLE: evaluation_policies
-- Tujuan: Kebijakan dan formula pembobotan nilai per periode
-- ==============================================================================
CREATE TABLE evaluation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES organization_periods(id) ON DELETE RESTRICT,
    policy_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    attendance_weight NUMERIC(5,2) NOT NULL DEFAULT 20.00
        CHECK (attendance_weight >= 0),
    punctuality_weight NUMERIC(5,2) NOT NULL DEFAULT 10.00
        CHECK (punctuality_weight >= 0),
    task_completion_weight NUMERIC(5,2) NOT NULL DEFAULT 10.00
        CHECK (task_completion_weight >= 0),
    coordinator_evaluation_weight NUMERIC(5,2) NOT NULL DEFAULT 60.00
        CHECK (coordinator_evaluation_weight >= 0),
    certificate_threshold NUMERIC(5,2) NOT NULL DEFAULT 75.00
        CHECK (certificate_threshold >= 0 AND certificate_threshold <= 100),
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    policy_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (policy_status IN ('draft', 'active', 'archived')),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_period_policy_version UNIQUE (period_id, policy_version),
    CONSTRAINT chk_system_weights CHECK (
        (attendance_weight + punctuality_weight + task_completion_weight) = 40.00
    ),
    CONSTRAINT chk_coordinator_weight CHECK (
        coordinator_evaluation_weight = 60.00
    ),
    CONSTRAINT chk_total_weights CHECK (
        (attendance_weight + punctuality_weight + task_completion_weight + coordinator_evaluation_weight) = 100.00
    )
);

COMMENT ON TABLE evaluation_policies IS 'Master parameter pembobotan penilaian sistem (40) dan koordinator (60)';

-- ==============================================================================
-- 15. TABLE: evaluation_criteria (Supporting Table: Rincian 5 Kriteria Koordinator)
-- ==============================================================================
CREATE TABLE evaluation_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES evaluation_policies(id) ON DELETE RESTRICT,
    criterion_code VARCHAR(30) NOT NULL,
    criterion_name VARCHAR(100) NOT NULL,
    criterion_description TEXT NOT NULL,
    maximum_rating NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    weight_points NUMERIC(5,2) NOT NULL CHECK (weight_points > 0),
    display_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_policy_criterion_code UNIQUE (policy_id, criterion_code)
);

COMMENT ON TABLE evaluation_criteria IS 'Definisi rubrik penilaian koordinator (Komunikasi 15, Tanggung Jawab 15, Tim 10, Inisiatif 10, Sikap 10)';

-- ==============================================================================
-- 16. TABLE: performance_reviews
-- Tujuan: Menyimpan lembar evaluasi kinerja anggota oleh koordinator
-- ==============================================================================
CREATE TABLE performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES organization_periods(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    policy_id UUID NOT NULL REFERENCES evaluation_policies(id) ON DELETE RESTRICT,
    review_status VARCHAR(25) NOT NULL DEFAULT 'draft'
        CHECK (review_status IN ('draft', 'submitted', 'needs_clarification', 'approved', 'returned')),
    communication_score NUMERIC(3,2) NOT NULL DEFAULT 0.00
        CHECK (communication_score >= 0.00 AND communication_score <= 5.00),
    responsibility_score NUMERIC(3,2) NOT NULL DEFAULT 0.00
        CHECK (responsibility_score >= 0.00 AND responsibility_score <= 5.00),
    teamwork_score NUMERIC(3,2) NOT NULL DEFAULT 0.00
        CHECK (teamwork_score >= 0.00 AND teamwork_score <= 5.00),
    initiative_score NUMERIC(3,2) NOT NULL DEFAULT 0.00
        CHECK (initiative_score >= 0.00 AND initiative_score <= 5.00),
    professionalism_score NUMERIC(3,2) NOT NULL DEFAULT 0.00
        CHECK (professionalism_score >= 0.00 AND professionalism_score <= 5.00),
    total_weighted_score NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (total_weighted_score >= 0.00 AND total_weighted_score <= 60.00),
    evidence_note TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NULL,
    reviewed_by_admin UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NULL,
    reviewer_feedback TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_period_member_review UNIQUE (period_id, member_id)
);

COMMENT ON TABLE performance_reviews IS 'Evaluasi kinerja panitia oleh koordinator bidang bersangkutan';

-- ==============================================================================
-- 17. TABLE: performance_scores
-- Tujuan: Menyimpan rincian poin terbobot per kriteria untuk audit transparansi
-- ==============================================================================
CREATE TABLE performance_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performance_review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES evaluation_criteria(id) ON DELETE RESTRICT,
    criterion_code VARCHAR(30) NOT NULL,
    criterion_name VARCHAR(100) NOT NULL,
    score NUMERIC(3,2) NOT NULL CHECK (score >= 1.00 AND score <= 5.00),
    maximum_score NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    weight_points NUMERIC(5,2) NOT NULL CHECK (weight_points > 0),
    weighted_points NUMERIC(5,2) NOT NULL CHECK (weighted_points >= 0 AND weighted_points <= weight_points),
    evidence_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_review_criterion UNIQUE (performance_review_id, criterion_id)
);

COMMENT ON TABLE performance_scores IS 'Detail skor terbobot tiap butir rubrik penilaian koordinator';

-- ==============================================================================
-- 18. TABLE: final_evaluations
-- Tujuan: Rekapitulasi akhir kelayakan sertifikat per anggota per periode
-- ==============================================================================
CREATE TABLE final_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES organization_periods(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    policy_id UUID NOT NULL REFERENCES evaluation_policies(id) ON DELETE RESTRICT,
    attendance_points NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (attendance_points >= 0.00 AND attendance_points <= 20.00),
    punctuality_points NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (punctuality_points >= 0.00 AND punctuality_points <= 10.00),
    task_completion_points NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (task_completion_points >= 0.00 AND task_completion_points <= 10.00),
    system_score NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (system_score >= 0.00 AND system_score <= 40.00),
    coordinator_score NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (coordinator_score >= 0.00 AND coordinator_score <= 60.00),
    final_score NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (final_score >= 0.00 AND final_score <= 100.00),
    evaluation_status VARCHAR(25) NOT NULL DEFAULT 'calculating'
        CHECK (evaluation_status IN ('calculating', 'pending_approval', 'approved', 'needs_revision', 'clarification_open')),
    certificate_eligibility_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (certificate_eligibility_status IN ('pending', 'eligible', 'ineligible')),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    approved_by UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ NULL,
    approval_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_period_member_final UNIQUE (period_id, member_id)
);

COMMENT ON TABLE final_evaluations IS 'Nilai akhir resmi dan keputusan kelayakan sertifikat panitia';

-- ==============================================================================
-- 19. TABLE: certificates
-- Tujuan: Mencatat penerbitan sertifikat kepanitiaan resmi
-- ==============================================================================
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_evaluation_id UUID NOT NULL UNIQUE REFERENCES final_evaluations(id) ON DELETE RESTRICT,
    certificate_number VARCHAR(100) NOT NULL UNIQUE,
    certificate_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (certificate_status IN ('draft', 'issued', 'revoked')),
    issued_at TIMESTAMPTZ NULL,
    issued_by UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    file_path TEXT NULL, -- Path Supabase Storage bucket
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE certificates IS 'Data registrasi sertifikat resmi panitia yang memenuhi syarat';

-- ==============================================================================
-- 20. TABLE: clarification_requests
-- Tujuan: Mencatat sanggahan atau klarifikasi anggota atas presensi/evaluasi
-- ==============================================================================
CREATE TABLE clarification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES organization_periods(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    related_activity_id UUID NULL REFERENCES activities(id) ON DELETE SET NULL,
    related_attendance_id UUID NULL REFERENCES attendances(id) ON DELETE SET NULL,
    related_review_id UUID NULL REFERENCES performance_reviews(id) ON DELETE SET NULL,
    related_final_evaluation_id UUID NULL REFERENCES final_evaluations(id) ON DELETE SET NULL,
    request_type VARCHAR(30) NOT NULL
        CHECK (request_type IN ('attendance_dispute', 'task_dispute', 'evaluation_dispute', 'general_inquiry')),
    request_description TEXT NOT NULL,
    request_status VARCHAR(20) NOT NULL DEFAULT 'submitted'
        CHECK (request_status IN ('submitted', 'under_review', 'resolved', 'rejected')),
    assigned_reviewer_id UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    resolution_note TEXT NULL,
    resolved_by UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE clarification_requests IS 'Permohonan klarifikasi/sanggahan panitia sebelum penetapan nilai final';

-- ==============================================================================
-- 21. TABLE: notifications (Supporting Table: Notifikasi In-App)
-- ==============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (notification_type IN ('general', 'assignment', 'attendance', 'task', 'evaluation', 'certificate', 'clarification')),
    action_url TEXT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE notifications IS 'Notifikasi dalam aplikasi untuk pengingat kegiatan, presensi, dan penilaian';

-- ==============================================================================
-- 22. TABLE: audit_logs
-- Tujuan: Jejak audit tindakan sensitif (hak akses, mutasi penugasan, nilai akhir)
-- ==============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    reason TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE audit_logs IS 'Tabel audit immutable yang merekam jejak operasi sensitif sistem';
