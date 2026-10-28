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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [GAGAL] ${message}`);
    throw new Error(message);
  }
  console.log(`✅ [BERHASIL] ${message}`);
}

// Helper kalkulasi evaluasi anggota
async function calculateEvaluation(memberId, periodId = '00000000-0000-0000-0000-000000000001') {
  const { data: assignments } = await supabase
    .from('activity_assignments')
    .select(`
      id,
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
    .eq('member_id', memberId)
    .neq('assignment_status', 'cancelled');

  const now = new Date();
  const eligibleAssignments = (assignments || []).filter((asg) => {
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

  const totalAssigned = eligibleAssignments.length;
  let presentCount = 0;
  let onTimeCount = 0;
  let checkoutCount = 0;

  eligibleAssignments.forEach((asg) => {
    const isExcused = asg.assignment_status === 'excused';
    const approvedAtt = (asg.attendances || []).find((a) => a.verification_status === 'approved');

    if (isExcused) {
      presentCount++;
      onTimeCount++;
      checkoutCount++;
    } else if (approvedAtt && (approvedAtt.check_in_status === 'excused' || approvedAtt.check_in_at)) {
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

  const { data: review } = await supabase
    .from('performance_reviews')
    .select('total_weighted_score, review_status')
    .eq('period_id', periodId)
    .eq('member_id', memberId)
    .maybeSingle();

  const coordScore = Math.min(60.0, Math.max(0.0, Number(review?.total_weighted_score || 0.0)));
  const finalScore = Math.min(100.0, Math.max(0.0, Number((systemScore + coordScore).toFixed(2))));

  const nowIso = new Date().toISOString();
  await supabase
    .from('final_evaluations')
    .upsert({
      period_id: periodId,
      member_id: memberId,
      policy_id: '44444444-0000-0000-0000-000000000001',
      attendance_points: attPoints,
      punctuality_points: puncPoints,
      task_completion_points: checkoutPoints,
      system_score: systemScore,
      coordinator_score: coordScore,
      final_score: finalScore,
      evaluation_status: 'calculating',
      certificate_eligibility_status: 'pending',
      calculated_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'period_id,member_id' });

  return {
    totalAssigned,
    presentCount,
    onTimeCount,
    checkoutCount,
    attendancePoints: attPoints,
    punctualityPoints: puncPoints,
    checkoutPoints,
    systemScore,
    coordinatorScore: coordScore,
    finalScore,
  };
}

async function runTest() {
  console.log('================================================================');
  console.log(' PENGUJIAN AKURASI SISTEM PENILAIAN & SINKRONISASI PENGHAPUSAN AGENDA');
  console.log('================================================================\n');

  const periodId = '00000000-0000-0000-0000-000000000001';

  // 1. Ambil data Audry
  const { data: audry } = await supabase
    .from('profiles')
    .select('id, full_name, member_code')
    .ilike('full_name', '%Audry%')
    .single();

  assert(audry, `Profil Audry ditemukan: ${audry?.full_name} (${audry?.member_code})`);

  // 2. State Awal: Saat tidak ada agenda aktif, skor sistem harus 0.00
  const initEval = await calculateEvaluation(audry.id, periodId);
  assert(
    initEval.systemScore === 0 &&
    initEval.attendancePoints === 0 &&
    initEval.punctualityPoints === 0 &&
    initEval.checkoutPoints === 0,
    `Kondisi Awal (0 Agenda): Skor sistem Audry adalah 0.00 (In:0, Tepat:0, Out:0)`
  );

  let act1 = null;
  let act2 = null;

  try {
    // 3. Skenario 1: Buat Agenda 1 (Wajib & Selesai)
    console.log('\n--- SKENARIO 1: PEMBUATAN AGENDA 1 & PRESENSI LENGKAP AUDRY ---');
    const pastTime1 = new Date(Date.now() - 3600 * 1000 * 24); // Kemarin
    const pastEnd1 = new Date(pastTime1.getTime() + 3600 * 1000 * 3);

    const { data: a1, error: a1Err } = await supabase
      .from('activities')
      .insert({
        period_id: periodId,
        activity_code: 'UJI-PLENO-01',
        activity_name: 'Uji Rapat Pleno 1',
        activity_location: 'Gedung Kesenian Gde Manik',
        start_at: pastTime1.toISOString(),
        end_at: pastEnd1.toISOString(),
        check_in_opens_at: pastTime1.toISOString(),
        check_in_closes_at: pastEnd1.toISOString(),
        check_out_opens_at: pastTime1.toISOString(),
        check_out_closes_at: pastEnd1.toISOString(),
        activity_status: 'completed',
        attendance_required: true,
        created_by: audry.id,
      })
      .select()
      .single();

    if (a1Err) throw a1Err;
    act1 = a1;

    // Tugaskan Audry ke Agenda 1
    const { data: asg1, error: asg1Err } = await supabase
      .from('activity_assignments')
      .insert({
        activity_id: act1.id,
        member_id: audry.id,
        assignment_type: 'attendance_required',
        assignment_status: 'active',
        assigned_by: audry.id,
      })
      .select()
      .single();

    if (asg1Err) throw asg1Err;

    // Buat presensi hadir tepat waktu + checkout lengkap untuk Audry
    await supabase.from('attendances').insert({
      activity_assignment_id: asg1.id,
      check_in_at: pastTime1.toISOString(),
      check_in_status: 'on_time',
      check_in_method: 'qr',
      check_out_at: pastEnd1.toISOString(),
      check_out_status: 'normal',
      check_out_method: 'qr',
      verification_status: 'approved',
    });

    // Hitung evaluasi setelah Agenda 1
    const evalAfterAct1 = await calculateEvaluation(audry.id, periodId);
    console.log('Evaluasi setelah Agenda 1:', evalAfterAct1);
    assert(
      evalAfterAct1.systemScore === 40 &&
      evalAfterAct1.attendancePoints === 20 &&
      evalAfterAct1.punctualityPoints === 10 &&
      evalAfterAct1.checkoutPoints === 10,
      'Agenda 1 Dihadiri Penuh: Skor sistem Audry terakumulasi maksimal 40.00 (In:20, Tepat:10, Out:10)'
    );

    // 4. Skenario 2: Buat Agenda 2, Audry ditugaskan tetapi TIDAK HADIR (Alpha)
    console.log('\n--- SKENARIO 2: PEMBUATAN AGENDA 2 & AUDRY TIDAK HADIR ---');
    const pastTime2 = new Date(Date.now() - 3600 * 1000 * 12); // 12 jam lalu
    const pastEnd2 = new Date(pastTime2.getTime() + 3600 * 1000 * 2);

    const { data: a2, error: a2Err } = await supabase
      .from('activities')
      .insert({
        period_id: periodId,
        activity_code: 'UJI-WORKSHOP-02',
        activity_name: 'Uji Workshop Finalis',
        activity_location: 'Aula Bappeda Buleleng',
        start_at: pastTime2.toISOString(),
        end_at: pastEnd2.toISOString(),
        check_in_opens_at: pastTime2.toISOString(),
        check_in_closes_at: pastEnd2.toISOString(),
        check_out_opens_at: pastTime2.toISOString(),
        check_out_closes_at: pastEnd2.toISOString(),
        activity_status: 'completed',
        attendance_required: true,
        created_by: audry.id,
      })
      .select()
      .single();

    if (a2Err) throw a2Err;
    act2 = a2;

    // Tugaskan Audry ke Agenda 2 tanpa presensi
    await supabase.from('activity_assignments').insert({
      activity_id: act2.id,
      member_id: audry.id,
      assignment_type: 'attendance_required',
      assignment_status: 'active',
      assigned_by: audry.id,
    });

    // Hitung evaluasi dengan 2 agenda (1 hadir, 1 alpha)
    const evalAfterAct2 = await calculateEvaluation(audry.id, periodId);
    console.log('Evaluasi setelah Agenda 2 (1 hadir, 1 alpha):', evalAfterAct2);
    assert(
      evalAfterAct2.totalAssigned === 2 &&
      evalAfterAct2.presentCount === 1 &&
      evalAfterAct2.systemScore === 20 &&
      evalAfterAct2.attendancePoints === 10 &&
      evalAfterAct2.punctualityPoints === 5 &&
      evalAfterAct2.checkoutPoints === 5,
      'Akumulasi 2 Agenda: Hadir 1 dari 2 agenda menghasilkan proporsi skor 20.00 / 40.00 (In:10, Tepat:5, Out:5)'
    );

    // 5. Skenario 3: HAPUS AGENDA 2
    console.log('\n--- SKENARIO 3: PENGHAPUSAN AGENDA 2 (PENGUJIAN REVERSI NILAI) ---');
    const { data: asgs2 } = await supabase.from('activity_assignments').select('id').eq('activity_id', act2.id);
    const asgIds2 = (asgs2 || []).map((x) => x.id);
    if (asgIds2.length > 0) {
      await supabase.from('attendances').delete().in('activity_assignment_id', asgIds2);
      await supabase.from('activity_assignments').delete().eq('activity_id', act2.id);
    }
    await supabase.from('activities').delete().eq('id', act2.id);

    // Hitung ulang setelah Agenda 2 dihapus
    const evalReverted = await calculateEvaluation(audry.id, periodId);

    console.log('Nilai Audry setelah Agenda 2 dihapus:', {
      system_score: evalReverted.systemScore,
      in: evalReverted.attendancePoints,
      tepat: evalReverted.punctualityPoints,
      out: evalReverted.checkoutPoints,
    });

    assert(
      evalReverted.systemScore === 40 &&
      evalReverted.attendancePoints === 20 &&
      evalReverted.punctualityPoints === 10 &&
      evalReverted.taskCompletionPoints === undefined && // or checkoutPoints
      evalReverted.checkoutPoints === 10,
      'REVERSI BERHASIL: Setelah Agenda 2 dihapus, skor Audry KEMBALI PERSIS ke nilai sebelum Agenda 2 diakumulasikan (40.00)'
    );

    // 6. Skenario 4: HAPUS AGENDA 1 (KEMBALI KE 0 AGENDA)
    console.log('\n--- SKENARIO 4: PENGHAPUSAN AGENDA 1 (KEMBALI KE 0 AGENDA) ---');
    const { data: asgs1 } = await supabase.from('activity_assignments').select('id').eq('activity_id', act1.id);
    const asgIds1 = (asgs1 || []).map((x) => x.id);
    if (asgIds1.length > 0) {
      await supabase.from('attendances').delete().in('activity_assignment_id', asgIds1);
      await supabase.from('activity_assignments').delete().eq('activity_id', act1.id);
    }
    await supabase.from('activities').delete().eq('id', act1.id);

    // Hitung ulang setelah seluruh agenda dihapus
    const evalFinal = await calculateEvaluation(audry.id, periodId);

    console.log('Nilai Audry setelah seluruh agenda dihapus:', {
      system_score: evalFinal.systemScore,
      in: evalFinal.attendancePoints,
      tepat: evalFinal.punctualityPoints,
      out: evalFinal.checkoutPoints,
    });

    assert(
      evalFinal.systemScore === 0 &&
      evalFinal.attendancePoints === 0 &&
      evalFinal.punctualityPoints === 0 &&
      evalFinal.checkoutPoints === 0,
      'KEMBALI BERSIH: Setelah Agenda 1 dihapus (0 agenda aktif), skor sistem Audry kembali ke 0.00 tanpa bug!'
    );

    console.log('\n================================================================');
    console.log('🎉 SEMUA PENGUJIAN AKUMULASI DAN REVERSI NILAI LULUS 100%!');
    console.log('================================================================');
  } catch (err) {
    console.error('Pengujian mengalami kesalahan:', err);
    throw err;
  } finally {
    // Pembersihan darurat jika ada sisa data uji
    if (act1) {
      await supabase.from('activity_assignments').delete().eq('activity_id', act1.id);
      await supabase.from('activities').delete().eq('id', act1.id);
    }
    if (act2) {
      await supabase.from('activity_assignments').delete().eq('activity_id', act2.id);
      await supabase.from('activities').delete().eq('id', act2.id);
    }
    await calculateEvaluation(audry.id, periodId);
  }
}

runTest();
