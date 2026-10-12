-- ==============================================================================
-- GENRE ATTENDANCE - SUPABASE POSTGRESQL SCHEMA
-- Migration: 20261012000002_indexes_and_triggers.sql
-- Description: Indexes for performance, universal triggers, audit logging, & validations
-- ==============================================================================

-- ==============================================================================
-- 1. INDEKS UNTUK PENCARIAN, FILTER, DAN INTEGRITAS FOREIGN KEY
-- ==============================================================================

-- organization_periods
CREATE INDEX idx_periods_status ON organization_periods (period_status);
CREATE INDEX idx_periods_dates ON organization_periods (start_date, end_date);

-- fields
CREATE INDEX idx_fields_period_id ON fields (period_id);
CREATE INDEX idx_fields_coordinator_id ON fields (coordinator_id);
CREATE INDEX idx_fields_status ON fields (field_status);

-- profiles
CREATE INDEX idx_profiles_field_id ON profiles (field_id);
CREATE INDEX idx_profiles_system_role ON profiles (system_role);
CREATE INDEX idx_profiles_account_status ON profiles (account_status);
CREATE INDEX idx_profiles_full_name ON profiles (full_name);

-- activities
CREATE INDEX idx_activities_period_id ON activities (period_id);
CREATE INDEX idx_activities_status ON activities (activity_status);
CREATE INDEX idx_activities_start_end ON activities (start_at, end_at);
CREATE INDEX idx_activities_checkin_window ON activities (check_in_opens_at, check_in_closes_at);

-- activity_fields
CREATE INDEX idx_activity_fields_activity_id ON activity_fields (activity_id);
CREATE INDEX idx_activity_fields_field_id ON activity_fields (field_id);

-- activity_assignments
CREATE INDEX idx_activity_assignments_activity_id ON activity_assignments (activity_id);
CREATE INDEX idx_activity_assignments_member_id ON activity_assignments (member_id);
CREATE INDEX idx_activity_assignments_status ON activity_assignments (assignment_status);
CREATE INDEX idx_activity_assignments_type ON activity_assignments (assignment_type);

-- assignment_history
CREATE INDEX idx_assignment_history_assignment_id ON assignment_history (activity_assignment_id);
CREATE INDEX idx_assignment_history_created_at ON assignment_history (created_at DESC);

-- tasks
CREATE INDEX idx_tasks_period_id ON tasks (period_id);
CREATE INDEX idx_tasks_activity_id ON tasks (activity_id);
CREATE INDEX idx_tasks_field_id ON tasks (field_id);
CREATE INDEX idx_tasks_status ON tasks (task_status);
CREATE INDEX idx_tasks_due_at ON tasks (due_at);

-- task_assignments
CREATE INDEX idx_task_assignments_task_id ON task_assignments (task_id);
CREATE INDEX idx_task_assignments_member_id ON task_assignments (member_id);
CREATE INDEX idx_task_assignments_status ON task_assignments (assignment_status);

-- attendance_sessions
CREATE INDEX idx_attendance_sessions_activity_id ON attendance_sessions (activity_id);
CREATE INDEX idx_attendance_sessions_status ON attendance_sessions (session_status);

-- attendances
CREATE INDEX idx_attendances_assignment_id ON attendances (activity_assignment_id);
CREATE INDEX idx_attendances_session_id ON attendances (attendance_session_id);
CREATE INDEX idx_attendances_check_in_status ON attendances (check_in_status);
CREATE INDEX idx_attendances_verification_status ON attendances (verification_status);
CREATE INDEX idx_attendances_check_in_at ON attendances (check_in_at);

-- manual_attendance_requests
CREATE INDEX idx_manual_req_assignment_id ON manual_attendance_requests (activity_assignment_id);
CREATE INDEX idx_manual_req_requested_by ON manual_attendance_requests (requested_by);
CREATE INDEX idx_manual_req_review_status ON manual_attendance_requests (review_status);

