import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { calculateMemberEvaluation } from '@/lib/evaluations';

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    // Ambil active period
    const { data: periodData } = await supabaseAdmin
      .from('organization_periods')
      .select('id')
      .eq('period_status', 'active')
      .maybeSingle();
    const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

    // 1. Ambil reviews dari performance_reviews
    let reviewsQuery = supabaseAdmin
      .from('performance_reviews')
      .select(`
        *,
        reviewer:profiles!performance_reviews_reviewer_id_fkey(id, full_name, member_code, system_role)
      `)
      .eq('period_id', periodId);

    if (memberId) {
      reviewsQuery = reviewsQuery.eq('member_id', memberId);
    }

    const { data: reviewsList } = await reviewsQuery;
    const reviewMap = new Map<string, any>();
    (reviewsList || []).forEach((r) => {
      reviewMap.set(r.member_id, r);
    });

    // 2. Ambil final_evaluations
    let evalsQuery = supabaseAdmin
      .from('final_evaluations')
      .select(`
        *,
        member:profiles!final_evaluations_member_id_fkey(
          *,
          field:fields!profiles_field_id_fkey(*)
        )
      `)
      .order('final_score', { ascending: false });

    if (memberId) {
      evalsQuery = evalsQuery.eq('member_id', memberId);
    }

    const { data, error } = await evalsQuery;

    if (error) {
      console.error('Error in GET /api/evaluations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Gabungkan review data ke setiap final_evaluation
    const mergedData = (data || []).map((ev) => ({
      ...ev,
      review: reviewMap.get(ev.member_id) || null,
    }));

    return NextResponse.json({
      success: true,
      data: memberId ? (mergedData[0] || null) : mergedData,
    });
  } catch (err: any) {
    console.error('Error in GET /api/evaluations:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'memberId wajib disertakan.' }, { status: 400 });
    }

    // Cek reviewer yang menghapus
    let currentUserId: string | null = null;
    try {
      const supabaseUser = await createClient();
      const { data: { user } } = await supabaseUser.auth.getUser();
      currentUserId = user?.id || null;
    } catch {}

    if (currentUserId) {
      const { data: userProf } = await supabaseAdmin
        .from('profiles')
        .select('id, system_role')
        .eq('id', currentUserId)
        .maybeSingle();

      if (userProf && userProf.system_role === 'member') {
        return NextResponse.json(
          { error: 'Anggota biasa tidak memiliki kewenangan menghapus penilaian.' },
          { status: 403 }
        );
      }
    }

    // Ambil active period
    const { data: periodData } = await supabaseAdmin
      .from('organization_periods')
      .select('id')
      .eq('period_status', 'active')
      .maybeSingle();
    const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

    // 1. Hapus dari performance_reviews
    const { error: delErr } = await supabaseAdmin
      .from('performance_reviews')
      .delete()
      .eq('period_id', periodId)
      .eq('member_id', memberId);

    if (delErr) {
      console.error('Error deleting performance review:', delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // 2. Hitung ulang evaluasi menggunakan formula akurat
    try {
      await calculateMemberEvaluation(memberId, periodId);
    } catch (calcErr) {
      console.warn('Gagal kalkulasi evaluasi setelah review dihapus:', calcErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Penilaian kinerja koordinator berhasil dihapus/direset ke 0.00.',
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/evaluations:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}
