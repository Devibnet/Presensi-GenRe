-- ==============================================================================
-- GENRE ATTENDANCE - SUPABASE POSTGRESQL SCHEMA
-- Migration: 20261012000004_row_level_security.sql
-- Description: Enable Row Level Security (RLS) & Define Granular Policies
-- ==============================================================================

-- ==============================================================================
-- 1. AKTIFKAN RLS PADA SELURUH TABEL
-- ==============================================================================
ALTER TABLE organization_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_attendance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 2. POLICIES: organization_periods
-- ==============================================================================
-- Semua panitia terautentikasi dapat membaca periode
CREATE POLICY "periods_select_authenticated" ON organization_periods
    FOR SELECT TO authenticated
    USING (true);

-- Hanya admin yang dapat menambah/mengubah periode
CREATE POLICY "periods_insert_admin" ON organization_periods
    FOR INSERT TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "periods_update_admin" ON organization_periods
    FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "periods_delete_admin" ON organization_periods
    FOR DELETE TO authenticated
    USING (is_admin());


-- ==============================================================================
-- 3. POLICIES: fields
-- ==============================================================================
CREATE POLICY "fields_select_authenticated" ON fields
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "fields_manage_admin" ON fields
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ==============================================================================
-- 4. POLICIES: profiles
-- ==============================================================================
-- Semua panitia aktif dapat melihat daftar rekan panitia
CREATE POLICY "profiles_select_authenticated" ON profiles
    FOR SELECT TO authenticated
    USING (account_status != 'suspended');

-- Anggota hanya dapat mengubah nomor telepon & avatar sendiri (tidak boleh ubah role/status)
CREATE POLICY "profiles_update_self" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() AND
        system_role = (SELECT system_role FROM profiles WHERE id = auth.uid()) AND
        account_status = (SELECT account_status FROM profiles WHERE id = auth.uid())
    );

-- Admin dapat mengelola seluruh profil (termasuk penugasan role)
CREATE POLICY "profiles_all_admin" ON profiles
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ==============================================================================
-- 5. POLICIES: activities & activity_fields
-- ==============================================================================
CREATE POLICY "activities_select_authenticated" ON activities
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "activities_insert_coord_admin" ON activities
    FOR INSERT TO authenticated
    WITH CHECK (is_coordinator());

CREATE POLICY "activities_update_coord_admin" ON activities
    FOR UPDATE TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());

CREATE POLICY "activities_delete_admin" ON activities
    FOR DELETE TO authenticated
    USING (is_admin());

-- activity_fields
CREATE POLICY "act_fields_select" ON activity_fields
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "act_fields_manage" ON activity_fields
    FOR ALL TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());


-- ==============================================================================
-- 6. POLICIES: activity_assignments & assignment_history
-- ==============================================================================
-- Anggota dapat melihat penugasan mereka sendiri, Koordinator & Admin dapat melihat semua
CREATE POLICY "act_assign_select" ON activity_assignments
    FOR SELECT TO authenticated
    USING (
        member_id = auth.uid() OR 
        is_coordinator()
    );

-- Koordinator dan Admin dapat membuat penugasan
CREATE POLICY "act_assign_insert" ON activity_assignments
    FOR INSERT TO authenticated
    WITH CHECK (is_coordinator());

CREATE POLICY "act_assign_update" ON activity_assignments
    FOR UPDATE TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());

-- assignment_history (Read-only untuk Koordinator & Admin)
CREATE POLICY "assign_history_select" ON assignment_history
    FOR SELECT TO authenticated
    USING (is_coordinator());


-- ==============================================================================
-- 7. POLICIES: tasks & task_assignments
-- ==============================================================================
-- Tugas dapat dilihat oleh seluruh anggota tim panitia
CREATE POLICY "tasks_select" ON tasks
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "tasks_manage_coord" ON tasks
    FOR ALL TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());

-- task_assignments
CREATE POLICY "task_assign_select" ON task_assignments
    FOR SELECT TO authenticated
    USING (
        member_id = auth.uid() OR 
        is_coordinator()
    );

CREATE POLICY "task_assign_insert" ON task_assignments
    FOR INSERT TO authenticated
    WITH CHECK (is_coordinator());

-- Anggota dapat mengupdate catatan progress dan submit tugas sendiri
CREATE POLICY "task_assign_update_self" ON task_assignments
    FOR UPDATE TO authenticated
    USING (member_id = auth.uid() OR is_coordinator())
    WITH CHECK (
        is_coordinator() OR 
        (member_id = auth.uid() AND assignment_status IN ('assigned', 'in_progress', 'submitted'))
    );


-- ==============================================================================
-- 8. POLICIES: attendance_sessions
-- ==============================================================================
CREATE POLICY "att_sessions_select" ON attendance_sessions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "att_sessions_manage" ON attendance_sessions
    FOR ALL TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());


-- ==============================================================================
-- 9. POLICIES: attendances
-- ==============================================================================
-- Anggota hanya melihat presensinya sendiri; Koordinator & Admin melihat semua
CREATE POLICY "attendances_select" ON attendances
    FOR SELECT TO authenticated
    USING (
        is_coordinator() OR 
        activity_assignment_id IN (
            SELECT id FROM activity_assignments WHERE member_id = auth.uid()
        )
    );

