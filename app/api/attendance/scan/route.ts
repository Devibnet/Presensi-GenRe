import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const { activityId, sessionCode, actionType } = (await request.json()) as {
      activityId?: string;
      sessionCode?: string;
      actionType?: 'check_in' | 'check_out';
    };

    if (!activityId && !sessionCode) {
      return NextResponse.json({ error: 'ID Kegiatan atau Kode Sesi wajib disertakan' }, { status: 400 });
    }

    // 1. Cari kegiatan dan sesi yang aktif
    let targetActivityId = activityId;
    let targetSessionId: string | null = null;

    if (sessionCode) {
      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('id, activity_id, session_status')
        .eq('session_code', sessionCode)
        .single();

      if (session) {
        if (session.session_status === 'closed' || session.session_status === 'cancelled') {
          return NextResponse.json({ error: 'Sesi presensi ini telah ditutup.' }, { status: 400 });
        }
        targetSessionId = session.id;
        targetActivityId = session.activity_id;
      }
    }

    if (!targetActivityId) {
      return NextResponse.json({ error: 'Kegiatan tidak ditemukan' }, { status: 404 });
    }

    // Ambil detail jadwal kegiatan
    const { data: activity } = await supabase
      .from('activities')
      .select('*')
      .eq('id', targetActivityId)
      .single();

    if (!activity) {
      return NextResponse.json({ error: 'Data kegiatan tidak ditemukan' }, { status: 404 });
    }

    if (activity.activity_status === 'cancelled') {
      return NextResponse.json({ error: 'Presensi ditolak: Kegiatan telah dibatalkan' }, { status: 400 });
    }

    // 2. Cek Surat Penugasan Anggota (activity_assignments)
    let { data: assignment } = await supabase
      .from('activity_assignments')
      .select('id, assignment_status, assignment_type')
      .eq('activity_id', targetActivityId)
      .eq('member_id', user.id)
      .maybeSingle();

    if (!assignment) {
      // Cek apakah pengguna saat ini adalah BPH / Admin
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('system_role, full_name')
        .eq('id', user.id)
        .single();

      if (userProfile && userProfile.system_role === 'admin') {
        // BPH / Admin otomatis diberikan penugasan aktif agar dapat langsung check-in
        const { data: newAsg, error: asgErr } = await supabase
          .from('activity_assignments')
          .insert({
            activity_id: targetActivityId,
            member_id: user.id,
            assignment_type: 'attendance_required',
            assignment_description: 'Mandat Pengawas BPH / Pengurus Inti',
            assignment_status: 'active',
            assigned_by: user.id,
          })
          .select('id, assignment_status, assignment_type')
          .single();

        if (!asgErr && newAsg) {
          assignment = newAsg;
        }
      }
    }

    if (!assignment) {
      return NextResponse.json({
        error: `Presensi ditolak: Anda belum memiliki surat penugasan sah pada agenda "${activity.activity_name}". Silakan minta Koordinator Sie Anda atau Admin untuk menugaskan Anda terlebih dahulu di menu Detail Kegiatan.`,
      }, { status: 403 });
    }

    if (assignment.assignment_status !== 'active') {
      return NextResponse.json({
        error: `Presensi ditolak: Status penugasan Anda pada kegiatan ini adalah "${assignment.assignment_status}", bukan active.`,
      }, { status: 403 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 3. Periksa Rekam Presensi yang Sudah Ada
    const { data: existingAttendance } = await supabase
      .from('attendances')
      .select('*')
      .eq('activity_assignment_id', assignment.id)
      .maybeSingle();

    if (actionType === 'check_out' || (existingAttendance && existingAttendance.check_in_at && !existingAttendance.check_out_at)) {
      // PROSES CHECK-OUT
      if (!existingAttendance || !existingAttendance.check_in_at) {
        return NextResponse.json({ error: 'Anda belum melakukan check-in pada kegiatan ini.' }, { status: 400 });
      }

      const checkInTime = new Date(existingAttendance.check_in_at);
      if (now < checkInTime) {
        return NextResponse.json({ error: 'Waktu check-out tidak boleh mendahului check-in.' }, { status: 400 });
      }

      const { data: updated, error: updateErr } = await supabase
        .from('attendances')
        .update({
          check_out_at: nowIso,
          check_out_method: 'qr',
          check_out_status: 'normal',
          updated_at: nowIso,
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Check-out berhasil dicatat!',
        attendance: updated,
      });
    } else {
      // PROSES CHECK-IN
      if (existingAttendance && existingAttendance.check_in_at) {
        return NextResponse.json({
          message: 'Anda sudah melakukan check-in sebelumnya.',
          attendance: existingAttendance,
        });
      }

      // Tentukan status keterlambatan
      const checkInCloses = new Date(activity.check_in_closes_at);
      const isLate = now > checkInCloses;
      const checkInStatus = isLate ? 'late' : 'on_time';

      const { data: created, error: insertErr } = await supabase
        .from('attendances')
        .insert({
          activity_assignment_id: assignment.id,
          attendance_session_id: targetSessionId,
          check_in_at: nowIso,
          check_in_method: 'qr',
          check_in_status: checkInStatus,
          verification_status: 'approved',
          attendance_note: isLate ? 'Check-in melewati batas toleransi' : 'Hadir tepat waktu via QR',
        })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({
        message: isLate ? 'Check-in berhasil (Status: Terlambat)' : 'Check-in berhasil tepat waktu!',
        attendance: created,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}
