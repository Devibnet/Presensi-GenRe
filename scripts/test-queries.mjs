import { newDb } from 'pg-mem';
import fs from 'fs';
import crypto from 'crypto';

console.log('=== PENGUJIAN 25 QUERY SQL WAJIB GENRE ATTENDANCE ===');

const db = newDb();

db.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => crypto.randomUUID(),
});

db.public.registerFunction({
    name: 'clock_timestamp',
    implementation: () => new Date(),
});

db.public.registerFunction({
    name: 'round',
    args: [db.public.getType('float'), db.public.getType('integer')],
    returns: db.public.getType('float'),
    implementation: (val, prec) => Number(Math.round(val + 'e' + prec) + 'e-' + prec),
});

db.public.registerFunction({
    name: 'round',
    args: [db.public.getType('numeric'), db.public.getType('integer')],
    returns: db.public.getType('numeric'),
    implementation: (val, prec) => Number(Math.round(val + 'e' + prec) + 'e-' + prec),
});

const { Client } = db.adapters.createPg();
const client = new Client();
await client.connect();

// Mock auth schema
await client.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
    );
`);

// Execute Migration 1
const mig1 = fs.readFileSync('supabase/migrations/20261012000001_initial_schema.sql', 'utf8')
    .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '')
    .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '');
await client.query(mig1);

// Execute seed
const seedSql = fs.readFileSync('supabase/seed.sql', 'utf8');
await client.query(seedSql);

// Test Parameters
const PERIOD_ID = '00000000-0000-0000-0000-000000000001';
const FIELD_ID = '22222222-0000-0000-0000-000000000002'; // Divisi Acara
const MEMBER_YOGA_ID = '11111111-0000-0000-0000-000000000007';
const MEMBER_AYU_ID = '11111111-0000-0000-0000-000000000008';
const ACTIVITY_PLENO_ID = '55555555-0000-0000-0000-000000000001';
const ACTIVITY_FINAL_ID = '55555555-0000-0000-0000-000000000004';

const queries = [
    {
        num: 1,
        title: 'Mengambil semua anggota aktif',
        sql: `SELECT id, member_code, full_name, email, organization_position, system_role 
              FROM profiles 
              WHERE account_status = 'active' 
              ORDER BY full_name ASC;`
    },
    {
        num: 2,
        title: 'Mengambil anggota berdasarkan bidang',
        sql: `SELECT p.id, p.member_code, p.full_name, p.organization_position, f.field_name 
              FROM profiles p 
              JOIN fields f ON f.id = p.field_id 
              WHERE p.field_id = '${FIELD_ID}' AND p.account_status = 'active';`
    },
    {
        num: 3,
        title: 'Mengambil detail satu anggota',
        sql: `SELECT p.id, p.member_code, p.full_name, p.email, p.phone_number, 
                     p.system_role, p.organization_position, p.account_status, p.joined_at, 
                     f.field_name, coord.full_name AS coordinator_name 
              FROM profiles p 
              LEFT JOIN fields f ON f.id = p.field_id 
              LEFT JOIN profiles coord ON coord.id = f.coordinator_id 
              WHERE p.id = '${MEMBER_YOGA_ID}';`
    },
    {
        num: 4,
        title: 'Mengambil daftar kegiatan dalam satu periode',
        sql: `SELECT id, activity_code, activity_name, activity_location, start_at, end_at, activity_status, attendance_required 
              FROM activities 
              WHERE period_id = '${PERIOD_ID}' 
              ORDER BY start_at ASC;`
    },
    {
        num: 5,
        title: 'Mengambil anggota yang ditugaskan dalam kegiatan tertentu',
        sql: `SELECT aa.id AS assignment_id, p.id AS member_id, p.member_code, p.full_name, 
                     f.field_name, aa.assignment_type, aa.assignment_status 
              FROM activity_assignments aa 
              JOIN profiles p ON p.id = aa.member_id 
              LEFT JOIN fields f ON f.id = p.field_id 
              WHERE aa.activity_id = '${ACTIVITY_PLENO_ID}' AND aa.assignment_status = 'active';`
    },
    {
        num: 6,
        title: 'Mengambil anggota yang wajib hadir tetapi belum melakukan check-in',
        sql: `SELECT p.id, p.member_code, p.full_name, f.field_name, aa.assignment_type 
              FROM activity_assignments aa 
              JOIN profiles p ON p.id = aa.member_id 
              LEFT JOIN fields f ON f.id = p.field_id 
              LEFT JOIN attendances att ON att.activity_assignment_id = aa.id 
              WHERE aa.activity_id = '${ACTIVITY_PLENO_ID}' 
                AND aa.assignment_status = 'active' 
                AND (att.id IS NULL OR att.check_in_at IS NULL);`
    },
    {
        num: 7,
        title: 'Mengambil anggota yang sudah check-in tetapi belum check-out',
        sql: `SELECT p.id, p.member_code, p.full_name, att.check_in_at, att.check_in_status 
              FROM attendances att 
              JOIN activity_assignments aa ON aa.id = att.activity_assignment_id 
              JOIN profiles p ON p.id = aa.member_id 
              WHERE aa.activity_id = '${ACTIVITY_PLENO_ID}' 
                AND att.check_in_at IS NOT NULL 
                AND att.check_out_at IS NULL;`
    },
    {
        num: 8,
        title: 'Mengambil rekap presensi per kegiatan',
        sql: `SELECT a.id, a.activity_code, a.activity_name, 
                     COUNT(aa.id) AS total_assigned, 
                     COUNT(CASE WHEN att.check_in_at IS NOT NULL THEN 1 END) AS total_checked_in, 
                     COUNT(CASE WHEN att.check_in_status = 'on_time' THEN 1 END) AS total_on_time, 
                     COUNT(CASE WHEN att.check_in_status = 'late' THEN 1 END) AS total_late 
              FROM activities a 
              LEFT JOIN activity_assignments aa ON aa.activity_id = a.id AND aa.assignment_status = 'active' 
              LEFT JOIN attendances att ON att.activity_assignment_id = aa.id 
              WHERE a.id = '${ACTIVITY_PLENO_ID}' 
              GROUP BY a.id, a.activity_code, a.activity_name;`
    },
    {
        num: 9,
        title: 'Mengambil riwayat presensi seorang anggota',
        sql: `SELECT act.activity_code, act.activity_name, act.start_at, 
                     att.check_in_at, att.check_out_at, att.check_in_status, att.verification_status 
              FROM attendances att 
              JOIN activity_assignments aa ON aa.id = att.activity_assignment_id 
              JOIN activities act ON act.id = aa.activity_id 
              WHERE aa.member_id = '${MEMBER_YOGA_ID}' 
              ORDER BY act.start_at DESC;`
    },
    {
        num: 10,
        title: 'Mengambil tugas anggota yang belum selesai',
        sql: `SELECT t.id, t.task_title, t.priority, t.due_at, ta.assignment_status 
              FROM task_assignments ta 
              JOIN tasks t ON t.id = ta.task_id 
              WHERE ta.member_id = '${MEMBER_YOGA_ID}' 
                AND ta.assignment_status NOT IN ('completed', 'cancelled');`
    },
    {
        num: 11,
        title: 'Mengambil tugas yang melewati tenggat',
        sql: `SELECT t.id, t.task_title, t.due_at, t.task_status, p.full_name AS assigned_to 
              FROM tasks t 
              LEFT JOIN task_assignments ta ON ta.task_id = t.id 
              LEFT JOIN profiles p ON p.id = ta.member_id 
              WHERE t.period_id = '${PERIOD_ID}' 
                AND t.due_at < clock_timestamp() 
                AND t.task_status NOT IN ('completed', 'cancelled');`
    },
    {
        num: 12,
        title: 'Mengambil evaluasi anggota beserta skor per kriteria',
        sql: `SELECT pr.id, p.full_name AS member_name, rev.full_name AS reviewer_name, 
                     pr.total_weighted_score, ps.criterion_name, ps.score, ps.weighted_points 
              FROM performance_reviews pr 
              JOIN profiles p ON p.id = pr.member_id 
              JOIN profiles rev ON rev.id = pr.reviewer_id 
              LEFT JOIN performance_scores ps ON ps.performance_review_id = pr.id 
              WHERE pr.member_id = '${MEMBER_YOGA_ID}' AND pr.period_id = '${PERIOD_ID}';`
    },
    {
        num: 13,
        title: 'Menghitung skor berbasis sistem maksimal 40 poin',
        sql: `WITH att_stat AS (
                  SELECT 
                      COUNT(aa.id) AS total_assigned, 
                      COUNT(CASE WHEN att.verification_status = 'approved' AND att.check_in_at IS NOT NULL THEN 1 END) AS total_present, 
                      COUNT(CASE WHEN att.check_in_status = 'on_time' THEN 1 END) AS total_ontime 
                  FROM activity_assignments aa 
                  JOIN activities act ON act.id = aa.activity_id 
                  LEFT JOIN attendances att ON att.activity_assignment_id = aa.id 
                  WHERE aa.member_id = '${MEMBER_YOGA_ID}' AND act.period_id = '${PERIOD_ID}' 
              ), task_stat AS (
                  SELECT 
                      COUNT(ta.id) AS total_tasks, 
                      COUNT(CASE WHEN ta.assignment_status = 'completed' THEN 1 END) AS total_completed 
                  FROM task_assignments ta 
                  JOIN tasks t ON t.id = ta.task_id 
                  WHERE ta.member_id = '${MEMBER_YOGA_ID}' AND t.period_id = '${PERIOD_ID}' 
              )
              SELECT 
                  ROUND(((a.total_present::numeric / CASE WHEN a.total_assigned = 0 THEN 1 ELSE a.total_assigned END::numeric) * 20.0)::numeric, 2) AS attendance_points, 
                  ROUND(((a.total_ontime::numeric / CASE WHEN a.total_present = 0 THEN 1 ELSE a.total_present END::numeric) * 10.0)::numeric, 2) AS punctuality_points, 
                  ROUND(((t.total_completed::numeric / CASE WHEN t.total_tasks = 0 THEN 1 ELSE t.total_tasks END::numeric) * 10.0)::numeric, 2) AS task_points, 
                  ROUND((
                      (CASE WHEN a.total_assigned = 0 THEN 20.0 ELSE (a.total_present::numeric / a.total_assigned::numeric) * 20.0 END) + 
                      (CASE WHEN a.total_present = 0 THEN 0.0 ELSE (a.total_ontime::numeric / a.total_present::numeric) * 10.0 END) + 
                      (CASE WHEN t.total_tasks = 0 THEN 10.0 ELSE (t.total_completed::numeric / t.total_tasks::numeric) * 10.0 END)
                  )::numeric, 2) AS total_system_score 
              FROM att_stat a, task_stat t;`
    },
    {
        num: 14,
        title: 'Menghitung evaluasi koordinator maksimal 60 poin',
        sql: `SELECT pr.id, pr.member_id, 
                     pr.communication_score, pr.responsibility_score, pr.teamwork_score, 
                     pr.initiative_score, pr.professionalism_score, 
                     ROUND((
                         ((pr.communication_score / 5.0) * 15.0) + 
                         ((pr.responsibility_score / 5.0) * 15.0) + 
                         ((pr.teamwork_score / 5.0) * 10.0) + 
                         ((pr.initiative_score / 5.0) * 10.0) + 
                         ((pr.professionalism_score / 5.0) * 10.0)
                     )::numeric, 2) AS calculated_coordinator_score, 
                     pr.total_weighted_score 
              FROM performance_reviews pr 
              WHERE pr.member_id = '${MEMBER_YOGA_ID}' AND pr.period_id = '${PERIOD_ID}';`
    },
    {
        num: 15,
        title: 'Menghitung nilai akhir maksimal 100 poin',
        sql: `SELECT fe.id, p.member_code, p.full_name, 
                     fe.system_score, fe.coordinator_score, 
                     (fe.system_score + fe.coordinator_score) AS calculated_final_score, 
                     fe.final_score, fe.certificate_eligibility_status 
              FROM final_evaluations fe 
              JOIN profiles p ON p.id = fe.member_id 
              WHERE fe.period_id = '${PERIOD_ID}' AND fe.member_id = '${MEMBER_YOGA_ID}';`
    },
    {
        num: 16,
        title: 'Mengambil anggota yang sudah layak secara perhitungan tetapi belum disahkan',
        sql: `SELECT fe.id, p.member_code, p.full_name, fe.final_score, fe.evaluation_status 
              FROM final_evaluations fe 
              JOIN profiles p ON p.id = fe.member_id 
              WHERE fe.period_id = '${PERIOD_ID}' 
                AND fe.certificate_eligibility_status = 'eligible' 
                AND fe.evaluation_status != 'approved';`
    },
    {
        num: 17,
        title: 'Mengambil anggota yang masih mempunyai klarifikasi terbuka',
        sql: `SELECT cr.id, p.member_code, p.full_name, cr.request_type, cr.request_status, cr.created_at 
              FROM clarification_requests cr 
              JOIN profiles p ON p.id = cr.member_id 
              WHERE cr.period_id = '${PERIOD_ID}' 
                AND cr.request_status IN ('submitted', 'under_review');`
    },
    {
        num: 18,
        title: 'Mengambil rekap nilai per bidang',
        sql: `SELECT f.id, f.field_name, 
                     COUNT(p.id) AS total_members, 
                     ROUND(AVG(fe.system_score)::numeric, 2) AS avg_system_score, 
                     ROUND(AVG(fe.coordinator_score)::numeric, 2) AS avg_coordinator_score, 
                     ROUND(AVG(fe.final_score)::numeric, 2) AS avg_final_score 
              FROM fields f 
              JOIN profiles p ON p.field_id = f.id 
              LEFT JOIN final_evaluations fe ON fe.member_id = p.id AND fe.period_id = f.period_id 
              WHERE f.period_id = '${PERIOD_ID}' 
              GROUP BY f.id, f.field_name;`
    },
    {
        num: 19,
        title: 'Mengambil jumlah anggota aktif per bidang',
        sql: `SELECT f.id, f.field_code, f.field_name, COUNT(p.id) AS active_member_count 
              FROM fields f 
              LEFT JOIN profiles p ON p.field_id = f.id AND p.account_status = 'active' 
              WHERE f.period_id = '${PERIOD_ID}' 
              GROUP BY f.id, f.field_code, f.field_name 
              ORDER BY active_member_count DESC;`
    },
    {
        num: 20,
        title: 'Mengambil audit log untuk satu anggota',
        sql: `SELECT id, action_type, entity_type, entity_id, old_values, new_values, reason, created_at 
              FROM audit_logs 
              WHERE actor_id = '${MEMBER_YOGA_ID}' OR entity_id = '${MEMBER_YOGA_ID}' 
              ORDER BY created_at DESC;`
    },
    {
        num: 21,
        title: 'Mengambil daftar sertifikat yang telah diterbitkan',
        sql: `SELECT c.certificate_number, p.member_code, p.full_name, fe.final_score, c.issued_at, c.file_path 
              FROM certificates c 
              JOIN final_evaluations fe ON fe.id = c.final_evaluation_id 
              JOIN profiles p ON p.id = fe.member_id 
              WHERE fe.period_id = '${PERIOD_ID}' AND c.certificate_status = 'issued' 
              ORDER BY c.issued_at DESC;`
    },
    {
        num: 22,
        title: 'Mengambil daftar kegiatan dengan jumlah penugasan dan presensi',
        sql: `SELECT a.id, a.activity_code, a.activity_name, a.start_at, 
                     COALESCE(assign.total_assigned, 0) AS total_assignments, 
                     COALESCE(att.total_attended, 0) AS total_attendances 
              FROM activities a 
              LEFT JOIN (
                  SELECT activity_id, COUNT(*) AS total_assigned 
                  FROM activity_assignments 
                  WHERE assignment_status = 'active' 
                  GROUP BY activity_id
              ) assign ON assign.activity_id = a.id 
              LEFT JOIN (
                  SELECT aa.activity_id, COUNT(*) AS total_attended 
                  FROM attendances att 
                  JOIN activity_assignments aa ON aa.id = att.activity_assignment_id 
                  GROUP BY aa.activity_id
              ) att ON att.activity_id = a.id 
              WHERE a.period_id = '${PERIOD_ID}' 
              ORDER BY a.start_at ASC;`
    },
    {
        num: 23,
        title: 'Mengambil daftar anggota yang tidak ditugaskan dalam kegiatan tertentu',
        sql: `SELECT p.id, p.member_code, p.full_name, f.field_name 
              FROM profiles p 
              LEFT JOIN fields f ON f.id = p.field_id 
              WHERE p.account_status = 'active' 
                AND p.id NOT IN (
                    SELECT member_id 
                    FROM activity_assignments 
                    WHERE activity_id = '${ACTIVITY_PLENO_ID}' AND assignment_status = 'active'
                ) 
              ORDER BY p.full_name ASC;`
    },
    {
        num: 24,
        title: 'Mengambil riwayat perubahan penugasan',
        sql: `SELECT ah.id, aa.activity_id, p.full_name AS member_name, 
                     ah.previous_status, ah.new_status, actor.full_name AS changed_by, 
                     ah.change_reason, ah.created_at 
              FROM assignment_history ah 
              JOIN activity_assignments aa ON aa.id = ah.activity_assignment_id 
              JOIN profiles p ON p.id = aa.member_id 
              JOIN profiles actor ON actor.id = ah.action_by 
              ORDER BY ah.created_at DESC;`
    },
    {
        num: 25,
        title: 'Mengambil anggota yang evaluasinya belum lengkap',
        sql: `SELECT p.id, p.member_code, p.full_name, f.field_name, 
                     pr.review_status AS coordinator_review_status, 
                     fe.evaluation_status AS final_evaluation_status 
              FROM profiles p 
              LEFT JOIN fields f ON f.id = p.field_id 
              LEFT JOIN performance_reviews pr ON pr.member_id = p.id AND pr.period_id = '${PERIOD_ID}' 
              LEFT JOIN final_evaluations fe ON fe.member_id = p.id AND fe.period_id = '${PERIOD_ID}' 
              WHERE p.account_status = 'active' 
                AND (pr.id IS NULL OR pr.review_status != 'approved' OR fe.id IS NULL OR fe.evaluation_status != 'approved');`
    }
];

let passCount = 0;
for (const q of queries) {
    try {
        const res = await client.query(q.sql);
        console.log(`[PASS] Query #${q.num} - ${q.title} (Rows: ${res.rows.length})`);
        passCount++;
    } catch (err) {
        console.error(`[FAIL] Query #${q.num} - ${q.title}:`, err.message);
    }
}

console.log(`\n=== HASIL: ${passCount}/25 QUERY BERHASIL DIUJI TANPA ERROR ===`);
await client.end();
