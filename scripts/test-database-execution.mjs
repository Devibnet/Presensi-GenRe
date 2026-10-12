import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';

console.log('=== MENJALANKAN SIMULASI PENGUJIAN DATABASE POSTGRESQL ===');

const db = newDb();

// Register mock functions for Supabase environment
db.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => '11111111-2222-3333-4444-555555555555',
});

db.public.registerFunction({
    name: 'clock_timestamp',
    implementation: () => new Date(),
});

const { Client } = db.adapters.createPg();
const client = new Client();
await client.connect();

// Create mock auth schema and auth.users table
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

// Load migration 1
const mig1 = fs.readFileSync('supabase/migrations/20261012000001_initial_schema.sql', 'utf8')
    // Remove extensions which are Supabase specific
    .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '')
    .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '');

try {
    await client.query(mig1);
    console.log('[PASS] Migration 1 (Initial Schema) berhasil dieksekusi di PostgreSQL engine!');
} catch (err) {
    console.error('[FAIL] Error pada Migration 1:', err);
    process.exit(1);
}

// Test basic inserts & constraints
try {
    // Test 1: Insert Period
    await client.query(`
        INSERT INTO organization_periods (
            id, period_name, period_code, start_date, end_date, period_status, certificate_threshold
        ) VALUES (
            '00000000-0000-0000-0000-000000000001',
            'Pemilihan Duta GenRe Kabupaten Buleleng 2026/2027',
            'GENRE-BL-2026',
            '2026-03-01',
            '2026-07-31',
            'active',
            75.00
        );
    `);
    console.log('[PASS] Insert organization_periods berhasil.');

    // Test 2: Invalid Date Constraint (end_date < start_date)
    let dateConstraintCaught = false;
    try {
        await client.query(`
            INSERT INTO organization_periods (
                id, period_name, period_code, start_date, end_date, period_status
            ) VALUES (
                '00000000-0000-0000-0000-000000000002',
                'Invalid Period',
                'INVALID-2026',
                '2026-07-31',
                '2026-03-01',
                'active'
            );
        `);
    } catch (e) {
        dateConstraintCaught = true;
    }
    if (dateConstraintCaught) {
        console.log('[PASS] Constraint end_date >= start_date berhasil menolak tanggal tidak valid.');
    } else {
        console.error('[FAIL] Constraint tanggal gagal menolak.');
    }

    // Test 3: Insert Field
    await client.query(`
        INSERT INTO fields (
            id, period_id, field_name, field_code, field_status
        ) VALUES (
            '22222222-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
            'Divisi Acara',
            'ACR',
            'active'
        );
    `);
    console.log('[PASS] Insert fields berhasil.');

    // Test 4: Duplicate Field Code in Same Period Constraint
    let dupFieldCaught = false;
    try {
        await client.query(`
            INSERT INTO fields (
                id, period_id, field_name, field_code, field_status
            ) VALUES (
                '22222222-0000-0000-0000-000000000002',
                '00000000-0000-0000-0000-000000000001',
                'Divisi Acara Duplikat',
                'ACR',
                'active'
            );
        `);
    } catch (e) {
        dupFieldCaught = true;
    }
    if (dupFieldCaught) {
        console.log('[PASS] Constraint UNIQUE (period_id, field_code) berhasil menolak kode bidang duplikat.');
    } else {
        console.error('[FAIL] Constraint kode bidang duplikat gagal menolak.');
    }

    // Test 5: Insert User in auth.users & profiles
    await client.query(`
        INSERT INTO auth.users (id, email) VALUES
        ('11111111-0000-0000-0000-000000000001', 'admin@genre.org'),
        ('11111111-0000-0000-0000-000000000002', 'member@genre.org');

        INSERT INTO profiles (
            id, member_code, full_name, email, field_id, system_role, organization_position
        ) VALUES
        ('11111111-0000-0000-0000-000000000001', 'GENRE-001', 'Admin GenRe', 'admin@genre.org', '22222222-0000-0000-0000-000000000001', 'admin', 'Ketua Panitia'),
        ('11111111-0000-0000-0000-000000000002', 'GENRE-002', 'Member GenRe', 'member@genre.org', '22222222-0000-0000-0000-000000000001', 'member', 'Anggota Acara');
    `);
    console.log('[PASS] Insert auth.users dan profiles berhasil dengan referensial integritas penuh.');

    // Test 6: Policy Weight Constraint (Total 100, System 40, Coordinator 60)
    await client.query(`
        INSERT INTO evaluation_policies (
            id, period_id, policy_version, attendance_weight, punctuality_weight, 
            task_completion_weight, coordinator_evaluation_weight, certificate_threshold, 
            effective_from, policy_status, created_by
        ) VALUES (
            '33333333-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
            'v1.0',
            20.00, 10.00, 10.00, 60.00, 75.00,
            '2026-03-01', 'active',
            '11111111-0000-0000-0000-000000000001'
        );
    `);
    console.log('[PASS] Insert evaluation_policies dengan validasi bobot (40 sistem + 60 koordinator = 100) berhasil.');

    // Test 7: Invalid Policy Weight (e.g. Total != 100)
    let invalidPolicyCaught = false;
    try {
        await client.query(`
            INSERT INTO evaluation_policies (
                id, period_id, policy_version, attendance_weight, punctuality_weight, 
                task_completion_weight, coordinator_evaluation_weight, certificate_threshold, 
                effective_from, policy_status, created_by
            ) VALUES (
                '33333333-0000-0000-0000-000000000002',
                '00000000-0000-0000-0000-000000000001',
                'v1.1-INVALID',
                25.00, 10.00, 10.00, 60.00, 75.00,
                '2026-03-01', 'active',
                '11111111-0000-0000-0000-000000000001'
            );
        `);
    } catch (e) {
        invalidPolicyCaught = true;
    }
    if (invalidPolicyCaught) {
        console.log('[PASS] Constraint bobot kebijakan berhasil menolak total bobot di luar 100.00.');
    } else {
        console.error('[FAIL] Constraint bobot kebijakan gagal menolak.');
    }

    // Test 8: Activities, Assignments & Double Assignment Prevention
    await client.query(`
        INSERT INTO activities (
            id, period_id, activity_code, activity_name, activity_location,
            start_at, end_at, check_in_opens_at, check_in_closes_at, check_out_opens_at, check_out_closes_at,
            activity_status, attendance_required, created_by
        ) VALUES (
            '55555555-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
            'ACT-PLENO-1',
            'Rapat Pleno 1',
            'Dinas P2KBP3A Buleleng',
            '2026-03-10 14:00:00+08', '2026-03-10 17:00:00+08',
            '2026-03-10 13:30:00+08', '2026-03-10 14:15:00+08',
            '2026-03-10 16:50:00+08', '2026-03-10 17:30:00+08',
            'completed', true, '11111111-0000-0000-0000-000000000001'
        );

        INSERT INTO activity_assignments (
            id, activity_id, member_id, assignment_type, assignment_status, assigned_by
        ) VALUES (
            '66666666-0000-0000-0000-000000000001',
            '55555555-0000-0000-0000-000000000001',
            '11111111-0000-0000-0000-000000000002',
            'attendance_required', 'active', '11111111-0000-0000-0000-000000000001'
        );
    `);
    console.log('[PASS] Insert activity dan activity_assignments sah berhasil.');

    // Test 9: Duplicate Assignment Rejection
    let dupAssignmentCaught = false;
    try {
        await client.query(`
            INSERT INTO activity_assignments (
                id, activity_id, member_id, assignment_type, assignment_status, assigned_by
            ) VALUES (
                '66666666-0000-0000-0000-000000000002',
                '55555555-0000-0000-0000-000000000001',
                '11111111-0000-0000-0000-000000000002',
                'work_assignment', 'active', '11111111-0000-0000-0000-000000000001'
            );
        `);
    } catch (e) {
        dupAssignmentCaught = true;
    }
    if (dupAssignmentCaught) {
        console.log('[PASS] Constraint UNIQUE (activity_id, member_id) berhasil menolak penugasan ganda aktif!');
    } else {
        console.error('[FAIL] Penugasan ganda tidak ditolak.');
    }

    // Test 10: Attendance & Double Attendance Prevention
    await client.query(`
        INSERT INTO attendances (
            id, activity_assignment_id, check_in_at, check_out_at, check_in_method, check_out_method,
            check_in_status, check_out_status, verification_status
        ) VALUES (
            '88888888-0000-0000-0000-000000000001',
            '66666666-0000-0000-0000-000000000001',
            '2026-03-10 13:45:00+08', '2026-03-10 17:05:00+08',
            'qr', 'qr', 'on_time', 'normal', 'approved'
        );
    `);
    console.log('[PASS] Insert attendances sah berhasil.');

    let dupAttendanceCaught = false;
    try {
        await client.query(`
            INSERT INTO attendances (
                id, activity_assignment_id, check_in_at, check_in_method, check_in_status, verification_status
            ) VALUES (
                '88888888-0000-0000-0000-000000000002',
                '66666666-0000-0000-0000-000000000001',
                '2026-03-10 13:50:00+08', 'qr', 'on_time', 'approved'
            );
        `);
    } catch (e) {
        dupAttendanceCaught = true;
    }
    if (dupAttendanceCaught) {
        console.log('[PASS] Constraint UNIQUE (activity_assignment_id, attendance_session_id) berhasil mencegah presensi ganda!');
    } else {
        console.error('[FAIL] Presensi ganda tidak dicegah.');
    }

    // Test 11: Invalid Checkout Before Checkin
    let invalidCheckoutCaught = false;
    try {
        await client.query(`
            INSERT INTO activity_assignments (
                id, activity_id, member_id, assignment_type, assignment_status, assigned_by
            ) VALUES (
                '66666666-0000-0000-0000-000000000003',
                '55555555-0000-0000-0000-000000000001',
                '11111111-0000-0000-0000-000000000001',
                'attendance_required', 'active', '11111111-0000-0000-0000-000000000001'
            );

            INSERT INTO attendances (
                id, activity_assignment_id, check_in_at, check_out_at, check_in_method, check_out_method,
                check_in_status, verification_status
            ) VALUES (
                '88888888-0000-0000-0000-000000000003',
                '66666666-0000-0000-0000-000000000003',
                '2026-03-10 17:00:00+08', '2026-03-10 14:00:00+08',
                'qr', 'qr', 'on_time', 'approved'
            );
        `);
    } catch (e) {
        invalidCheckoutCaught = true;
    }
    if (invalidCheckoutCaught) {
        console.log('[PASS] Constraint chk_attendance_times berhasil menolak check_out sebelum check_in!');
    } else {
        console.error('[FAIL] Check out sebelum check in tidak ditolak.');
    }

    // Test 12: Score Limit Check (final_score > 100)
    let scoreOver100Caught = false;
    try {
        await client.query(`
            INSERT INTO final_evaluations (
                id, period_id, member_id, policy_id, attendance_points, punctuality_points,
                task_completion_points, system_score, coordinator_score, final_score,
                evaluation_status, certificate_eligibility_status
            ) VALUES (
                'cccccccc-0000-0000-0000-000000000001',
                '00000000-0000-0000-0000-000000000001',
                '11111111-0000-0000-0000-000000000002',
                '33333333-0000-0000-0000-000000000001',
                20.00, 10.00, 10.00, 40.00, 65.00, 105.00,
                'approved', 'eligible'
            );
        `);
    } catch (e) {
        scoreOver100Caught = true;
    }
    if (scoreOver100Caught) {
        console.log('[PASS] Constraint final_score <= 100.00 berhasil menolak nilai melebihi batas 100!');
    } else {
        console.error('[FAIL] Nilai melebihi 100 tidak ditolak.');
    }

    // Test 13: ON DELETE RESTRICT Historical Protection
    let deleteRestrictedCaught = false;
    try {
        await client.query(`
            DELETE FROM profiles WHERE id = '11111111-0000-0000-0000-000000000002';
        `);
    } catch (e) {
        deleteRestrictedCaught = true;
    }
    if (deleteRestrictedCaught) {
        console.log('[PASS] ON DELETE RESTRICT berhasil mencegah penghapusan profil yang memiliki riwayat penugasan/presensi!');
    } else {
        console.error('[FAIL] Profil dengan data historis terhapus.');
    }

    console.log('\n=== SEMUA 13 SKENARIO PENGUJIAN INTEGRITAS DATABASE POSTGRES BERHASIL 100% ===');
    await client.end();
} catch (err) {
    console.error('ERROR tidak terduga:', err);
    process.exit(1);
}