-- evaluation_policies
CREATE INDEX idx_evaluation_policies_period_id ON evaluation_policies (period_id);
CREATE INDEX idx_evaluation_policies_status ON evaluation_policies (policy_status);

-- evaluation_criteria
CREATE INDEX idx_evaluation_criteria_policy_id ON evaluation_criteria (policy_id);

-- performance_reviews
CREATE INDEX idx_perf_reviews_period_id ON performance_reviews (period_id);
CREATE INDEX idx_perf_reviews_member_id ON performance_reviews (member_id);
CREATE INDEX idx_perf_reviews_reviewer_id ON performance_reviews (reviewer_id);
CREATE INDEX idx_perf_reviews_status ON performance_reviews (review_status);

-- performance_scores
CREATE INDEX idx_perf_scores_review_id ON performance_scores (performance_review_id);
CREATE INDEX idx_perf_scores_criterion_id ON performance_scores (criterion_id);

-- final_evaluations
CREATE INDEX idx_final_eval_period_id ON final_evaluations (period_id);
CREATE INDEX idx_final_eval_member_id ON final_evaluations (member_id);
CREATE INDEX idx_final_eval_status ON final_evaluations (evaluation_status);
CREATE INDEX idx_final_eval_cert_status ON final_evaluations (certificate_eligibility_status);

-- certificates
CREATE INDEX idx_certificates_final_eval_id ON certificates (final_evaluation_id);
CREATE INDEX idx_certificates_number ON certificates (certificate_number);
CREATE INDEX idx_certificates_status ON certificates (certificate_status);

-- clarification_requests
CREATE INDEX idx_clarifications_period_id ON clarification_requests (period_id);
CREATE INDEX idx_clarifications_member_id ON clarification_requests (member_id);
CREATE INDEX idx_clarifications_status ON clarification_requests (request_status);

-- notifications
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);

-- audit_logs
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);


-- ==============================================================================
-- 2. UNIVERSAL FUNCTION: trigger_set_updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

-- Pasang trigger updated_at pada seluruh tabel yang memiliki updated_at
CREATE TRIGGER trg_set_updated_at_periods
    BEFORE UPDATE ON organization_periods
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_fields
    BEFORE UPDATE ON fields
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_activities
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_activity_assignments
    BEFORE UPDATE ON activity_assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_tasks
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_task_assignments
    BEFORE UPDATE ON task_assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_attendance_sessions
    BEFORE UPDATE ON attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_attendances
    BEFORE UPDATE ON attendances
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_manual_requests
    BEFORE UPDATE ON manual_attendance_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_evaluation_policies
    BEFORE UPDATE ON evaluation_policies
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_performance_reviews
    BEFORE UPDATE ON performance_reviews
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_performance_scores
    BEFORE UPDATE ON performance_scores
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_final_evaluations
    BEFORE UPDATE ON final_evaluations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_certificates
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_set_updated_at_clarification_requests
    BEFORE UPDATE ON clarification_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ==============================================================================
