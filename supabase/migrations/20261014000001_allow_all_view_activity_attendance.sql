-- ==============================================================================
-- GENRE ATTENDANCE - SUPABASE POSTGRESQL MIGRATION
-- Migration: 20261014000001_allow_all_view_activity_attendance.sql
-- Description: Mengizinkan seluruh akun panitia terotentikasi untuk melihat data
--              penugasan kegiatan (activity_assignments) dan presensi (attendances).
--              Hal ini mendukung transparansi agar semua orang/panitia dapat memantau
--              status kehadiran panitia lain (Tepat Waktu, Terlambat, maupun Belum Hadir)
--              pada setiap agenda kegiatan.
-- ==============================================================================

-- Pastikan search_path mengarah ke schema public
SET search_path = public, auth;

-- 1. Kebijakan SELECT pada activity_assignments
DROP POLICY IF EXISTS "act_assign_select" ON public.activity_assignments;
CREATE POLICY "act_assign_select" ON public.activity_assignments
    FOR SELECT TO authenticated
    USING (true);

-- 2. Kebijakan SELECT pada attendances
DROP POLICY IF EXISTS "attendances_select" ON public.attendances;
CREATE POLICY "attendances_select" ON public.attendances
    FOR SELECT TO authenticated
    USING (true);
