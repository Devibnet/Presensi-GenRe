-- ==============================================================================
-- GENRE ATTENDANCE - SUPABASE POSTGRESQL SCHEMA
-- Migration: 20261012000003_functions_and_views.sql
-- Description: Authorization helpers, scoring calculation engine, & analytical views
-- ==============================================================================

-- ==============================================================================
-- 1. HELPER FUNCTIONS: AUTORISASI & ROLE CHECKING (SECURITY DEFINER)
-- ==============================================================================

-- Ambil system_role pengguna saat ini
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS VARCHAR(20)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT system_role 
    FROM profiles 
    WHERE id = auth.uid() AND account_status = 'active';
$$;

-- Cek apakah pengguna saat ini adalah admin aktif
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
          AND system_role = 'admin' 
          AND account_status = 'active'
    );
$$;

-- Cek apakah pengguna saat ini adalah koordinator aktif
CREATE OR REPLACE FUNCTION is_coordinator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
          AND system_role IN ('admin', 'coordinator') 
          AND account_status = 'active'
    );
$$;

-- Cek apakah pengguna adalah koordinator sah dari suatu bidang tertentu (atau admin)
CREATE OR REPLACE FUNCTION is_field_coordinator(p_field_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM fields f
        JOIN profiles p ON p.id = auth.uid()
        WHERE f.id = p_field_id 
          AND p.account_status = 'active'
          AND (p.system_role = 'admin' OR f.coordinator_id = p.id)
    );
$$;


-- ==============================================================================
-- 2. CALCULATION ENGINE: SISTEM SKOR & REKAPITULASI NILAI AKHIR
-- ==============================================================================

