import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateActivityCode } from '@/lib/utils';

// -----------------------------------------------------------------------------
// GET: Ambil Daftar Agenda Kegiatan
// -----------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('activities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('*')
      .order('start_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.error('Error in GET /api/activities:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: Buat Agenda Kegiatan Baru
// -----------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();

    const {
      periodId,
      activityCode,
      activityName,
      activityDescription,
      activityLocation,
      startAt,
      endAt,
      checkInOpensAt,
      checkInClosesAt,
      checkOutOpensAt,
      checkOutClosesAt,
      assignAllMembers,
      createdBy: customCreatedBy,
    } = body;

    const effectiveStart = startAt || checkInOpensAt;
    const effectiveEnd = endAt || checkOutClosesAt || checkInClosesAt;

    if (!activityName || !activityLocation || !effectiveStart || !effectiveEnd) {
      return NextResponse.json({ error: 'Nama kegiatan, lokasi, dan rentang waktu jadwal presensi wajib diisi.' }, { status: 400 });
    }

    let startDate = new Date(effectiveStart);
    let endDate = new Date(effectiveEnd);
    if (endDate <= startDate) {
      endDate = new Date(startDate.getTime() + 60 * 1000);
    }

    let creatorId = user?.id || customCreatedBy;
    if (!creatorId) {
      const { data: adminProf } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('system_role', ['admin', 'coordinator'])
        .limit(1)
        .maybeSingle();
      creatorId = adminProf?.id || '11111111-0000-0000-0000-000000000001';
    }

    let finalPeriodId = periodId;
    if (!finalPeriodId) {
      const { data: activePeriod } = await supabaseAdmin
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .limit(1)
        .maybeSingle();
      finalPeriodId = activePeriod?.id || '00000000-0000-0000-0000-000000000001';
    }

    // Auto-generate kode kegiatan jika tidak diisi atau cari kode unik
    let finalActivityCode = activityCode?.trim().toUpperCase();
    const { data: existingActs } = await supabaseAdmin
      .from('activities')
      .select('activity_code')
      .eq('period_id', finalPeriodId);

    if (!finalActivityCode) {
      finalActivityCode = generateActivityCode(activityName, existingActs || []);
    } else {
      // Pastikan kode unik di periode ini, jika bentrok otomatis beri suffix
      const existingList = (existingActs || []).map((a: any) => a.activity_code);
      if (existingList.includes(finalActivityCode)) {
        finalActivityCode = generateActivityCode(finalActivityCode, existingActs || []);
      }
    }

    const { data: newActivity, error } = await supabaseAdmin
      .from('activities')
      .insert({
        period_id: finalPeriodId,
        activity_code: finalActivityCode,
        activity_name: activityName.trim(),
        activity_description: activityDescription?.trim() || null,
        activity_location: activityLocation.trim(),
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        check_in_opens_at: new Date(checkInOpensAt || effectiveStart).toISOString(),
        check_in_closes_at: new Date(checkInClosesAt || effectiveEnd).toISOString(),
        check_out_opens_at: new Date(checkOutOpensAt || effectiveStart).toISOString(),
        check_out_closes_at: new Date(checkOutClosesAt || effectiveEnd).toISOString(),
        activity_status: 'scheduled',
        attendance_required: true,
        created_by: creatorId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Buat default attendance session
    if (newActivity) {
      await supabaseAdmin.from('attendance_sessions').insert({
        activity_id: newActivity.id,
        session_name: `Presensi Utama ${newActivity.activity_name}`,
        session_code: `${newActivity.activity_code}-MAIN`,
        session_status: 'open',
        created_by: creatorId,
      });

      // Jika opsi wajib hadir seluruh panitia dicentang
      if (assignAllMembers) {
        const { data: allMembers } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('account_status', 'active');

        if (allMembers && allMembers.length > 0) {
          const batchAssignments = allMembers.map((m: any) => ({
            activity_id: newActivity.id,
            member_id: m.id,
            assignment_type: 'attendance_required',
            assignment_description: 'Wajib Hadir Seluruh Panitia',
            assignment_status: 'active',
            assigned_by: creatorId,
          }));

          await supabaseAdmin
            .from('activity_assignments')
            .upsert(batchAssignments, { onConflict: 'activity_id,member_id' });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Agenda kegiatan berhasil dibuat!',
      data: newActivity,
    });
  } catch (err: any) {
    console.error('Error in POST /api/activities:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PUT: Edit / Update Agenda Kegiatan
// -----------------------------------------------------------------------------
export async function PUT(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    const {
      id,
      activityCode,
      activityName,
      activityDescription,
      activityLocation,
      startAt,
      endAt,
      checkInOpensAt,
      checkInClosesAt,
      checkOutOpensAt,
      checkOutClosesAt,
      activityStatus,
      attendanceRequired,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID kegiatan wajib disertakan.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      updated_at: nowIso,
    };

    if (activityCode) updatePayload.activity_code = activityCode.trim().toUpperCase();
    if (activityName) updatePayload.activity_name = activityName.trim();
    if (activityDescription !== undefined) updatePayload.activity_description = activityDescription?.trim() || null;
    if (activityLocation) updatePayload.activity_location = activityLocation.trim();

    const effectiveStart = startAt || checkInOpensAt;
    const effectiveEnd = endAt || checkOutClosesAt || checkInClosesAt;

    if (effectiveStart) updatePayload.start_at = new Date(effectiveStart).toISOString();
    if (effectiveEnd) updatePayload.end_at = new Date(effectiveEnd).toISOString();
    if (checkInOpensAt) updatePayload.check_in_opens_at = new Date(checkInOpensAt).toISOString();
    if (checkInClosesAt) updatePayload.check_in_closes_at = new Date(checkInClosesAt).toISOString();
    if (checkOutOpensAt) updatePayload.check_out_opens_at = new Date(checkOutOpensAt).toISOString();
    if (checkOutClosesAt) updatePayload.check_out_closes_at = new Date(checkOutClosesAt).toISOString();
    if (activityStatus) updatePayload.activity_status = activityStatus;
    if (attendanceRequired !== undefined) updatePayload.attendance_required = Boolean(attendanceRequired);

    const { data: updated, error } = await supabaseAdmin
      .from('activities')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Agenda kegiatan berhasil diperbarui!',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error in PUT /api/activities:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: Hapus Agenda Kegiatan (dengan pembersihan data bertingkat/cascade)
// -----------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'ID kegiatan wajib disertakan.' }, { status: 400 });
    }

    // 1. Ambil semua penugasan (assignments) kegiatan ini
    const { data: assignments } = await supabaseAdmin
      .from('activity_assignments')
      .select('id')
      .eq('activity_id', id);

    const assignmentIds = (assignments || []).map((a: any) => a.id);

    if (assignmentIds.length > 0) {
      // Hapus data presensi
      await supabaseAdmin
        .from('attendances')
        .delete()
        .in('activity_assignment_id', assignmentIds);

      // Hapus riwayat penugasan
      await supabaseAdmin
        .from('assignment_history')
        .delete()
        .in('activity_assignment_id', assignmentIds);

      // Hapus permohonan presensi manual
      await supabaseAdmin
        .from('manual_attendance_requests')
        .delete()
        .in('activity_assignment_id', assignmentIds);

      // Hapus penugasan
      await supabaseAdmin
        .from('activity_assignments')
        .delete()
        .eq('activity_id', id);
    }

    // 2. Putuskan hubungan (nullify) pada sanggahan dan tugas
    await supabaseAdmin
      .from('clarification_requests')
      .update({ related_activity_id: null })
      .eq('related_activity_id', id);

    await supabaseAdmin
      .from('tasks')
      .update({ activity_id: null })
      .eq('activity_id', id);

    // 3. Hapus relasi bidang dan sesi presensi
    await supabaseAdmin
      .from('activity_fields')
      .delete()
      .eq('activity_id', id);

    await supabaseAdmin
      .from('attendance_sessions')
      .delete()
      .eq('activity_id', id);

    // 4. Hapus agenda kegiatan itu sendiri
    const { error } = await supabaseAdmin
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Agenda kegiatan beserta seluruh riwayat terkait berhasil dihapus.',
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/activities:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}
