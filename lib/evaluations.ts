import { createAdminClient } from '@/lib/supabase/admin';
import { EvaluationStatus, CertificateEligibilityStatus } from '@/lib/types';

export interface EvaluationCalculationResult {
  success: boolean;
  memberId: string;
  evaluationId?: string | null;
  error?: string;
  stats?: {
    totalAssigned: number;
    presentCount: number;
    onTimeCount: number;
    checkoutCount: number;
    attendancePoints: number;
    punctualityPoints: number;
    checkoutPoints: number;
    systemScore: number;
    coordinatorScore: number;
    finalScore: number;
    evaluationStatus: EvaluationStatus;
    certificateEligibilityStatus: CertificateEligibilityStatus;
  };
}

/**
 * Menghitung skor sistem dan evaluasi akhir secara akurat untuk 1 anggota panitia
 * Formula Pure Attendance System:
 * 1. Presensi Kehadiran Masuk (Check-In)   : Maks 20.00 Poin
 * 2. Ketepatan Waktu Masuk (Punctuality)   : Maks 10.00 Poin
 * 3. Presensi Kepulangan (Check-Out)       : Maks 10.00 Poin
 * -----------------------------------------------------------------
 * Total Skor Sistem Otomatis               : Maks 40.00 Poin
 * Evaluasi Kinerja Koordinator (5 Rubrik)  : Maks 60.00 Poin
 * -----------------------------------------------------------------
 * Total Nilai Akhir                        : Maks 100.00 Poin
 */
