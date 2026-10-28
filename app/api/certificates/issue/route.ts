import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateMemberEvaluation } from '@/lib/evaluations';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { evaluationId, memberId, memberCode, email, issuerId } = body;

    const isUuid = (str?: string) => str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // 1. Resolve Issuer
    let validIssuerId = issuerId;
    if (!isUuid(validIssuerId)) {
      const { data: defaultAdmin } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('system_role', ['admin', 'coordinator'])
        .limit(1)
        .maybeSingle();
      validIssuerId = defaultAdmin?.id || 'efe29888-7c59-495c-ae61-5c59d875b7d9';
    }

    // 2. Resolve Active Period & Policy
    const { data: periodData } = await supabaseAdmin
      .from('organization_periods')
      .select('id')
      .eq('period_status', 'active')
      .limit(1)
      .maybeSingle();
    const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

    const { data: policyData } = await supabaseAdmin
      .from('evaluation_policies')
      .select('id')
      .eq('policy_status', 'active')
      .limit(1)
      .maybeSingle();
    const policyId = policyData?.id || '44444444-0000-0000-0000-000000000001';

    // 3. Resolve Target Evaluation & Member
    let targetEvaluationId: string | null = null;
    let resolvedMemberId: string | null = null;

    // A. Check by evaluationId
    if (isUuid(evaluationId)) {
      const { data: evalCheck } = await supabaseAdmin
        .from('final_evaluations')
        .select('id, member_id')
        .eq('id', evaluationId)
        .maybeSingle();

      if (evalCheck) {
        targetEvaluationId = evalCheck.id;
        resolvedMemberId = evalCheck.member_id;
      }
    }

    // B. Check by memberId jika evaluationId tidak ditemukan di DB
    if (!targetEvaluationId && isUuid(memberId)) {
      const { data: profCheck } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', memberId)
        .maybeSingle();

      if (profCheck) {
        resolvedMemberId = profCheck.id;
      }
    }

    // C. Check by memberCode jika ID merupakan mock/dummy
    if (!targetEvaluationId && !resolvedMemberId && memberCode) {
      const { data: profByCode } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('member_code', memberCode)
        .maybeSingle();

      if (profByCode) {
        resolvedMemberId = profByCode.id;
      }
    }

    // D. Check by email
    if (!targetEvaluationId && !resolvedMemberId && email) {
      const { data: profByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profByEmail) {
        resolvedMemberId = profByEmail.id;
      }
    }

    // E. Jika member ditemukan tetapi targetEvaluationId belum ada di DB
    if (!targetEvaluationId && resolvedMemberId) {
      const { data: mEval } = await supabaseAdmin
        .from('final_evaluations')
        .select('id')
        .eq('member_id', resolvedMemberId)
        .maybeSingle();

      if (mEval) {
        targetEvaluationId = mEval.id;
      } else {
        // Hitung evaluasi aktual secara proporsional dan transparan
        const calcRes = await calculateMemberEvaluation(resolvedMemberId, periodId);
        if (calcRes.success && calcRes.evaluationId) {
          targetEvaluationId = calcRes.evaluationId;
        } else {
          const { data: fallbackEval } = await supabaseAdmin
            .from('final_evaluations')
            .select('id')
            .eq('member_id', resolvedMemberId)
            .maybeSingle();
          if (fallbackEval) {
            targetEvaluationId = fallbackEval.id;
          }
        }
      }
    }

    if (!targetEvaluationId) {
      return NextResponse.json({ 
        error: 'Evaluasi tidak ditemukan atau data anggota belum dinilai di sistem.' 
      }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // 4. Pastikan status evaluasi akhir disetujui (approved) & berhak (eligible)
    await supabaseAdmin
      .from('final_evaluations')
      .update({
        evaluation_status: 'approved',
        certificate_eligibility_status: 'eligible',
        approved_by: validIssuerId,
        approved_at: nowIso,
      })
      .eq('id', targetEvaluationId);

    // 5. Generate nomor sertifikat resmi dan simpan ke database
    const certSeq = Math.floor(100 + Math.random() * 900);
    const certNumber = `018/GENRE-BL/SERT/X/2026/${certSeq}`;

    const { data: certificate, error: certErr } = await supabaseAdmin
      .from('certificates')
      .upsert(
        {
          final_evaluation_id: targetEvaluationId,
          certificate_number: certNumber,
          certificate_status: 'issued',
          issued_at: nowIso,
          issued_by: validIssuerId,
        },
        { onConflict: 'final_evaluation_id' }
      )
      .select()
      .single();

    if (certErr) {
      console.error('Error issuing certificate:', certErr);
      return NextResponse.json({ error: certErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Sertifikat resmi berhasil diterbitkan dengan nomor: ${certNumber}`,
      certificate,
      certificateNumber: certNumber,
    });
  } catch (err: any) {
    console.error('Error in /api/certificates/issue:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}

