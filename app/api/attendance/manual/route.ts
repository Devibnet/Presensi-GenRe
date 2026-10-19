import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// -----------------------------------------------------------------------------
// GET: Ambil Daftar Permohonan Presensi Manual
// -----------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const paramUserId = searchParams.get('userId');

    let currentUserId = user?.id || paramUserId;
    let currentUserRole = 'member';

    if (currentUserId) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('system_role')
        .eq('id', currentUserId)
        .maybeSingle();
      if (prof) currentUserRole = prof.system_role;
    }

    let query = supabaseAdmin
      .from('manual_attendance_requests')
      .select(`
        *,
        activity_assignment:activity_assignments(
          id,
          member_id,
          assignment_type,
          activity:activities(
            id,
            activity_name,
            activity_code,
            activity_location,
            start_at,
            end_at
          )
        ),
        requester:profiles!requested_by(
          id,
          full_name,
          member_code,
          email
        )
      `)
      .order('created_at', { ascending: false });

    // Jika member biasa, hanya tampilkan permohonan yang diajukan oleh dirinya sendiri
    if (currentUserRole === 'member' && currentUserId) {
      query = query.eq('requested_by', currentUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching manual attendance requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error('Error in GET /api/attendance/manual:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: Ajukan Permohonan Presensi Manual Baru
// -----------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { assignmentId, attendanceType, claimedTime, reason, evidenceUrl, requestedBy: customRequester } = body;

    if (!assignmentId || !claimedTime || !reason || !reason.trim()) {
      return NextResponse.json({ error: 'Penugasan agenda, perkiraan waktu hadir, dan alasan wajib disertakan.' }, { status: 400 });
    }

    let requesterId = user?.id || customRequester;
    if (!requesterId) {
      // Ambil member_id dari assignment jika ada
      const { data: assignData } = await supabaseAdmin
        .from('activity_assignments')
        .select('member_id')
        .eq('id', assignmentId)
        .single();
      requesterId = assignData?.member_id;
    }

    if (!requesterId) {
      return NextResponse.json({ error: 'Identitas pemohon tidak ditemukan.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const { data: created, error } = await supabaseAdmin
      .from('manual_attendance_requests')
      .insert({
        activity_assignment_id: assignmentId,
        attendance_type: attendanceType || 'check_in',
        claimed_event_time: new Date(claimedTime).toISOString(),
        reason: reason.trim(),
        evidence_url: evidenceUrl?.trim() || null,
        requested_by: requesterId,
        review_status: 'pending',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(`
        *,
        activity_assignment:activity_assignments(
          id,
          activity:activities(
            id,
            activity_name,
            activity_code
          )
        )
      `)
      .single();

    if (error) {
      console.error('Error creating manual request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Permohonan presensi manual berhasil diajukan!',
      data: created,
    });
  } catch (err: any) {
    console.error('Error in POST /api/attendance/manual:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: Edit Permohonan Presensi Manual (selama status masih pending)
// -----------------------------------------------------------------------------
export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { requestId, attendanceType, claimedTime, reason, evidenceUrl } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'ID permohonan wajib disertakan.' }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Alasan permohonan tidak boleh kosong.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      reason: reason.trim(),
      updated_at: nowIso,
    };

    if (attendanceType) updatePayload.attendance_type = attendanceType;
    if (claimedTime) updatePayload.claimed_event_time = new Date(claimedTime).toISOString();
    if (evidenceUrl !== undefined) updatePayload.evidence_url = evidenceUrl?.trim() || null;

    const { data: updated, error } = await supabaseAdmin
      .from('manual_attendance_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Error updating manual request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Permohonan presensi manual berhasil diperbarui!',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/attendance/manual:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: Batalkan / Hapus Permohonan Presensi Manual
// -----------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    let requestId = searchParams.get('id');

    if (!requestId) {
      try {
        const body = await request.json();
        requestId = body.requestId;
      } catch {
        // ignore
      }
    }

    if (!requestId) {
      return NextResponse.json({ error: 'ID permohonan wajib disertakan.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('manual_attendance_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('Error deleting manual request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Permohonan presensi manual berhasil dibatalkan/dihapus.',
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/attendance/manual:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}
