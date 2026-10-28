import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateMemberEvaluation } from '@/lib/evaluations';

// =============================================================================
// DELETE: Batalkan / Hapus Penugasan Panitia dari Suatu Agenda Kegiatan
// =============================================================================
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // 1. Verifikasi Autentikasi Pengguna
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Harap melakukan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    // 2. Verifikasi Kewenangan (Hanya Koordinator & Admin / Penanggung Jawab)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || (profile.system_role !== 'admin' && profile.system_role !== 'coordinator')) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Koordinator dan Penanggung Jawab yang memiliki izin membatalkan penugasan.' },
        { status: 403 }
      );
    }

    // 3. Ekstrak ID Penugasan
    const { searchParams } = new URL(request.url);
    let assignmentId = searchParams.get('id');

    if (!assignmentId) {
      try {
        const body = await request.json();
        assignmentId = body.id || body.assignmentId;
      } catch {}
    }

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'ID penugasan (assignmentId) wajib disertakan.' },
        { status: 400 }
      );
    }

    // 4. Periksa Keberadaan Penugasan
    const { data: assignment, error: findErr } = await supabaseAdmin
      .from('activity_assignments')
      .select('id, member_id, activity_id')
      .eq('id', assignmentId)
      .maybeSingle();

    if (findErr || !assignment) {
      return NextResponse.json(
        { error: 'Data penugasan tidak ditemukan atau sudah dibatalkan sebelumnya.' },
        { status: 404 }
      );
    }

    // 5. Bersihkan entitas turunan (Cascade manual karena foreign key ON DELETE RESTRICT)
    // a. Hapus catatan presensi terkait
    await supabaseAdmin
      .from('attendances')
      .delete()
      .eq('activity_assignment_id', assignmentId);

    // b. Hapus permohonan presensi manual terkait
    await supabaseAdmin
      .from('manual_attendance_requests')
      .delete()
      .eq('activity_assignment_id', assignmentId);

    // c. Hapus riwayat log penugasan
    await supabaseAdmin
      .from('assignment_history')
      .delete()
      .eq('activity_assignment_id', assignmentId);

    const targetMemberId = assignment.member_id;

    // 6. Hapus baris penugasan pada tabel activity_assignments
    const { error: delErr } = await supabaseAdmin
      .from('activity_assignments')
      .delete()
      .eq('id', assignmentId);

    if (delErr) {
      console.error('Error deleting activity assignment:', delErr);
      return NextResponse.json(
        { error: `Gagal membatalkan penugasan: ${delErr.message}` },
        { status: 500 }
      );
    }

    // 7. Hitung ulang evaluasi anggota tersebut agar skor kehadiran kembali ke nilai akurat
    if (targetMemberId) {
      try {
        await calculateMemberEvaluation(targetMemberId);
      } catch (calcErr) {
        console.warn('Gagal sinkronisasi evaluasi setelah pembatalan penugasan:', calcErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Penugasan panitia beserta seluruh catatan presensi terkait berhasil dibatalkan, dan nilai telah dihitung ulang.',
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/activities/assignments:', err);
    return NextResponse.json(
      { error: err.message || 'Kesalahan internal server' },
      { status: 500 }
    );
  }
}
