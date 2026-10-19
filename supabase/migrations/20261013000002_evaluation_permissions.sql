-- ==============================================================================
-- GENRE ATTENDANCE - SUPABASE POSTGRESQL MIGRATION
-- Migration: 20261013000002_evaluation_permissions.sql
-- Description: Penegakan aturan evaluasi kinerja panitia:
--   1. Evaluator tidak bisa menilai diri sendiri (reviewer_id != member_id)
--   2. Akun admin hanya dapat dinilai oleh akun admin lain
--   3. Koordinator hanya bisa dinilai oleh admin
--   4. Koordinator hanya bisa menilai anggota sie nya
-- ==============================================================================

CREATE OR REPLACE FUNCTION trigger_validate_performance_review_evaluator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reviewer profiles%ROWTYPE;
    v_target profiles%ROWTYPE;
BEGIN
    -- 1. Evaluator tidak dapat menilai diri sendiri
    IF NEW.reviewer_id = NEW.member_id THEN
        RAISE EXCEPTION 'Evaluator tidak dapat menilai diri sendiri (reviewer_id = member_id)';
    END IF;

    -- Ambil profil reviewer
    SELECT * INTO v_reviewer FROM profiles WHERE id = NEW.reviewer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reviewer tidak ditemukan pada profiles';
    END IF;

    -- Ambil profil target member
    SELECT * INTO v_target FROM profiles WHERE id = NEW.member_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Anggota yang dinilai tidak ditemukan pada profiles';
    END IF;

    -- 2. Anggota biasa tidak berwenang memberikan penilaian
    IF v_reviewer.system_role = 'member' THEN
        RAISE EXCEPTION 'Anggota tidak memiliki kewenangan untuk memberikan penilaian kinerja';
    END IF;

    -- 3. Akun admin hanya dapat dinilai oleh akun admin lain
    IF v_target.system_role = 'admin' THEN
        IF v_reviewer.system_role != 'admin' THEN
            RAISE EXCEPTION 'Akun admin hanya dapat dinilai oleh akun admin lain';
        END IF;
        RETURN NEW;
    END IF;

    -- 4. Koordinator hanya bisa dinilai oleh admin
    IF v_target.system_role = 'coordinator' THEN
        IF v_reviewer.system_role != 'admin' THEN
            RAISE EXCEPTION 'Koordinator hanya bisa dinilai oleh admin';
        END IF;
        RETURN NEW;
    END IF;

    -- 5. Jika target adalah member biasa:
    -- Admin berwenang menilai seluruh anggota
    IF v_reviewer.system_role = 'admin' THEN
        RETURN NEW;
    END IF;

    -- Koordinator hanya bisa menilai anggota sie nya
    IF v_reviewer.system_role = 'coordinator' THEN
        IF v_target.field_id IS NULL THEN
            RAISE EXCEPTION 'Koordinator hanya bisa menilai anggota sie nya (anggota target belum memiliki divisi/sie)';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM fields f 
            WHERE f.id = v_target.field_id 
              AND (f.coordinator_id = v_reviewer.id OR f.id = v_reviewer.field_id)
        ) THEN
            RAISE EXCEPTION 'Koordinator hanya bisa menilai anggota sie nya';
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_performance_review_evaluator ON performance_reviews;
CREATE TRIGGER trg_validate_performance_review_evaluator
    BEFORE INSERT OR UPDATE ON performance_reviews
    FOR EACH ROW EXECUTE FUNCTION trigger_validate_performance_review_evaluator();

-- Perbarui RLS policy pada performance_reviews
DROP POLICY IF EXISTS "perf_reviews_insert" ON performance_reviews;
DROP POLICY IF EXISTS "perf_reviews_update" ON performance_reviews;

CREATE POLICY "perf_reviews_insert" ON performance_reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        reviewer_id = auth.uid() AND
        reviewer_id != member_id AND
        (
            is_admin() OR
            (
                is_coordinator() AND
                EXISTS (
                    SELECT 1 FROM profiles target_p 
                    WHERE target_p.id = performance_reviews.member_id 
                      AND target_p.system_role = 'member'
                      AND target_p.field_id IS NOT NULL
                      AND EXISTS (
                          SELECT 1 FROM fields f
                          WHERE f.id = target_p.field_id
                            AND (f.coordinator_id = auth.uid() OR f.id = (SELECT field_id FROM profiles WHERE id = auth.uid()))
                      )
                )
            )
        )
    );

CREATE POLICY "perf_reviews_update" ON performance_reviews
    FOR UPDATE TO authenticated
    USING (
        reviewer_id = auth.uid() AND
        reviewer_id != member_id AND
        (
            is_admin() OR
            (
                is_coordinator() AND
                EXISTS (
                    SELECT 1 FROM profiles target_p 
                    WHERE target_p.id = performance_reviews.member_id 
                      AND target_p.system_role = 'member'
                      AND target_p.field_id IS NOT NULL
                      AND EXISTS (
                          SELECT 1 FROM fields f
                          WHERE f.id = target_p.field_id
                            AND (f.coordinator_id = auth.uid() OR f.id = (SELECT field_id FROM profiles WHERE id = auth.uid()))
                      )
                )
            )
        )
    )
    WITH CHECK (
        reviewer_id = auth.uid() AND
        reviewer_id != member_id AND
        (
            is_admin() OR
            (
                is_coordinator() AND
                EXISTS (
                    SELECT 1 FROM profiles target_p 
                    WHERE target_p.id = performance_reviews.member_id 
                      AND target_p.system_role = 'member'
                      AND target_p.field_id IS NOT NULL
                      AND EXISTS (
                          SELECT 1 FROM fields f
                          WHERE f.id = target_p.field_id
                            AND (f.coordinator_id = auth.uid() OR f.id = (SELECT field_id FROM profiles WHERE id = auth.uid()))
                      )
                )
            )
        )
    );
