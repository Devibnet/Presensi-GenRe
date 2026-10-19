import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('final_evaluations')
      .select(`
        *,
        member:profiles!final_evaluations_member_id_fkey(
          *,
          field:fields!profiles_field_id_fkey(*)
        ),
        certificate:certificates(*)
      `)
      .order('final_score', { ascending: false });

    if (error) {
      console.error('Error fetching certificates & evaluations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (err: any) {
    console.error('Error in GET /api/certificates:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}
