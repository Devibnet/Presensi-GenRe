import fs from 'fs';
import path from 'path';

console.log('--- VALIDATING GENRE ATTENDANCE SQL SCHEMA ---');

const migrationDir = path.resolve('supabase/migrations');
const seedFile = path.resolve('supabase/seed.sql');

const migrationFiles = [
    '20261012000001_initial_schema.sql',
    '20261012000002_indexes_and_triggers.sql',
    '20261012000003_functions_and_views.sql',
    '20261012000004_row_level_security.sql',
    '20261013000001_add_genre_2026_fields.sql',
    '20261013000002_evaluation_permissions.sql'
];

let allSchemaSql = '';
for (const file of migrationFiles) {
    const fullPath = path.join(migrationDir, file);
    if (!fs.existsSync(fullPath)) {
        console.error(`ERROR: Migration file missing: ${file}`);
        process.exit(1);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    allSchemaSql += '\n' + content;
    console.log(`[OK] Loaded migration: ${file} (${content.length} bytes)`);
}

if (!fs.existsSync(seedFile)) {
    console.error(`ERROR: Seed file missing: ${seedFile}`);
    process.exit(1);
}
const seedContent = fs.readFileSync(seedFile, 'utf8');
console.log(`[OK] Loaded seed file: ${seedFile} (${seedContent.length} bytes)`);

// Check tables created
const tableMatches = [...allSchemaSql.matchAll(/CREATE\s+TABLE\s+([a-zA-Z0-9_]+)/gi)].map(m => m[1]);
console.log(`Total Tables Created: ${tableMatches.length}`);
console.log('Tables:', tableMatches.join(', '));

const expectedTables = [
    'organization_periods',
    'fields',
    'profiles',
    'activities',
    'activity_fields',
    'activity_assignments',
    'assignment_history',
    'tasks',
    'task_assignments',
    'attendance_sessions',
    'attendances',
    'manual_attendance_requests',
    'evaluation_policies',
    'evaluation_criteria',
    'performance_reviews',
    'performance_scores',
    'final_evaluations',
    'certificates',
    'clarification_requests',
    'notifications',
    'audit_logs'
];

const missingTables = expectedTables.filter(t => !tableMatches.includes(t));
if (missingTables.length > 0) {
    console.error('ERROR: Missing expected tables:', missingTables);
    process.exit(1);
} else {
    console.log('[PASS] All 21 expected core and supporting tables are present.');
}

// Check Views
const viewMatches = [...allSchemaSql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([a-zA-Z0-9_]+)/gi)].map(m => m[1]);
console.log(`Total Views Created: ${viewMatches.length}`);
console.log('Views:', viewMatches.join(', '));

// Check RLS enabled
const rlsMatches = [...allSchemaSql.matchAll(/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map(m => m[1]);
console.log(`Total Tables with RLS Enabled: ${rlsMatches.length}`);

const missingRls = expectedTables.filter(t => !rlsMatches.includes(t));
if (missingRls.length > 0) {
    console.error('ERROR: Missing RLS on tables:', missingRls);
    process.exit(1);
} else {
    console.log('[PASS] All 21 tables have RLS enabled.');
}

console.log('--- ALL BASIC SCHEMA INTEGRITY CHECKS PASSED ---');
