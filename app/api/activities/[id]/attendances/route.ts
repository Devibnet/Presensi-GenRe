import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// -----------------------------------------------------------------------------
// GET: Ambil Daftar Penugasan & Presensi Lengkap Panitia per Kegiatan
// Terbuka untuk seluruh panitia (transparansi presensi tepat waktu & terlambat)
// -----------------------------------------------------------------------------
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const activityId = resolvedParams.id;

    if (!activityId) {
      return NextResponse.json({ error: 'ID kegiatan wajib disertakan.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('activity_assignments')
      .select(`
        *,
        member:profiles!activity_assignments_member_id_fkey(
          *,
          field:fields!profiles_field_id_fkey(*)
        ),
        attendance:attendances(*)
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching activity attendances:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      attendance: Array.isArray(item.attendance) ? (item.attendance[0] || null) : item.attendance,
    }));

    return NextResponse.json({ success: true, data: formattedData });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/activities/[id]/attendances:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}