-- Anggota dapat melakukan check-in mandiri melalui QR untuk penugasan aktif mereka
CREATE POLICY "attendances_insert_member" ON attendances
    FOR INSERT TO authenticated
    WITH CHECK (
        is_coordinator() OR 
        activity_assignment_id IN (
            SELECT id FROM activity_assignments 
            WHERE member_id = auth.uid() AND assignment_status = 'active'
        )
    );

-- Anggota dapat melakukan check-out sendiri; Koordinator dapat memverifikasi
CREATE POLICY "attendances_update" ON attendances
    FOR UPDATE TO authenticated
    USING (
        is_coordinator() OR 
        activity_assignment_id IN (
            SELECT id FROM activity_assignments WHERE member_id = auth.uid()
        )
    )
    WITH CHECK (
        is_coordinator() OR 
        (
            activity_assignment_id IN (
                SELECT id FROM activity_assignments WHERE member_id = auth.uid()
            ) AND 
            check_out_at IS NOT NULL
        )
    );


-- ==============================================================================
-- 10. POLICIES: manual_attendance_requests
-- ==============================================================================
CREATE POLICY "manual_req_select" ON manual_attendance_requests
    FOR SELECT TO authenticated
    USING (
        requested_by = auth.uid() OR 
        is_coordinator()
    );

CREATE POLICY "manual_req_insert_self" ON manual_attendance_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        requested_by = auth.uid() AND
        activity_assignment_id IN (
            SELECT id FROM activity_assignments WHERE member_id = auth.uid()
        )
    );

CREATE POLICY "manual_req_update_coord" ON manual_attendance_requests
    FOR UPDATE TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());


-- ==============================================================================
-- 11. POLICIES: evaluation_policies & evaluation_criteria
-- ==============================================================================
CREATE POLICY "policies_select" ON evaluation_policies
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "policies_manage_admin" ON evaluation_policies
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "criteria_select" ON evaluation_criteria
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "criteria_manage_admin" ON evaluation_criteria
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ==============================================================================
-- 12. POLICIES: performance_reviews & performance_scores
-- ==============================================================================
-- Koordinator & Admin dapat melihat semua; Anggota hanya dapat melihat review jika sudah disetujui (approved)
CREATE POLICY "perf_reviews_select" ON performance_reviews
    FOR SELECT TO authenticated
    USING (
        is_coordinator() OR 
        (member_id = auth.uid() AND review_status = 'approved')
    );

-- Hanya koordinator atau admin yang dapat membuat atau mengedit review
CREATE POLICY "perf_reviews_insert" ON performance_reviews
    FOR INSERT TO authenticated
    WITH CHECK (is_coordinator());

CREATE POLICY "perf_reviews_update" ON performance_reviews
    FOR UPDATE TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());

-- performance_scores
CREATE POLICY "perf_scores_select" ON performance_scores
    FOR SELECT TO authenticated
    USING (
        is_coordinator() OR 
        performance_review_id IN (
            SELECT id FROM performance_reviews 
            WHERE member_id = auth.uid() AND review_status = 'approved'
        )
    );

CREATE POLICY "perf_scores_manage" ON performance_scores
    FOR ALL TO authenticated
    USING (is_coordinator())
    WITH CHECK (is_coordinator());


-- ==============================================================================
-- 13. POLICIES: final_evaluations
-- ==============================================================================
-- Anggota hanya dapat melihat hasil evaluasi akhir miliknya sendiri; Koordinator & Admin dapat melihat semua
CREATE POLICY "final_eval_select" ON final_evaluations
    FOR SELECT TO authenticated
    USING (
        member_id = auth.uid() OR 
        is_coordinator()
    );

-- Hanya Admin yang berwenang mengesahkan (approve) final_evaluations
CREATE POLICY "final_eval_manage_admin" ON final_evaluations
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ==============================================================================
-- 14. POLICIES: certificates
-- ==============================================================================
CREATE POLICY "certificates_select" ON certificates
    FOR SELECT TO authenticated
    USING (
        is_coordinator() OR
        final_evaluation_id IN (
            SELECT id FROM final_evaluations WHERE member_id = auth.uid()
        )
    );

CREATE POLICY "certificates_manage_admin" ON certificates
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ==============================================================================
-- 15. POLICIES: clarification_requests
-- ==============================================================================
CREATE POLICY "clarification_select" ON clarification_requests
    FOR SELECT TO authenticated
    USING (
        member_id = auth.uid() OR 
        is_coordinator()
    );

CREATE POLICY "clarification_insert_self" ON clarification_requests
    FOR INSERT TO authenticated
    WITH CHECK (member_id = auth.uid());

CREATE POLICY "clarification_update" ON clarification_requests
    FOR UPDATE TO authenticated
    USING (
        is_coordinator() OR 
        (member_id = auth.uid() AND request_status = 'submitted')
    )
    WITH CHECK (
        is_coordinator() OR 
        (member_id = auth.uid() AND request_status = 'submitted')
    );


-- ==============================================================================
-- 16. POLICIES: notifications
-- ==============================================================================
CREATE POLICY "notifications_select_self" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "notifications_update_self" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ==============================================================================
-- 17. POLICIES: audit_logs
-- ==============================================================================
-- Hanya admin yang dapat membaca audit logs (Immutable: tidak ada insert/update/delete manual oleh user)
CREATE POLICY "audit_logs_select_admin" ON audit_logs
    FOR SELECT TO authenticated
    USING (is_admin());