export async function calculateMemberEvaluation(
  memberId: string,
  targetPeriodId?: string
): Promise<EvaluationCalculationResult> {
  const supabaseAdmin = createAdminClient();

  try {
    // 1. Dapatkan periode organisasi aktif
    let periodId = targetPeriodId;
    if (!periodId) {
      const { data: periodData } = await supabaseAdmin
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .maybeSingle();
      periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';
    }

    // 2. Dapatkan kebijakan evaluasi (policy threshold)
    let policyId = '44444444-0000-0000-0000-000000000001';
    let threshold = 75.0;

    const { data: policyData } = await supabaseAdmin
      .from('evaluation_policies')
      .select('id, certificate_threshold')
      .eq('period_id', periodId)
      .maybeSingle();

    if (policyData) {
      policyId = policyData.id;
      threshold = Number(policyData.certificate_threshold || 75.0);
    }

    // 3. Ambil seluruh penugasan kegiatan anggota beserta riwayat presensi & data kegiatan
    const { data: assignments, error: asgErr } = await supabaseAdmin
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

    if (asgErr) {
      console.error('Error fetching member assignments for evaluation:', asgErr);
      throw asgErr;
    }

    // 4. Filter kegiatan yang sah untuk dievaluasi
    // BUG FIX: Hanya menghitung agenda yang sudah atau sedang berlangsung, membutuhkan absensi, dan berada di periode aktif.
    // Agenda mendatang ('upcoming' / masa depan) tidak boleh memotong skor panitia.
    const now = new Date();
    const eligibleAssignments = (assignments || []).filter((asg: any) => {
      const act = asg.activity;
      if (!act) return false;
      if (act.period_id && act.period_id !== periodId) return false;
      if (act.attendance_required === false) return false;
      if (act.activity_status === 'cancelled' || act.activity_status === 'draft') return false;

      // Harus sudah selesai, sedang berlangsung, atau waktu mulai kegiatan telah tiba/lewat
      const isPastOrOngoing =
        act.activity_status === 'completed' ||
        act.activity_status === 'ongoing' ||
        (act.start_at && new Date(act.start_at) <= now);

      return isPastOrOngoing;
    });

    const totalAssigned = eligibleAssignments.length;
    let presentCount = 0;
    let onTimeCount = 0;
    let checkoutCount = 0;

    eligibleAssignments.forEach((asg: any) => {
      const isExcusedAssignment = asg.assignment_status === 'excused';

      // Cari presensi yang terverifikasi approved
      const approvedAtt = (asg.attendances || []).find(
        (a: any) => a.verification_status === 'approved'
      );

      if (isExcusedAssignment) {
        // Dispensasi resmi di tingkat penugasan: tidak dipenalti
        presentCount++;
        onTimeCount++;
        checkoutCount++;
      } else if (approvedAtt) {
        const isExcusedCheckin = approvedAtt.check_in_status === 'excused';
        const hasCheckinTime = Boolean(approvedAtt.check_in_at);

        if (isExcusedCheckin || hasCheckinTime) {
          presentCount++;

          // Ketepatan waktu
          if (approvedAtt.check_in_status === 'on_time' || isExcusedCheckin) {
            onTimeCount++;
          }

          // Check-out tervalidasi:
          // Diakui jika check_out_at terisi, berstatus normal/early, lewat metode qr/manual,
          // atau terdapat dispensasi izin kepulangan dari koordinator
          const hasValidCheckout = Boolean(
            approvedAtt.check_out_at ||
            isExcusedCheckin ||
            approvedAtt.check_out_status === 'normal' ||
            approvedAtt.check_out_status === 'early_departure'
          );

          if (hasValidCheckout) {
            checkoutCount++;
          }
        }
      }
    });

    // 5. Perhitungan Poin Skor Sistem (Maks 40 Poin)
    // Formula proporsional: Setiap kegiatan yang ditugaskan memiliki bobot proporsional (20/N in, 10/N tepat, 10/N out).
    // Jika tidak ada kegiatan ditugaskan (totalAssigned = 0), seluruh poin sistem bernilai 0.00.
    let attPoints = 0.0;
    let puncPoints = 0.0;
    let checkoutPoints = 0.0;

    if (totalAssigned > 0) {
      // 1. Kehadiran Masuk: Maks 20.00 Poin
      attPoints = Math.min(20.0, Math.max(0.0, Number(((presentCount / totalAssigned) * 20.0).toFixed(2))));

      // 2. Ketepatan Waktu: Maks 10.00 Poin (proporsional terhadap total agenda yang ditugaskan)
      puncPoints = Math.min(10.0, Math.max(0.0, Number(((onTimeCount / totalAssigned) * 10.0).toFixed(2))));

      // 3. Kelengkapan Sesi Check-Out: Maks 10.00 Poin (proporsional terhadap total agenda yang ditugaskan)
      checkoutPoints = Math.min(10.0, Math.max(0.0, Number(((checkoutCount / totalAssigned) * 10.0).toFixed(2))));
    } else {
      attPoints = 0.0;
      puncPoints = 0.0;
      checkoutPoints = 0.0;
    }

    const systemScore = Math.min(40.0, Math.max(0.0, Number((attPoints + puncPoints + checkoutPoints).toFixed(2))));

    // 6. Ambil Evaluasi Koordinator (Maks 60 Poin)
    const { data: review } = await supabaseAdmin
      .from('performance_reviews')
      .select('total_weighted_score, review_status')
      .eq('period_id', periodId)
      .eq('member_id', memberId)
      .maybeSingle();

    const coordScore = Math.min(60.0, Math.max(0.0, Number(review?.total_weighted_score || 0.0)));
    const finalScore = Math.min(100.0, Math.max(0.0, Number((systemScore + coordScore).toFixed(2))));
    const hasReview = review?.review_status === 'approved' && coordScore > 0;

    // 7. Periksa apakah ada sertifikat yang sudah diterbitkan atau evaluasi telah disahkan
    const { data: existingEval } = await supabaseAdmin
      .from('final_evaluations')
      .select('id, evaluation_status, certificate_eligibility_status, approved_by, approved_at, approval_note')
      .eq('period_id', periodId)
      .eq('member_id', memberId)
      .maybeSingle();

    let certRow: any = null;
    if (existingEval?.id) {
      const { data: c } = await supabaseAdmin
        .from('certificates')
        .select('id, certificate_number, certificate_status')
        .eq('final_evaluation_id', existingEval.id)
        .maybeSingle();
      certRow = c;
    }

    // 8. Periksa apakah ada permohonan klarifikasi/sanggahan terbuka
    const { data: openClar } = await supabaseAdmin
      .from('clarification_requests')
      .select('id')
      .eq('period_id', periodId)
      .eq('member_id', memberId)
      .in('request_status', ['submitted', 'under_review'])
      .limit(1)
      .maybeSingle();

    // 9. Tentukan status evaluasi dan status kelayakan sertifikat
    let evalStatus: EvaluationStatus = 'calculating';
    let certEligibility: CertificateEligibilityStatus = 'pending';

    if (openClar) {
      evalStatus = 'clarification_open';
      certEligibility = certRow?.id ? 'eligible' : 'pending';
    } else if (certRow?.id) {
      evalStatus = 'approved';
      certEligibility = 'eligible';
    } else if (existingEval?.evaluation_status === 'approved') {
      evalStatus = 'approved';
      certEligibility = finalScore >= threshold ? 'eligible' : 'ineligible';
    } else if (hasReview) {
      evalStatus = 'pending_approval';
      certEligibility = finalScore >= threshold ? 'eligible' : 'ineligible';
    } else {
      evalStatus = 'calculating';
      certEligibility = 'pending';
    }

    // 10. Upsert ke tabel final_evaluations (menjaga integritas data pengesahan admin)
    const nowIso = new Date().toISOString();
    const upsertPayload: any = {
      period_id: periodId,
      member_id: memberId,
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
    };

    if (existingEval?.approved_by) {
      upsertPayload.approved_by = existingEval.approved_by;
      upsertPayload.approved_at = existingEval.approved_at;
      upsertPayload.approval_note = existingEval.approval_note;
    }

    const { data: savedEval, error: upsertErr } = await supabaseAdmin
      .from('final_evaluations')
      .upsert(upsertPayload, { onConflict: 'period_id,member_id' })
      .select('id')
      .single();

    if (upsertErr) {
      console.error('Error upserting final evaluation:', upsertErr);
      throw upsertErr;
    }

    return {
      success: true,
      memberId,
      evaluationId: savedEval?.id,
      stats: {
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
        evaluationStatus: evalStatus,
        certificateEligibilityStatus: certEligibility,
      },
    };
  } catch (err: any) {
    console.error(`Error calculating evaluation for member ${memberId}:`, err);
    return {
      success: false,
      memberId,
      error: err.message || 'Kesalahan kalkulasi skor',
    };
  }
}

