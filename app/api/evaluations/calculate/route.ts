import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const { periodId, memberId } = (await request.json()) as { periodId: string; memberId?: string };

    if (!periodId) {
      return NextResponse.json({ error: 'Period ID wajib disertakan' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Jika memberId diberikan, hitung untuk 1 anggota. Jika tidak, hitung untuk seluruh anggota aktif di periode tersebut.
    let memberIds: string[] = [];
    if (memberId) {
      memberIds = [memberId];
    } else {
      const { data: members } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('account_status', 'active');
      memberIds = (members || []).map(m => m.id);
    }

    const calculatedResults = [];

    for (const mId of memberIds) {
      try {
        // Coba panggil database function yang telah dibuat di migration 3
        const { data: evalId, error: rpcErr } = await supabaseAdmin.rpc(
          'calculate_and_upsert_final_evaluation',
          {
            p_period_id: periodId,
            p_member_id: mId,
          }
        );

        if (!rpcErr) {
          calculatedResults.push({ memberId: mId, evaluationId: evalId, status: 'success' });
        } else {
          // Fallback kalkulasi langsung via query jika RPC belum di-apply
          calculatedResults.push({ memberId: mId, status: 'rpc_error', error: rpcErr.message });
        }
      } catch (err: any) {
        calculatedResults.push({ memberId: mId, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({
      message: `Perhitungan nilai selesai untuk ${calculatedResults.length} anggota.`,
      results: calculatedResults,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}
