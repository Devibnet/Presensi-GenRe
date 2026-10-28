import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => l.trim().split('='))
);

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function syncAll() {
  console.log('--- MENJALANKAN SINKRONISASI PENILAIAN SELURUH PANITIA ---');
  const t0 = performance.now();

  // 1. Dapatkan periode aktif
  const { data: periodData } = await supabase
    .from('organization_periods')
    .select('id')
    .eq('period_status', 'active')
    .maybeSingle();
  const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

  // 2. Dapatkan policy threshold
  let policyId = '44444444-0000-0000-0000-000000000001';
  let threshold = 75.0;
  const { data: policyData } = await supabase
    .from('evaluation_policies')
    .select('id, certificate_threshold')
    .eq('period_id', periodId)
    .maybeSingle();

  if (policyData) {
    policyId = policyData.id;
    threshold = Number(policyData.certificate_threshold || 75.0);
  }

  // 3. Dapatkan seluruh profil anggota aktif
  const { data: members, error: mErr } = await supabase
    .from('profiles')
    .select('id, full_name, member_code')
    .eq('account_status', 'active');

  if (mErr) {
    console.error('Error fetching members:', mErr);
    process.exit(1);
  }

  // 4. Ambil seluruh penugasan & presensi
  const { data: assignments } = await supabase
    .from('activity_assignments')
    .select(`
      id,
      member_id,
      assignment_status,
      activity:activities!activity_assignments_activity_id_fkey(
        id,
        period_id,
        activity_status,
        attendance_required,
        start_at,
        end_at
      ),
      attendances(
        id,
        check_in_at,
        check_out_at,
        check_in_status,
        check_out_status,
        check_out_method,
        attendance_note,
        verification_status
      )
    `)
    .neq('assignment_status', 'cancelled');

  const asgMap = new Map();
  (assignments || []).forEach((asg) => {
    if (!asgMap.has(asg.member_id)) asgMap.set(asg.member_id, []);
    asgMap.get(asg.member_id).push(asg);
  });

  // 5. Ambil performance reviews
  const { data: reviews } = await supabase
    .from('performance_reviews')
    .select('member_id, total_weighted_score, review_status')
    .eq('period_id', periodId);

  const reviewMap = new Map();
  (reviews || []).forEach((r) => reviewMap.set(r.member_id, r));

  // 6. Ambil sertifikat terbit
  const { data: existingEvals } = await supabase
    .from('final_evaluations')
    .select('id, member_id')
    .eq('period_id', periodId);

  const evalIdMap = new Map();
  (existingEvals || []).forEach((e) => evalIdMap.set(e.member_id, e.id));

  const { data: certificates } = await supabase
    .from('certificates')
    .select('id, final_evaluation_id, certificate_number, certificate_status');

  const certMap = new Map();
  (certificates || []).forEach((c) => certMap.set(c.final_evaluation_id, c));

  // 7. Ambil klarifikasi terbuka
  const { data: openClars } = await supabase
    .from('clarification_requests')
    .select('id, member_id')
    .eq('period_id', periodId)
    .in('request_status', ['submitted', 'under_review']);

  const openClarSet = new Set((openClars || []).map((c) => c.member_id));

  const now = new Date();
  const nowIso = now.toISOString();
  const upsertPayloads = [];

  for (const m of members) {
    const mAsgs = asgMap.get(m.id) || [];
    const eligible = mAsgs.filter((asg) => {
      const act = asg.activity;
      if (!act) return false;
      if (act.period_id && act.period_id !== periodId) return false;
      if (act.attendance_required === false) return false;
      if (act.activity_status === 'cancelled' || act.activity_status === 'draft') return false;
      return (
        act.activity_status === 'completed' ||
        act.activity_status === 'ongoing' ||
        (act.start_at && new Date(act.start_at) <= now)
      );
    });

    const totalAssigned = eligible.length;
    let presentCount = 0;
    let onTimeCount = 0;
    let checkoutCount = 0;

    eligible.forEach((asg) => {
      if (asg.assignment_status === 'excused') {
        presentCount++;
        onTimeCount++;
        checkoutCount++;
      } else {
        const approvedAtt = (asg.attendances || []).find(
          (a) => a.verification_status === 'approved'
        );
        if (approvedAtt && (approvedAtt.check_in_status === 'excused' || approvedAtt.check_in_at)) {
          presentCount++;
          if (approvedAtt.check_in_status === 'on_time' || approvedAtt.check_in_status === 'excused') {
            onTimeCount++;
          }
          if (
            approvedAtt.check_out_at ||
            approvedAtt.check_in_status === 'excused' ||
            approvedAtt.check_out_status === 'normal' ||
            approvedAtt.check_out_method === 'manual' ||
            approvedAtt.check_out_method === 'qr' ||
            (approvedAtt.attendance_note && approvedAtt.attendance_note.toLowerCase().includes('disetujui'))
          ) {
            checkoutCount++;
          }
        }
      }
    });

    let attPoints = 0.0;
    let puncPoints = 0.0;
    let checkoutPoints = 0.0;

    if (totalAssigned > 0) {
      attPoints = Math.min(20.0, Math.max(0.0, Number(((presentCount / totalAssigned) * 20.0).toFixed(2))));
      puncPoints = Math.min(10.0, Math.max(0.0, Number(((onTimeCount / totalAssigned) * 10.0).toFixed(2))));
      checkoutPoints = Math.min(10.0, Math.max(0.0, Number(((checkoutCount / totalAssigned) * 10.0).toFixed(2))));
    }

    const systemScore = Math.min(40.0, Math.max(0.0, Number((attPoints + puncPoints + checkoutPoints).toFixed(2))));
    const rev = reviewMap.get(m.id);
    const coordScore = Math.min(60.0, Math.max(0.0, Number(rev?.total_weighted_score || 0.0)));
    const finalScore = Math.min(100.0, Math.max(0.0, Number((systemScore + coordScore).toFixed(2))));
    const hasReview = rev?.review_status === 'approved' && coordScore > 0;

    const evalId = evalIdMap.get(m.id);
    const certRow = evalId ? certMap.get(evalId) : null;
    const hasOpenClar = openClarSet.has(m.id);

    let evalStatus = 'calculating';
    let certEligibility = 'pending';

    if (hasOpenClar) {
      evalStatus = 'clarification_open';
      certEligibility = certRow?.id ? 'eligible' : 'pending';
    } else if (certRow?.id) {
      evalStatus = 'approved';
      certEligibility = 'eligible';
    } else if (hasReview) {
      evalStatus = 'pending_approval';
      certEligibility = finalScore >= threshold ? 'eligible' : 'ineligible';
    } else {
      evalStatus = 'calculating';
      certEligibility = 'pending';
    }

    upsertPayloads.push({
      period_id: periodId,
      member_id: m.id,
      policy_id: policyId,
      attendance_points: attPoints,
      punctuality_points: puncPoints,
      task_completion_points: checkoutPoints,
      system_score: systemScore,
      coordinator_score: coordScore,
      final_score: finalScore,
      evaluation_status: evalStatus,
      certificate_eligibility_status: certEligibility,
      calculated_at: nowIso,
      updated_at: nowIso,
    });
  }

  // 8. Eksekusi batch upsert ke tabel final_evaluations
  const { error: upsertErr } = await supabase
    .from('final_evaluations')
    .upsert(upsertPayloads, { onConflict: 'period_id,member_id' });

  if (upsertErr) {
    console.error('Error saat upsert evaluations:', upsertErr);
    process.exit(1);
  }

  const t1 = performance.now();
  console.log(`[SUKSES] Berhasil sinkronisasi evaluasi untuk ${upsertPayloads.length} panitia (${(t1 - t0).toFixed(2)} ms).`);

  // Verifikasi Audry
  const { data: audryEval } = await supabase
    .from('final_evaluations')
    .select('*, member:profiles!final_evaluations_member_id_fkey(full_name, member_code)')
    .eq('member_id', 'f8ff3c38-8e12-44ee-8bb3-4eee8b02ded4')
    .single();

  console.log('\n--- HASIL DATA AUDRY SETELAH PERBAIKAN ---');
  console.log({
    nama: audryEval?.member?.full_name,
    kode: audryEval?.member?.member_code,
    skor_sistem: audryEval?.system_score,
    in: audryEval?.attendance_points,
    tepat: audryEval?.punctuality_points,
    out: audryEval?.task_completion_points,
    skor_koordinator: audryEval?.coordinator_score,
    nilai_akhir: audryEval?.final_score,
    status_kelayakan: audryEval?.certificate_eligibility_status,
  });

  // Verifikasi apakah masih ada skor sistem > 0 saat tidak ada kegiatan aktif
  const { data: nonZero } = await supabase
    .from('final_evaluations')
    .select('id, system_score')
    .gt('system_score', 0);

  console.log('\nJumlah panitia dengan skor sistem > 0:', nonZero?.length || 0);
}

syncAll();
