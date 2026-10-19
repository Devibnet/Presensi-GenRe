import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { calculateMemberEvaluation } from '@/lib/evaluations';

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    const {
      memberId,
      reviewerId,
      communicationScore = 5.0,
      responsibilityScore = 5.0,
      teamworkScore = 5.0,
      initiativeScore = 5.0,
      professionalismScore = 5.0,
      evidenceNote,
    } = body;

    if (!memberId) {
      return NextResponse.json({ error: 'memberId wajib disertakan' }, { status: 400 });
    }

    // 0. Autentikasi Pengguna Penilai (Reviewer)
    let authenticatedUserId: string | null = null;
    try {
      const supabaseUser = await createClient();
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user?.id) authenticatedUserId = user.id;
    } catch (authErr) {
      // Fallback ke reviewerId jika sesi cookie tidak tersedia
    }

    const effectiveReviewerId = authenticatedUserId || reviewerId;
    if (!effectiveReviewerId) {
      return NextResponse.json(
        { error: 'Sesi penilai tidak terdeteksi. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    // 1. Ambil Profil Reviewer & Target Member
    const { data: reviewerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, system_role, field_id, account_status')
      .eq('id', effectiveReviewerId)
      .maybeSingle();

    if (!reviewerProfile || reviewerProfile.account_status !== 'active') {
      return NextResponse.json(
        { error: 'Akun penilai tidak ditemukan atau tidak aktif.' },
        { status: 401 }
      );
    }

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, system_role, field_id, account_status')
      .eq('id', memberId)
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'Anggota yang dinilai tidak ditemukan.' },
        { status: 404 }
      );
    }

    // =========================================================================
    // 2. PENEGAKAN ATURAN HAK AKSES PENILAIAN (BUSINESS RULES)
    // =========================================================================

    // Aturan A: Tidak bisa menilai akun sendiri (berlaku untuk semua role, termasuk admin)
    if (reviewerProfile.id === targetProfile.id) {
      return NextResponse.json(
        { error: 'Anda tidak dapat memberikan penilaian kinerja pada akun Anda sendiri.' },
        { status: 400 }
      );
    }

    // Aturan B: Anggota biasa tidak berwenang memberikan penilaian
    if (reviewerProfile.system_role === 'member') {
      return NextResponse.json(
        { error: 'Anggota biasa tidak memiliki kewenangan untuk memberikan penilaian kinerja.' },
        { status: 403 }
      );
    }

    // Aturan C: Akun Admin hanya dapat dinilai oleh akun Admin lain
    if (targetProfile.system_role === 'admin') {
      if (reviewerProfile.system_role !== 'admin' || reviewerProfile.id === targetProfile.id) {
        return NextResponse.json(
          { error: 'Akun admin hanya dapat dinilai oleh akun admin lain.' },
          { status: 403 }
        );
      }
    }

    // Aturan D: Koordinator hanya bisa dinilai oleh Admin
    if (targetProfile.system_role === 'coordinator') {
      if (reviewerProfile.system_role !== 'admin') {
        return NextResponse.json(
          { error: 'Koordinator hanya bisa dinilai oleh admin.' },
          { status: 403 }
        );
      }
    }

    // Aturan E: Koordinator hanya bisa menilai anggota sie nya
    if (reviewerProfile.system_role === 'coordinator') {
      if (!targetProfile.field_id) {
        return NextResponse.json(
          { error: 'Koordinator hanya bisa menilai anggota sie nya. Anggota target belum terhubung ke suatu divisi/sie.' },
          { status: 403 }
        );
      }

      // Ambil divisi di mana reviewer bertindak sebagai koordinator
      const { data: coordFields } = await supabaseAdmin
        .from('fields')
        .select('id')
        .or(`coordinator_id.eq.${reviewerProfile.id},id.eq.${reviewerProfile.field_id || '00000000-0000-0000-0000-000000000000'}`);

      const allowedFieldIds = (coordFields || []).map((f) => f.id);
      if (reviewerProfile.field_id) {
        allowedFieldIds.push(reviewerProfile.field_id);
      }

      if (!allowedFieldIds.includes(targetProfile.field_id)) {
        return NextResponse.json(
          { error: 'Koordinator hanya bisa menilai anggota sie nya. Anda tidak berwenang menilai anggota divisi lain.' },
          { status: 403 }
        );
      }
    }

    const validMemberId = targetProfile.id;
    const validReviewerId = reviewerProfile.id;

    // 3. Ambil active period
    let periodId = '00000000-0000-0000-0000-000000000001';
    const { data: periodData } = await supabaseAdmin
      .from('organization_periods')
      .select('id')
      .eq('period_status', 'active')
      .maybeSingle();

    if (periodData?.id) {
      periodId = periodData.id;
    } else {
      const { data: anyPeriod } = await supabaseAdmin
        .from('organization_periods')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (anyPeriod?.id) periodId = anyPeriod.id;
    }

    // 4. Ambil policy_id
    let policyId = '44444444-0000-0000-0000-000000000001';
    const { data: policyData } = await supabaseAdmin
      .from('evaluation_policies')
      .select('id')
      .eq('period_id', periodId)
      .maybeSingle();

    if (policyData?.id) {
      policyId = policyData.id;
    } else {
      const { data: anyPolicy } = await supabaseAdmin
        .from('evaluation_policies')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (anyPolicy?.id) policyId = anyPolicy.id;
    }

    // 5. Hitung skor terbobot (Maksimal 60)
    const commPts = (Number(communicationScore) / 5) * 15;
    const respPts = (Number(responsibilityScore) / 5) * 15;
    const teamPts = (Number(teamworkScore) / 5) * 10;
    const initPts = (Number(initiativeScore) / 5) * 10;
    const profPts = (Number(professionalismScore) / 5) * 10;
    const totalWeighted = Number((commPts + respPts + teamPts + initPts + profPts).toFixed(2));

    // 5. Upsert performance_reviews dengan admin client (bypasses RLS issues)
    const { data: review, error: revErr } = await supabaseAdmin
      .from('performance_reviews')
      .upsert(
        {
          period_id: periodId,
          member_id: validMemberId,
          reviewer_id: validReviewerId,
          policy_id: policyId,
          review_status: 'approved',
          communication_score: Number(communicationScore),
          responsibility_score: Number(responsibilityScore),
          teamwork_score: Number(teamworkScore),
          initiative_score: Number(initiativeScore),
          professionalism_score: Number(professionalismScore),
          total_weighted_score: totalWeighted,
          evidence_note: evidenceNote || 'Penilaian kinerja berkala oleh koordinator bidang.',
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'period_id,member_id' }
      )
      .select()
      .single();

    if (revErr) {
      console.error('Error upsert performance_reviews:', revErr);
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }

    // 6. Jalankan kalkulasi final evaluation murni sistem absensi terpadu
    try {
      await calculateMemberEvaluation(validMemberId, periodId);
    } catch (calcErr) {
      console.error('Error calculating evaluation after save:', calcErr);
    }


    return NextResponse.json({
      success: true,
      message: `Penilaian kinerja berhasil disimpan! Total skor koordinator: ${totalWeighted}/60.`,
      score: totalWeighted,
      review,
    });
  } catch (err: any) {
    console.error('Server error in /api/evaluations/save:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}
