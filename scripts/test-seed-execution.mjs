import { newDb } from 'pg-mem';
import fs from 'fs';

console.log('=== PENGUJIAN EKSEKUSI SEED DATA SUPABASE ===');

const db = newDb();

import crypto from 'crypto';

db.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => crypto.randomUUID(),
});

db.public.registerFunction({
    name: 'clock_timestamp',
    implementation: () => new Date(),
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
console.log('[PASS] Schema DDL loaded successfully.');

// Read and execute seed.sql
const seedSql = fs.readFileSync('supabase/seed.sql', 'utf8');

try {
    await client.query(seedSql);
    console.log('[PASS] supabase/seed.sql executed completely without any error!');

    // Verify row counts
    const resPeriods = await client.query('SELECT count(*) FROM organization_periods;');
    const resProfiles = await client.query('SELECT count(*) FROM profiles;');
    const resFields = await client.query('SELECT count(*) FROM fields;');
    const resActivities = await client.query('SELECT count(*) FROM activities;');
    const resAssignments = await client.query('SELECT count(*) FROM activity_assignments;');
    const resAttendances = await client.query('SELECT count(*) FROM attendances;');
    const resTasks = await client.query('SELECT count(*) FROM tasks;');
    const resReviews = await client.query('SELECT count(*) FROM performance_reviews;');
    const resFinalEval = await client.query('SELECT count(*) FROM final_evaluations;');
    const resCerts = await client.query('SELECT count(*) FROM certificates;');

    console.log(`[DATA SUMMARY]:
- Periode: ${resPeriods.rows[0].count}
- Profiles: ${resProfiles.rows[0].count}
- Fields/Bidang: ${resFields.rows[0].count}
- Kegiatan: ${resActivities.rows[0].count}
- Penugasan: ${resAssignments.rows[0].count}
- Presensi: ${resAttendances.rows[0].count}
- Tugas: ${resTasks.rows[0].count}
- Review Kinerja: ${resReviews.rows[0].count}
- Evaluasi Final: ${resFinalEval.rows[0].count}
- Sertifikat: ${resCerts.rows[0].count}`);

    await client.end();
} catch (err) {
    console.error('[FAIL] Error saat eksekusi seed.sql:', err);
    process.exit(1);
}