/**
 * Menghitung ulang evaluasi dan skor sistem untuk seluruh anggota aktif secara efisien dan cepat
 */
export async function calculateAllMembersEvaluation(targetPeriodId?: string) {
  const supabaseAdmin = createAdminClient();

  // 1. Ambil ID periode aktif
  let periodId = targetPeriodId;
  if (!periodId) {
    const { data: periodData } = await supabaseAdmin
      .from('organization_periods')
      .select('id')
      .eq('period_status', 'active')
      .maybeSingle();
    periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';
  }

  // 2. Dapatkan seluruh profil anggota aktif
  const { data: members, error: mErr } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('account_status', 'active');

  if (mErr) {
    console.error('Error fetching members for bulk calculation:', mErr);
    throw mErr;
  }

  const memberList = members || [];
  const results: EvaluationCalculationResult[] = [];

  // 3. Proses dalam batch terukur (concurrency 8) agar cepat, hemat memori, dan tidak memicu timeout
  const BATCH_SIZE = 8;
  for (let i = 0; i < memberList.length; i += BATCH_SIZE) {
    const chunk = memberList.slice(i, i + BATCH_SIZE);
    const chunkResults = await Promise.all(
      chunk.map((m) => calculateMemberEvaluation(m.id, periodId))
    );
    results.push(...chunkResults);
  }

  return {
    totalProcessed: results.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    results,
  };
}