-- Fungsi menghitung Skor Sistem (Max 40 Poin)
-- Kehadiran: Max 20 poin
-- Ketepatan Waktu: Max 10 poin
-- Penyelesaian Tugas: Max 10 poin
CREATE OR REPLACE FUNCTION calculate_system_score(
    p_period_id UUID,
    p_member_id UUID
)
RETURNS TABLE (
    attendance_points NUMERIC(5,2),
    punctuality_points NUMERIC(5,2),
    task_completion_points NUMERIC(5,2),
    total_system_score NUMERIC(5,2),
    total_assigned_activities INT,
    total_present_activities INT,
    total_ontime_activities INT,
    total_assigned_tasks INT,
    total_completed_tasks INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_assigned_act INT := 0;
    v_total_present_act INT := 0;
    v_total_ontime_act INT := 0;
    v_total_assigned_tsk INT := 0;
    v_total_completed_tsk INT := 0;
    
    v_att_pts NUMERIC(5,2) := 0.00;
    v_punc_pts NUMERIC(5,2) := 0.00;
    v_task_pts NUMERIC(5,2) := 0.00;
BEGIN
    -- 1. Evaluasi Penugasan Kegiatan & Presensi
    SELECT 
        COUNT(aa.id),
        COUNT(CASE WHEN att.verification_status = 'approved' AND att.check_in_at IS NOT NULL THEN 1 END),
        COUNT(CASE WHEN att.verification_status = 'approved' AND att.check_in_status = 'on_time' THEN 1 END)
    INTO 
        v_total_assigned_act,
        v_total_present_act,
        v_total_ontime_act
    FROM activity_assignments aa
    JOIN activities act ON act.id = aa.activity_id
    LEFT JOIN attendances att ON att.activity_assignment_id = aa.id
    WHERE act.period_id = p_period_id
      AND aa.member_id = p_member_id
      AND aa.assignment_status = 'active'
      AND act.activity_status IN ('completed', 'ongoing');

    -- Rumus Kehadiran: Jika tidak ada kegiatan ditugaskan, tidak ada penalti (diberi bobot penuh)
    IF v_total_assigned_act = 0 THEN
        v_att_pts := 20.00;
        v_punc_pts := 10.00;
    ELSE
        v_att_pts := ROUND((v_total_present_act::numeric / v_total_assigned_act::numeric) * 20.00, 2);
        
        -- Rumus Ketepatan Waktu: dihitung dari kegiatan yang dihadiri
        IF v_total_present_act = 0 THEN
            v_punc_pts := 0.00;
        ELSE
            v_punc_pts := ROUND((v_total_ontime_act::numeric / v_total_present_act::numeric) * 10.00, 2);
        END IF;
    END IF;

    -- 2. Evaluasi Penyelesaian Tugas
    SELECT 
        COUNT(ta.id),
        COUNT(CASE WHEN ta.assignment_status = 'completed' THEN 1 END)
    INTO 
        v_total_assigned_tsk,
        v_total_completed_tsk
    FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    WHERE t.period_id = p_period_id
      AND ta.member_id = p_member_id
      AND ta.assignment_status != 'cancelled'
      AND t.task_status != 'cancelled';

    IF v_total_assigned_tsk = 0 THEN
        v_task_pts := 10.00; -- Tidak dibebani tugas individual -> poin penuh
    ELSE
        v_task_pts := ROUND((v_total_completed_tsk::numeric / v_total_assigned_tsk::numeric) * 10.00, 2);
    END IF;

    RETURN QUERY SELECT 
        v_att_pts,
        v_punc_pts,
        v_task_pts,
        ROUND(v_att_pts + v_punc_pts + v_task_pts, 2),
        v_total_assigned_act,
        v_total_present_act,
        v_total_ontime_act,
        v_total_assigned_tsk,
        v_total_completed_tsk;
END;
$$;


-- Fungsi Menghitung dan Meng-upsert Rekap Nilai Akhir (Sistem + Koordinator)
CREATE OR REPLACE FUNCTION calculate_and_upsert_final_evaluation(
    p_period_id UUID,
    p_member_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_policy_id UUID;
    v_threshold NUMERIC(5,2);
    
    v_att_pts NUMERIC(5,2);
    v_punc_pts NUMERIC(5,2);
    v_task_pts NUMERIC(5,2);
    v_sys_score NUMERIC(5,2);
    
    v_coord_score NUMERIC(5,2) := 0.00;
    v_review_status VARCHAR(25);
    
    v_final_score NUMERIC(5,2) := 0.00;
    v_eval_status VARCHAR(25) := 'calculating';
    v_cert_status VARCHAR(20) := 'pending';
    
    v_has_open_clarification BOOLEAN := false;
    v_final_eval_id UUID;
BEGIN
    -- 1. Ambil policy aktif
    SELECT id, certificate_threshold 
    INTO v_policy_id, v_threshold
    FROM evaluation_policies 
    WHERE period_id = p_period_id AND policy_status = 'active'
    ORDER BY created_at DESC 
    LIMIT 1;

    IF v_policy_id IS NULL THEN
        RAISE EXCEPTION 'Kebijakan evaluasi (evaluation_policies) aktif belum dikonfigurasi untuk periode ini.';
    END IF;

    -- 2. Hitung skor sistem
    SELECT 
        attendance_points, punctuality_points, task_completion_points, total_system_score
    INTO 
        v_att_pts, v_punc_pts, v_task_pts, v_sys_score
    FROM calculate_system_score(p_period_id, p_member_id);

    -- 3. Ambil evaluasi koordinator (jika ada)
    SELECT total_weighted_score, review_status
    INTO v_coord_score, v_review_status
    FROM performance_reviews
    WHERE period_id = p_period_id AND member_id = p_member_id;

    IF v_coord_score IS NULL THEN
        v_coord_score := 0.00;
        v_review_status := 'not_started';
    END IF;

    -- 4. Hitung nilai akhir total
    v_final_score := ROUND(v_sys_score + v_coord_score, 2);

    -- 5. Periksa apakah ada permohonan klarifikasi terbuka
    SELECT EXISTS (
        SELECT 1 FROM clarification_requests
        WHERE period_id = p_period_id 
          AND member_id = p_member_id
          AND request_status IN ('submitted', 'under_review')
    ) INTO v_has_open_clarification;

    -- 6. Tentukan status evaluasi & kelayakan sertifikat
    IF v_has_open_clarification THEN
        v_eval_status := 'clarification_open';
        v_cert_status := 'pending';
    ELSIF v_review_status = 'approved' THEN
        v_eval_status := 'pending_approval';
        IF v_final_score >= v_threshold THEN
            v_cert_status := 'eligible';
        ELSE
            v_cert_status := 'ineligible';
        END IF;
    ELSE
        v_eval_status := 'calculating';
        v_cert_status := 'pending';
    END IF;

    -- 7. Upsert ke final_evaluations
    INSERT INTO final_evaluations (
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
        calculated_at
    ) VALUES (
        p_period_id,
        p_member_id,
        v_policy_id,
        v_att_pts,
        v_punc_pts,
        v_task_pts,
        v_sys_score,
        v_coord_score,
        v_final_score,
        v_eval_status,
        v_cert_status,
        clock_timestamp()
    )
    ON CONFLICT (period_id, member_id) DO UPDATE SET
        policy_id = EXCLUDED.policy_id,
        attendance_points = EXCLUDED.attendance_points,
        punctuality_points = EXCLUDED.punctuality_points,
        task_completion_points = EXCLUDED.task_completion_points,
        system_score = EXCLUDED.system_score,
        coordinator_score = EXCLUDED.coordinator_score,
        final_score = EXCLUDED.final_score,
        evaluation_status = EXCLUDED.evaluation_status,
        certificate_eligibility_status = EXCLUDED.certificate_eligibility_status,
        calculated_at = clock_timestamp(),
        updated_at = clock_timestamp()
    RETURNING id INTO v_final_eval_id;

    RETURN v_final_eval_id;
END;
$$;


-- ==============================================================================
-- 3. ANALYTICAL & OPERATIONAL VIEWS
-- ==============================================================================

-- View: v_active_members (Daftar anggota aktif, bidang, & nama koordinator)
CREATE OR REPLACE VIEW v_active_members AS
SELECT 
    p.id AS member_id,
    p.member_code,
    p.full_name,
    p.email,
    p.phone_number,
    p.system_role,
    p.organization_position,
    p.account_status,
    p.joined_at,
    f.id AS field_id,
    f.field_name,
    f.field_code,
    c.full_name AS coordinator_name,
    c.email AS coordinator_email
FROM profiles p
LEFT JOIN fields f ON f.id = p.field_id
LEFT JOIN profiles c ON c.id = f.coordinator_id
WHERE p.account_status = 'active';

COMMENT ON VIEW v_active_members IS 'Daftar anggota panitia berstatus aktif beserta bidang dan koordinatornya';


-- View: v_activity_attendance_summary (Ringkasan presensi kegiatan per kegiatan)
CREATE OR REPLACE VIEW v_activity_attendance_summary AS
SELECT 
    a.id AS activity_id,
    a.period_id,
    a.activity_code,
    a.activity_name,
    a.start_at,
    a.end_at,
    a.activity_status,
    COUNT(aa.id) AS total_assigned_members,
    COUNT(CASE WHEN att.verification_status = 'approved' AND att.check_in_at IS NOT NULL THEN 1 END) AS total_checked_in,
    COUNT(CASE WHEN att.verification_status = 'approved' AND att.check_in_status = 'on_time' THEN 1 END) AS total_on_time,
    COUNT(CASE WHEN att.verification_status = 'approved' AND att.check_in_status = 'late' THEN 1 END) AS total_late,
    COUNT(CASE WHEN att.verification_status = 'approved' AND att.check_out_at IS NOT NULL THEN 1 END) AS total_checked_out,
    COUNT(CASE WHEN att.id IS NULL OR att.check_in_at IS NULL THEN 1 END) AS total_not_checked_in
FROM activities a
LEFT JOIN activity_assignments aa ON aa.activity_id = a.id AND aa.assignment_status = 'active'
LEFT JOIN attendances att ON att.activity_assignment_id = aa.id
GROUP BY a.id, a.period_id, a.activity_code, a.activity_name, a.start_at, a.end_at, a.activity_status;

COMMENT ON VIEW v_activity_attendance_summary IS 'Rekapitulasi kuantitas presensi kegiatan, kehadiran tepat waktu, dan check-out';


-- View: v_member_score_recap (Rekapitulasi lengkap nilai 40 sistem, 60 koordinator, 100 final)
CREATE OR REPLACE VIEW v_member_score_recap AS
SELECT 
    fe.id AS final_evaluation_id,
    fe.period_id,
    p.id AS member_id,
    p.member_code,
    p.full_name,
    p.email,
    f.field_name,
    fe.attendance_points,
    fe.punctuality_points,
    fe.task_completion_points,
    fe.system_score,
    fe.coordinator_score,
    fe.final_score,
    fe.evaluation_status,
    fe.certificate_eligibility_status,
    fe.approved_at,
    cert.certificate_number,
    cert.certificate_status
FROM final_evaluations fe
JOIN profiles p ON p.id = fe.member_id
LEFT JOIN fields f ON f.id = p.field_id
LEFT JOIN certificates cert ON cert.final_evaluation_id = fe.id;

COMMENT ON VIEW v_member_score_recap IS 'Rekapitulasi komprehensif nilai akhir panitia dan status kelayakan sertifikat';


-- View: v_field_performance_overview (Rata-rata capaian dan keaktifan per bidang)
CREATE OR REPLACE VIEW v_field_performance_overview AS
SELECT 
    f.id AS field_id,
    f.period_id,
    f.field_name,
    f.field_code,
    coord.full_name AS coordinator_name,
    COUNT(DISTINCT p.id) AS total_members,
    ROUND(AVG(fe.system_score), 2) AS avg_system_score,
    ROUND(AVG(fe.coordinator_score), 2) AS avg_coordinator_score,
    ROUND(AVG(fe.final_score), 2) AS avg_final_score,
    COUNT(CASE WHEN fe.certificate_eligibility_status = 'eligible' THEN 1 END) AS total_eligible_members
FROM fields f
LEFT JOIN profiles coord ON coord.id = f.coordinator_id
LEFT JOIN profiles p ON p.field_id = f.id AND p.account_status = 'active'
LEFT JOIN final_evaluations fe ON fe.member_id = p.id AND fe.period_id = f.period_id
GROUP BY f.id, f.period_id, f.field_name, f.field_code, coord.full_name;

COMMENT ON VIEW v_field_performance_overview IS 'Ringkasan statistik rata-rata keaktifan panitia per bidang';
