import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditActivityItem {
  id: string;
  timestamp: string;
  category: 'assignment' | 'attendance' | 'excuse' | 'evaluation' | 'activity';
  actionTitle: string;
  actionDescription: string;
  activityId?: string;
  activityName?: string;
  activityCode?: string;
  actor: {
    id: string | null;
    fullName: string;
    memberCode: string;
    systemRole: string;
    fieldName?: string;
  };
  target?: {
    type: string;
    name: string;
    code?: string;
    detail?: string;
  };
  metadata?: any;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Pastikan user terautentikasi dan memiliki hak akses admin / coordinator
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.system_role !== 'admin' && profile.system_role !== 'coordinator')) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin dan Koordinator yang dapat melihat log audit.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const actorId = searchParams.get('actorId') || '';
    const activityIdFilter = searchParams.get('activityId') || '';
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '300', 10), 600);

    // Ambil daftar semua agenda kegiatan untuk filter dropdown
    const { data: dbActivities } = await supabaseAdmin
      .from('activities')
      .select('id, activity_name, activity_code')
      .order('created_at', { ascending: false });

    const activitiesList: AuditActivityItem[] = [];

    // 1. Log Penugasan Panitia ke Agenda (activity_assignments)
    if (category === 'all' || category === 'assignment') {
      let query = supabaseAdmin
        .from('activity_assignments')
        .select(`
          id,
          activity_id,
          created_at,
          assignment_type,
          assignment_status,
          assignment_description,
          assigned_by,
          assigner:profiles!activity_assignments_assigned_by_fkey(id, full_name, member_code, system_role, field:fields!profiles_field_id_fkey(field_name)),
          member:profiles!activity_assignments_member_id_fkey(id, full_name, member_code, field:fields!profiles_field_id_fkey(field_name, field_code)),
          activity:activities!activity_assignments_activity_id_fkey(id, activity_name, activity_code)
        `)
        .order('created_at', { ascending: false });

      if (activityIdFilter) {
        query = query.eq('activity_id', activityIdFilter);
      }
      if (actorId) {
        query = query.eq('assigned_by', actorId);
      }

      const { data: asgs } = await query.limit(limit);
      (asgs || []).forEach((asg: any) => {
        activitiesList.push({
          id: `asg-${asg.id}`,
          timestamp: asg.created_at,
          category: 'assignment',
          actionTitle: 'Penugasan Panitia ke Kegiatan',
          actionDescription: `Menugaskan panitia "${asg.member?.full_name || 'Anggota'}" (${asg.member?.field?.field_code || 'Umum'}) ke agenda "${asg.activity?.activity_name || 'Kegiatan'}" (${asg.activity?.activity_code || ''}). Mandat: ${asg.assignment_description || asg.assignment_type || 'Wajib Hadir'}.`,
          activityId: asg.activity?.id || asg.activity_id,
          activityName: asg.activity?.activity_name || 'Agenda Kegiatan',
          activityCode: asg.activity?.activity_code,
          actor: {
            id: asg.assigner?.id || asg.assigned_by,
            fullName: asg.assigner?.full_name || 'Sistem Organisasi',
            memberCode: asg.assigner?.member_code || '-',
            systemRole: asg.assigner?.system_role || 'system',
            fieldName: asg.assigner?.field?.field_name,
          },
          target: {
            type: 'Panitia',
            name: asg.member?.full_name || 'Panitia',
            code: asg.member?.member_code,
            detail: asg.activity?.activity_name,
          },
          metadata: {
            assignmentId: asg.id,
            status: asg.assignment_status,
          },
        });
      });
    }

    // 2. Log Verifikasi Presensi & Check-in (attendances)
    if (category === 'all' || category === 'attendance') {
      let query = supabaseAdmin
        .from('attendances')
        .select(`
          id,
          created_at,
          check_in_at,
          check_in_status,
          check_in_method,
          verification_status,
          verified_at,
          verified_by,
          attendance_note,
          verifier:profiles!attendances_verified_by_fkey(id, full_name, member_code, system_role, field:fields!profiles_field_id_fkey(field_name)),
          activity_assignment:activity_assignments!attendances_activity_assignment_id_fkey(
            activity_id,
            member:profiles!activity_assignments_member_id_fkey(id, full_name, member_code),
            activity:activities!activity_assignments_activity_id_fkey(id, activity_name, activity_code)
          )
        `)
        .order('created_at', { ascending: false });

      if (actorId) {
        query = query.eq('verified_by', actorId);
      }

      const { data: atts } = await query.limit(limit);
      (atts || []).forEach((att: any) => {
        const itemActId = att.activity_assignment?.activity?.id || att.activity_assignment?.activity_id;
        if (activityIdFilter && itemActId !== activityIdFilter) {
          return;
        }

        const isManual = att.check_in_method === 'manual';
        activitiesList.push({
          id: `att-${att.id}`,
          timestamp: att.verified_at || att.created_at,
          category: 'attendance',
          actionTitle: isManual ? 'Pencatatan Presensi Manual' : 'Presensi Mandiri via QR',
          actionDescription: `${isManual ? 'Mencatat dan mengesahkan' : 'Melakukan presensi mandiri'} kehadiran "${att.activity_assignment?.member?.full_name || 'Anggota'}" pada agenda "${att.activity_assignment?.activity?.activity_name || 'Agenda'}". Status: ${att.check_in_status === 'on_time' ? 'Tepat Waktu' : 'Terlambat'}${att.attendance_note ? ` (Catatan: ${att.attendance_note})` : ''}.`,
          activityId: itemActId,
          activityName: att.activity_assignment?.activity?.activity_name || 'Agenda Kegiatan',
          activityCode: att.activity_assignment?.activity?.activity_code,
          actor: {
            id: att.verifier?.id || att.verified_by || att.activity_assignment?.member?.id,
            fullName: att.verifier?.full_name || (isManual ? 'Koordinator/Admin' : `${att.activity_assignment?.member?.full_name} (Mandiri)`),
            memberCode: att.verifier?.member_code || att.activity_assignment?.member?.member_code || '-',
            systemRole: att.verifier?.system_role || 'member',
            fieldName: att.verifier?.field?.field_name,
          },
          target: {
            type: 'Presensi',
            name: att.activity_assignment?.member?.full_name || 'Panitia',
            code: att.activity_assignment?.activity?.activity_code,
            detail: att.check_in_status === 'on_time' ? 'Tepat Waktu' : 'Terlambat',
          },
          metadata: {
            method: att.check_in_method,
            note: att.attendance_note,
          },
        });
      });
    }

    // 3. Log Dispensasi Izin & Riwayat Perubahan Status Penugasan (assignment_history & manual_attendance_requests)
    if (category === 'all' || category === 'excuse') {
      // 3a. Dari assignment_history (perubahan izin langsung oleh koordinator/admin di lapangan)
      let histQuery = supabaseAdmin
        .from('assignment_history')
        .select(`
          id,
          created_at,
          previous_status,
          new_status,
          change_reason,
          action_by,
          actor:profiles!assignment_history_action_by_fkey(id, full_name, member_code, system_role, field:fields!profiles_field_id_fkey(field_name)),
          activity_assignment:activity_assignments!assignment_history_activity_assignment_id_fkey(
            activity_id,
            member:profiles!activity_assignments_member_id_fkey(id, full_name, member_code),
            activity:activities!activity_assignments_activity_id_fkey(id, activity_name, activity_code)
          )
        `)
        .order('created_at', { ascending: false });

      if (actorId) {
        histQuery = histQuery.eq('action_by', actorId);
      }

      const { data: hists } = await histQuery.limit(limit);
      (hists || []).forEach((h: any) => {
        const itemActId = h.activity_assignment?.activity?.id || h.activity_assignment?.activity_id;
        if (activityIdFilter && itemActId !== activityIdFilter) {
          return;
        }

        const isExcuse = h.new_status === 'excused';
        activitiesList.push({
          id: `hist-${h.id}`,
          timestamp: h.created_at,
          category: 'excuse',
          actionTitle: isExcuse ? 'Pemberian Dispensasi Izin Lapangan' : 'Pengaktifan Kembali Status Penugasan',
          actionDescription: `${isExcuse ? 'Memberikan dispensasi izin' : 'Mengembalikan status aktif'} untuk panitia "${h.activity_assignment?.member?.full_name || 'Panitia'}" pada agenda "${h.activity_assignment?.activity?.activity_name || 'Agenda'}". Alasan: "${h.change_reason || '-'}"`,
          activityId: itemActId,
          activityName: h.activity_assignment?.activity?.activity_name || 'Agenda Kegiatan',
          activityCode: h.activity_assignment?.activity?.activity_code,
          actor: {
            id: h.actor?.id || h.action_by,
            fullName: h.actor?.full_name || 'Koordinator / Admin',
            memberCode: h.actor?.member_code || '-',
            systemRole: h.actor?.system_role || 'coordinator',
            fieldName: h.actor?.field?.field_name,
          },
          target: {
            type: 'Dispensasi',
            name: h.activity_assignment?.member?.full_name || 'Panitia',
            code: h.activity_assignment?.member?.member_code,
            detail: h.new_status,
          },
          metadata: {
            reason: h.change_reason,
            newStatus: h.new_status,
          },
        });
      });

      // 3b. Dari manual_attendance_requests (permohonan mandiri & persetujuannya)
      let reqQuery = supabaseAdmin
        .from('manual_attendance_requests')
        .select(`
          id,
          created_at,
          reviewed_at,
          review_status,
          review_note,
          reason,
          attendance_type,
          claimed_event_time,
          requested_by,
          reviewed_by,
          requester:profiles!manual_attendance_requests_requested_by_fkey(id, full_name, member_code, system_role),
          reviewer:profiles!manual_attendance_requests_reviewed_by_fkey(id, full_name, member_code, system_role, field:fields!profiles_field_id_fkey(field_name)),
          activity_assignment:activity_assignments!manual_attendance_requests_activity_assignment_id_fkey(
            activity_id,
            activity:activities!activity_assignments_activity_id_fkey(id, activity_name, activity_code)
          )
        `)
        .order('created_at', { ascending: false });

      if (actorId) {
        reqQuery = reqQuery.or(`requested_by.eq.${actorId},reviewed_by.eq.${actorId}`);
      }

      const { data: reqs } = await reqQuery.limit(limit);
      (reqs || []).forEach((req: any) => {
        const itemActId = req.activity_assignment?.activity?.id || req.activity_assignment?.activity_id;
        if (activityIdFilter && itemActId !== activityIdFilter) {
          return;
        }

        // Jika sudah ditinjau, buat log keputusan peninjau
        if (req.review_status !== 'pending' && req.reviewed_by) {
          activitiesList.push({
            id: `req-rev-${req.id}`,
            timestamp: req.reviewed_at || req.created_at,
            category: 'excuse',
            actionTitle: req.review_status === 'approved' ? 'Persetujuan Dispensasi Izin' : 'Penolakan Dispensasi Izin',
            actionDescription: `${req.review_status === 'approved' ? 'Menyetujui' : 'Menolak'} permohonan izin "${req.requester?.full_name || 'Panitia'}" untuk agenda "${req.activity_assignment?.activity?.activity_name || 'Agenda'}". Catatan Peninjau: ${req.review_note || '-'}. Alasan awal: "${req.reason}".`,
            activityId: itemActId,
            activityName: req.activity_assignment?.activity?.activity_name || 'Agenda Kegiatan',
            activityCode: req.activity_assignment?.activity?.activity_code,
            actor: {
              id: req.reviewer?.id || req.reviewed_by,
              fullName: req.reviewer?.full_name || 'Koordinator / Admin',
              memberCode: req.reviewer?.member_code || '-',
              systemRole: req.reviewer?.system_role || 'coordinator',
              fieldName: req.reviewer?.field?.field_name,
            },
            target: {
              type: 'Dispensasi',
              name: req.requester?.full_name || 'Pemohon',
              code: req.requester?.member_code,
              detail: req.review_status,
            },
            metadata: {
              status: req.review_status,
              note: req.review_note,
            },
          });
        }

        // Log saat permohonan pertama kali diajukan oleh pemohon
        activitiesList.push({
          id: `req-sub-${req.id}`,
          timestamp: req.created_at,
          category: 'excuse',
          actionTitle: 'Pengajuan Dispensasi Izin / Presensi',
          actionDescription: `Mengajukan permohonan ${req.reason?.includes('[IZIN') ? 'dispensasi izin' : 'presensi manual'} untuk agenda "${req.activity_assignment?.activity?.activity_name || 'Agenda'}". Alasan: "${req.reason}".`,
          activityId: itemActId,
          activityName: req.activity_assignment?.activity?.activity_name || 'Agenda Kegiatan',
          activityCode: req.activity_assignment?.activity?.activity_code,
          actor: {
            id: req.requester?.id || req.requested_by,
            fullName: req.requester?.full_name || 'Panitia',
            memberCode: req.requester?.member_code || '-',
            systemRole: req.requester?.system_role || 'member',
          },
          target: {
            type: 'Permohonan',
            name: req.activity_assignment?.activity?.activity_name || 'Agenda',
            code: req.activity_assignment?.activity?.activity_code,
          },
          metadata: {
            reason: req.reason,
          },
        });
      });
    }

    // 4. Log Penilaian Kinerja Koordinator (performance_reviews)
    if ((category === 'all' || category === 'evaluation') && !activityIdFilter) {
      let query = supabaseAdmin
        .from('performance_reviews')
        .select(`
          id,
          created_at,
          updated_at,
          reviewer_id,
          member_id,
          total_weighted_score,
          review_status,
          evidence_note,
          reviewer:profiles!performance_reviews_reviewer_id_fkey(id, full_name, member_code, system_role, field:fields!profiles_field_id_fkey(field_name)),
          member:profiles!performance_reviews_member_id_fkey(id, full_name, member_code, organization_position)
        `)
        .order('updated_at', { ascending: false });

      if (actorId) {
        query = query.eq('reviewer_id', actorId);
      }

      const { data: revs } = await query.limit(limit);
      (revs || []).forEach((rev: any) => {
        activitiesList.push({
          id: `rev-${rev.id}`,
          timestamp: rev.updated_at || rev.created_at,
          category: 'evaluation',
          actionTitle: 'Evaluasi Nilai Kinerja Panitia',
          actionDescription: `Menginput / memperbarui penilaian rubrik 60 poin untuk "${rev.member?.full_name || 'Panitia'}" (${rev.member?.organization_position || 'Anggota'}). Total Skor Rubrik: ${rev.total_weighted_score}/60.00.${rev.evidence_note ? ` Catatan: "${rev.evidence_note}"` : ''}`,
          actor: {
            id: rev.reviewer?.id || rev.reviewer_id,
            fullName: rev.reviewer?.full_name || 'Koordinator / Admin',
            memberCode: rev.reviewer?.member_code || '-',
            systemRole: rev.reviewer?.system_role || 'coordinator',
            fieldName: rev.reviewer?.field?.field_name,
          },
          target: {
            type: 'Nilai Kinerja',
            name: rev.member?.full_name || 'Panitia',
            code: rev.member?.member_code,
            detail: `${rev.total_weighted_score} Pts`,
          },
          metadata: {
            score: rev.total_weighted_score,
          },
        });
      });
    }

    // 5. Log Pembuatan & Perubahan Agenda (activities)
    if (category === 'all' || category === 'activity') {
      let query = supabaseAdmin
        .from('activities')
        .select(`
          id,
          created_at,
          updated_at,
          activity_name,
          activity_code,
          activity_location,
          start_at,
          activity_status,
          created_by,
          creator:profiles!activities_created_by_fkey(id, full_name, member_code, system_role, field:fields!profiles_field_id_fkey(field_name))
        `)
        .order('created_at', { ascending: false });

      if (activityIdFilter) {
        query = query.eq('id', activityIdFilter);
      }
      if (actorId) {
        query = query.eq('created_by', actorId);
      }

      const { data: acts } = await query.limit(limit);
      (acts || []).forEach((act: any) => {
        activitiesList.push({
          id: `act-${act.id}`,
          timestamp: act.created_at,
          category: 'activity',
          actionTitle: 'Pembuatan Agenda Kegiatan Baru',
          actionDescription: `Membuat agenda kegiatan "${act.activity_name}" (${act.activity_code}) bertempat di "${act.activity_location}". Status: ${act.activity_status}.`,
          activityId: act.id,
          activityName: act.activity_name,
          activityCode: act.activity_code,
          actor: {
            id: act.creator?.id || act.created_by,
            fullName: act.creator?.full_name || 'Panitia',
            memberCode: act.creator?.member_code || '-',
            systemRole: act.creator?.system_role || 'admin',
            fieldName: act.creator?.field?.field_name,
          },
          target: {
            type: 'Agenda',
            name: act.activity_name,
            code: act.activity_code,
          },
        });
      });
    }

    // Urutkan semua aktivitas secara kronologis terbalik (terbaru di atas)
    activitiesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter teks pencarian jika ada
    let filtered = activitiesList;
    if (search) {
      filtered = activitiesList.filter((item) => {
        return (
          item.actionTitle.toLowerCase().includes(search) ||
          item.actionDescription.toLowerCase().includes(search) ||
          item.actor.fullName.toLowerCase().includes(search) ||
          item.actor.memberCode.toLowerCase().includes(search) ||
          (item.activityName && item.activityName.toLowerCase().includes(search)) ||
          (item.activityCode && item.activityCode.toLowerCase().includes(search)) ||
          (item.target?.name && item.target.name.toLowerCase().includes(search)) ||
          (item.target?.code && item.target.code.toLowerCase().includes(search))
        );
      });
    }

    // Ambil daftar seluruh aktor unik secara statis dari profil koordinator dan admin
    const { data: allActors } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, member_code, system_role')
      .in('system_role', ['admin', 'coordinator'])
      .order('full_name');

    const actors = (allActors || []).map((a) => ({
      id: a.id,
      fullName: a.full_name,
      memberCode: a.member_code,
      systemRole: a.system_role,
    }));

    return NextResponse.json({
      success: true,
      totalCount: filtered.length,
      data: filtered.slice(0, limit),
      actors,
      activities: dbActivities || [],
      stats: {
        total: activitiesList.length,
        assignments: activitiesList.filter((a) => a.category === 'assignment').length,
        attendances: activitiesList.filter((a) => a.category === 'attendance').length,
        excuses: activitiesList.filter((a) => a.category === 'excuse').length,
        evaluations: activitiesList.filter((a) => a.category === 'evaluation').length,
        activities: activitiesList.filter((a) => a.category === 'activity').length,
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/audit-logs:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal server' }, { status: 500 });
  }
}