-- 3. TRIGGER: log_assignment_history
-- Tujuan: Otomatis mencatat perubahan status penugasan kegiatan
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_log_assignment_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.assignment_status IS DISTINCT FROM NEW.assignment_status) THEN
        INSERT INTO assignment_history (
            activity_assignment_id,
            previous_status,
            new_status,
            action_by,
            change_reason
        ) VALUES (
            NEW.id,
            OLD.assignment_status,
            NEW.assignment_status,
            COALESCE(auth.uid(), NEW.assigned_by),
            COALESCE(NEW.cancellation_reason, 'Status penugasan diubah')
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_status_history
    AFTER UPDATE ON activity_assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_log_assignment_history();


-- ==============================================================================
-- 4. TRIGGER: validate_attendance_rules
-- Tujuan: Memastikan presensi hanya dilakukan pada penugasan aktif dan kegiatan yang sah
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_validate_attendance_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activity_status VARCHAR(20);
    v_assignment_status VARCHAR(20);
    v_checkin_open TIMESTAMPTZ;
    v_checkin_close TIMESTAMPTZ;
BEGIN
    -- Ambil status kegiatan dan penugasan
    SELECT a.activity_status, aa.assignment_status, a.check_in_opens_at, a.check_in_closes_at
    INTO v_activity_status, v_assignment_status, v_checkin_open, v_checkin_close
    FROM activity_assignments aa
    JOIN activities a ON a.id = aa.activity_id
    WHERE aa.id = NEW.activity_assignment_id;

    IF v_activity_status = 'cancelled' THEN
        RAISE EXCEPTION 'Presensi ditolak: Kegiatan telah dibatalkan.';
    END IF;

    IF v_assignment_status != 'active' THEN
        RAISE EXCEPTION 'Presensi ditolak: Status penugasan anggota adalah %, bukan active.', v_assignment_status;
    END IF;

    -- Validasi waktu check in status jika belum di-set eksplisit
    IF NEW.check_in_at IS NOT NULL AND NEW.check_in_status = 'pending_verification' AND NEW.check_in_method = 'qr' THEN
        IF NEW.check_in_at <= v_checkin_close THEN
            NEW.check_in_status := 'on_time';
        ELSE
            NEW.check_in_status := 'late';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_attendance_insert
    BEFORE INSERT OR UPDATE ON attendances
    FOR EACH ROW EXECUTE FUNCTION trigger_validate_attendance_rules();


-- ==============================================================================
-- 5. TRIGGER: sync_performance_review_weights
-- Tujuan: Menghitung total_weighted_score (max 60) secara otomatis dan aman di DB
-- Rumus:
-- Komunikasi: (score/5) * 15
-- Tanggung Jawab: (score/5) * 15
-- Kerja Sama Tim: (score/5) * 10
-- Inisiatif: (score/5) * 10
-- Sikap/Profesionalisme: (score/5) * 10
-- Total: max 60.00
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_calculate_review_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.total_weighted_score := ROUND(
        ((NEW.communication_score / 5.0) * 15.0) +
        ((NEW.responsibility_score / 5.0) * 15.0) +
        ((NEW.teamwork_score / 5.0) * 10.0) +
        ((NEW.initiative_score / 5.0) * 10.0) +
        ((NEW.professionalism_score / 5.0) * 10.0),
        2
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_review_total
    BEFORE INSERT OR UPDATE ON performance_reviews
    FOR EACH ROW EXECUTE FUNCTION trigger_calculate_review_total();


-- ==============================================================================
-- 6. TRIGGER: audit_sensitive_changes
-- Tujuan: Mencatat mutasi pada tabel penting ke audit_logs
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_audit_log_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_action VARCHAR(50);
    v_entity_type VARCHAR(50);
    v_entity_id UUID;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    v_actor_id := auth.uid();
    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;

    IF (TG_OP = 'DELETE') THEN
        v_entity_id := OLD.id;
        v_old := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_entity_id := NEW.id;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSE
        v_entity_id := NEW.id;
        v_new := to_jsonb(NEW);
    END IF;

    INSERT INTO audit_logs (
        actor_id,
        action_type,
        entity_type,
        entity_id,
        old_values,
        new_values,
        reason
    ) VALUES (
        v_actor_id,
        v_action,
        v_entity_type,
        v_entity_id,
        v_old,
        v_new,
        'Otomatis tercatat melalui database trigger'
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Pasang audit trigger pada tabel-tabel strategis
CREATE TRIGGER trg_audit_profiles
    AFTER UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log_entry();

CREATE TRIGGER trg_audit_attendances
    AFTER UPDATE OR DELETE ON attendances
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log_entry();

CREATE TRIGGER trg_audit_reviews
    AFTER UPDATE OR DELETE ON performance_reviews
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log_entry();

CREATE TRIGGER trg_audit_final_evaluations
    AFTER UPDATE OR DELETE ON final_evaluations
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log_entry();

CREATE TRIGGER trg_audit_certificates
    AFTER INSERT OR UPDATE OR DELETE ON certificates
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log_entry();
