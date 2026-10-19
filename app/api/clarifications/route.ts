import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateMemberEvaluation } from '@/lib/evaluations';

// -----------------------------------------------------------------------------
// GET: Ambil Daftar Sanggahan & Klarifikasi
// -----------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();

    let currentUserId = user?.id || null;
    let currentUserRole = 'member';

    if (currentUserId) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('system_role')
        .eq('id', currentUserId)
        .maybeSingle();

      if (prof) {
        currentUserRole = prof.system_role;
      }
    } else {
      // Demo / fallback: cari admin pertama
      const { data: adminProf } = await supabaseAdmin
        .from('profiles')
        .select('id, system_role')
        .eq('system_role', 'admin')
        .limit(1)
        .maybeSingle();
      if (adminProf) {
        currentUserId = adminProf.id;
        currentUserRole = 'admin';
      }
    }

    const { searchParams } = new URL(request.url);
    const paramMemberId = searchParams.get('member_id');
    const paramFilter = searchParams.get('filter');

    // Query clarification requests dengan relasi eksplisit
    // Menampilkan SELURUH sanggahan secara transparan dan terintegrasi untuk semua peran (Admin, Koordinator, Anggota)
    let query = supabaseAdmin
      .from('clarification_requests')
      .select(`
        *,
        member:profiles!clarification_requests_member_id_fkey(
          *,
          field:fields!profiles_field_id_fkey(*)
        ),
        related_activity:activities(*)
      `)
      .order('created_at', { ascending: false });

    // Hanya jika secara spesifik memilih tab 'Sanggahan Saya', filter berdasarkan member_id
    if (paramFilter === 'my' && paramMemberId) {
      query = query.eq('member_id', paramMemberId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching clarifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      currentUserRole,
      currentUserId,
    });
  } catch (err: any) {
    console.error('Error in GET /api/clarifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: Ajukan Sanggahan Baru
// -----------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { requestType, relatedActivityId, description, memberId: customMemberId, periodId: customPeriodId } = body;

    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Uraian sanggahan tidak boleh kosong.' }, { status: 400 });
    }

    // Tentukan memberId pengaju
    let memberId = customMemberId || user?.id;
    if (!memberId) {
      const { data: defaultMember } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('account_status', 'active')
        .limit(1)
        .maybeSingle();
      memberId = defaultMember?.id;
    }

    if (!memberId) {
      return NextResponse.json({ error: 'Identitas pengaju tidak ditemukan.' }, { status: 400 });
    }

    // Dapatkan active period_id
    let periodId = customPeriodId;
    if (!periodId) {
      const { data: periodData } = await supabaseAdmin
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .limit(1)
        .maybeSingle();
      periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';
    }

    const nowIso = new Date().toISOString();

    const { data: created, error } = await supabaseAdmin
      .from('clarification_requests')
      .insert({
        period_id: periodId,
        member_id: memberId,
        request_type: requestType || 'attendance_dispute',
        related_activity_id: relatedActivityId || null,
        request_description: description.trim(),
        request_status: 'submitted',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(`
        *,
        member:profiles!clarification_requests_member_id_fkey(
          *,
          field:fields!profiles_field_id_fkey(*)
        ),
        related_activity:activities(*)
      `)
      .single();

    if (error) {
      console.error('Error inserting clarification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // INTEGRASI SISTEM: Segera perbarui final_evaluations anggota (kunci status clarification_open)
    try {
      await calculateMemberEvaluation(memberId, periodId);
    } catch (calcErr) {
      console.warn('Gagal kalkulasi evaluasi setelah sanggahan dibuat:', calcErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Sanggahan berhasil diajukan! Koordinator dan Admin akan meninjau dalam 1x24 jam.',
      data: created,
    });
  } catch (err: any) {
    console.error('Error in POST /api/clarifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PUT: Putusan / Resolusi Sanggahan (Admin / Koordinator)
// -----------------------------------------------------------------------------
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { clarificationId, status, resolutionNote } = body;

    if (!clarificationId || !status || !resolutionNote?.trim()) {
      return NextResponse.json({ error: 'ID sanggahan, status, dan catatan putusan wajib disertakan.' }, { status: 400 });
    }

    let resolverId = user?.id;
    if (!resolverId) {
      const { data: defaultAdmin } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('system_role', ['admin', 'coordinator'])
        .limit(1)
        .maybeSingle();
      resolverId = defaultAdmin?.id || '11111111-0000-0000-0000-000000000001';
    }

    const nowIso = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from('clarification_requests')
      .update({
        request_status: status,
        resolution_note: resolutionNote.trim(),
        resolved_by: resolverId,
        resolved_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', clarificationId)
      .select(`
        *,
        member:profiles!clarification_requests_member_id_fkey(
          *,
          field:fields!profiles_field_id_fkey(*)
        ),
        related_activity:activities(*)
      `)
      .single();

    if (error) {
      console.error('Error updating clarification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // INTEGRASI SISTEM: Jika sanggahan presensi DITERIMA (resolved), otomatis sinkronkan data presensi anggota menjadi Hadir On-Time
    if (status === 'resolved' && updated.request_type === 'attendance_dispute' && updated.related_activity_id && updated.member_id) {
      try {
        let { data: assign } = await supabaseAdmin
          .from('activity_assignments')
          .select('id')
          .eq('activity_id', updated.related_activity_id)
          .eq('member_id', updated.member_id)
          .maybeSingle();

        if (!assign) {
          const { data: newAssign } = await supabaseAdmin
            .from('activity_assignments')
            .insert({
              activity_id: updated.related_activity_id,
              member_id: updated.member_id,
              assignment_type: 'attendance_required',
              assignment_status: 'active',
              assigned_by: resolverId,
            })
            .select('id')
            .single();
          assign = newAssign;
        }

        if (assign?.id) {
          const { data: existingAtt } = await supabaseAdmin
            .from('attendances')
            .select('id')
            .eq('activity_assignment_id', assign.id)
            .maybeSingle();

          if (existingAtt) {
            await supabaseAdmin
              .from('attendances')
              .update({
                check_in_status: 'on_time',
                check_in_method: 'manual',
                verification_status: 'approved',
                verified_by: resolverId,
                verified_at: nowIso,
                attendance_note: `Diverifikasi via sanggahan: ${resolutionNote.trim()}`,
                updated_at: nowIso,
              })
              .eq('id', existingAtt.id);
          } else {
            await supabaseAdmin
              .from('attendances')
              .insert({
                activity_assignment_id: assign.id,
                check_in_at: nowIso,
                check_in_status: 'on_time',
                check_in_method: 'manual',
                verification_status: 'approved',
                verified_by: resolverId,
                verified_at: nowIso,
                attendance_note: `Diverifikasi via sanggahan: ${resolutionNote.trim()}`,
                created_at: nowIso,
                updated_at: nowIso,
              });
          }
        }
      } catch (attErr) {
        console.warn('Gagal sinkronisasi presensi dari sanggahan:', attErr);
      }
    }

    // INTEGRASI SISTEM: Segera hitung ulang nilai akhir & kelayakan sertifikat setelah sanggahan diputuskan
    if (updated.member_id && updated.period_id) {
      try {
        await calculateMemberEvaluation(updated.member_id, updated.period_id);
      } catch (calcErr) {
        console.warn('Gagal kalkulasi evaluasi setelah sanggahan diselesaikan:', calcErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: status === 'resolved' 
        ? 'Sanggahan diterima dan diselesaikan! Status kehadiran anggota otomatis diperbarui menjadi Hadir On-Time.' 
        : 'Sanggahan ditolak dengan penjelasan resmi.',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error in PUT /api/clarifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: Edit / Perbarui Isi Sanggahan oleh Pembuat atau Admin/Koordinator
// -----------------------------------------------------------------------------
export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { clarificationId, requestType, relatedActivityId, description } = body;

    if (!clarificationId) {
      return NextResponse.json({ error: 'ID sanggahan wajib disertakan.' }, { status: 400 });
    }

    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'Uraian sanggahan tidak boleh kosong.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const updatePayload: any = {
      request_description: description.trim(),
      updated_at: nowIso,
    };
    if (requestType) updatePayload.request_type = requestType;
    if (relatedActivityId !== undefined) updatePayload.related_activity_id = relatedActivityId || null;

    const { data: updated, error } = await supabaseAdmin
      .from('clarification_requests')
      .update(updatePayload)
      .eq('id', clarificationId)
      .select(`
        *,
        member:profiles!clarification_requests_member_id_fkey(
          *,
          field:fields!profiles_field_id_fkey(*)
        ),
        related_activity:activities(*)
      `)
      .single();

    if (error) {
      console.error('Error patching clarification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Sanggahan berhasil diperbarui!',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/clarifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: Hapus Sanggahan oleh Pembuat atau Admin/Koordinator
// -----------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    let clarificationId = searchParams.get('id');

    if (!clarificationId) {
      try {
        const body = await request.json();
        clarificationId = body.clarificationId;
      } catch {
        // ignore JSON parse error
      }
    }

    if (!clarificationId) {
      return NextResponse.json({ error: 'ID sanggahan wajib disertakan.' }, { status: 400 });
    }

    const { data: targetClar } = await supabaseAdmin
      .from('clarification_requests')
      .select('member_id, period_id')
      .eq('id', clarificationId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from('clarification_requests')
      .delete()
      .eq('id', clarificationId);

    if (error) {
      console.error('Error deleting clarification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (targetClar?.member_id && targetClar?.period_id) {
      try {
        await calculateMemberEvaluation(targetClar.member_id, targetClar.period_id);
      } catch (calcErr) {
        console.warn('Gagal sinkronisasi evaluasi setelah sanggahan dihapus:', calcErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sanggahan berhasil dihapus.',
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/clarifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

