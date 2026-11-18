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

// =============================================================================
// PATCH: Ubah Status Penugasan (Beri Izin/Dispensasi atau Aktifkan Kembali)
// =============================================================================
export async function PATCH(request: Request) {
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

    // 2. Verifikasi Kewenangan (Hanya Koordinator & Admin)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || (profile.system_role !== 'admin' && profile.system_role !== 'coordinator')) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Koordinator dan Admin yang memiliki izin mengubah status penugasan.' },
        { status: 403 }
      );
    }

    // 3. Ekstrak data dari request
    const body = await request.json();
    const { id: assignmentId, status, reason } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'ID penugasan (id) wajib disertakan.' },
        { status: 400 }
      );
    }

    if (!status || !['active', 'excused'].includes(status)) {
      return NextResponse.json(
        { error: 'Status baru tidak valid. Pilihan: "active" atau "excused".' },
        { status: 400 }
      );
    }

    // 4. Periksa Keberadaan Penugasan
    const { data: assignment, error: findErr } = await supabaseAdmin
      .from('activity_assignments')
      .select(`
        id, 
        member_id, 
        activity_id, 
        assignment_status,
        activity:activities(activity_name, activity_code)
      `)
      .eq('id', assignmentId)
      .maybeSingle();

    if (findErr || !assignment) {
      return NextResponse.json(
        { error: 'Data penugasan tidak ditemukan.' },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const actData = Array.isArray(assignment.activity) ? assignment.activity[0] : assignment.activity;
    const activityName = actData?.activity_name || 'Agenda Kegiatan';

    let updatePayload: any = {
      assignment_status: status,
      updated_at: nowIso,
    };

    if (status === 'excused') {
      const excuseReason = reason?.trim() || 'Dispensasi izin oleh Koordinator';
      updatePayload.cancellation_reason = excuseReason;
      updatePayload.cancelled_at = nowIso;

      // Jika ada permohonan presensi manual bertipe izin yang masih pending, setujui otomatis
      await supabaseAdmin
        .from('manual_attendance_requests')
        .update({
          review_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: nowIso,
          review_note: `Disetujui sebagai dispensasi izin: ${excuseReason}`,
          updated_at: nowIso,
        })
        .eq('activity_assignment_id', assignmentId)
        .eq('review_status', 'pending');

      // Kirim Notifikasi In-App ke Panitia
      await supabaseAdmin.from('notifications').insert({
        user_id: assignment.member_id,
        title: 'Dispensasi Izin Diberikan',
        message: `Penugasan Anda pada agenda "${activityName}" telah disetujui berstatus Izin/Dispensasi (${excuseReason}). Hak nilai dan sertifikat Anda tidak terpotong.`,
        notification_type: 'attendance',
        action_url: '/dashboard/attendance',
        is_read: false,
        created_at: nowIso,
      });
    } else {
      // Revert ke 'active'
      updatePayload.cancellation_reason = null;
      updatePayload.cancelled_at = null;

      // Kirim Notifikasi In-App ke Panitia
      await supabaseAdmin.from('notifications').insert({
        user_id: assignment.member_id,
        title: 'Status Penugasan Aktif Kembali',
        message: `Status penugasan Anda pada agenda "${activityName}" telah dikembalikan menjadi Aktif oleh Koordinator.`,
        notification_type: 'attendance',
        action_url: '/dashboard/attendance',
        is_read: false,
        created_at: nowIso,
      });
    }

    // Eksekusi Update
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('activity_assignments')
      .update(updatePayload)
      .eq('id', assignmentId)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating activity assignment status:', updateErr);
      return NextResponse.json(
        { error: `Gagal memperbarui status penugasan: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // 5. Segera hitung ulang nilai evaluasi anggota agar skor presensi akurat real-time
    if (assignment.member_id) {
      try {
        await calculateMemberEvaluation(assignment.member_id);
      } catch (calcErr) {
        console.warn('Gagal kalkulasi evaluasi setelah update status penugasan:', calcErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: status === 'excused'
        ? 'Status panitia berhasil ditandai sebagai Izin/Dispensasi, dan evaluasi nilai kehadiran telah diperbarui.'
        : 'Status penugasan panitia berhasil dikembalikan menjadi Aktif.',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/activities/assignments:', err);
    return NextResponse.json(
      { error: err.message || 'Kesalahan internal server' },
      { status: 500 }
    );
  }
}
