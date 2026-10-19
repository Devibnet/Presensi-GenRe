import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const filterFieldId = searchParams.get('fieldId');

    // 1. Ambil Periode Aktif
    const { data: periodData } = await supabaseAdmin
      .from('organization_periods')
      .select('id, period_name, period_code, certificate_threshold, start_date, end_date')
      .eq('period_status', 'active')
      .maybeSingle();

    const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';
    const certThreshold = Number(periodData?.certificate_threshold || 75.0);

    // 2. Ambil Seluruh Divisi / Bidang
    const { data: rawFields } = await supabaseAdmin
      .from('fields')
      .select(`
        id,
        period_id,
        field_name,
        field_code,
        field_description,
        coordinator_id,
        field_status,
        coordinator:profiles!fk_fields_coordinator(id, full_name, email, phone_number)
      `)
      .order('field_name');

    const fieldsList = rawFields || [];

    // 3. Ambil Seluruh Profil Panitia Aktif
    const { data: rawProfiles } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        member_code,
        full_name,
        email,
        phone_number,
        field_id,
        system_role,
        organization_position,
        account_status,
        joined_at
      `)
      .eq('account_status', 'active')
      .order('member_code');

    const profilesList = rawProfiles || [];

    // 4. Ambil Evaluasi Akhir (final_evaluations)
    const { data: rawFinalEvals } = await supabaseAdmin
      .from('final_evaluations')
      .select(`
        id,
        period_id,
        member_id,
        attendance_points,
        punctuality_points,
        task_completion_points,
        system_score,
        coordinator_score,
        final_score,
        evaluation_status,
        certificate_eligibility_status,
        calculated_at,
        approved_at
      `)
      .eq('period_id', periodId);

    const finalEvalsMap = new Map<string, any>();
    (rawFinalEvals || []).forEach((fe) => {
      finalEvalsMap.set(fe.member_id, fe);
    });

    // 5. Ambil Sertifikat Resmi (certificates)
    const { data: rawCerts } = await supabaseAdmin
      .from('certificates')
      .select(`
        id,
        final_evaluation_id,
        certificate_number,
        certificate_status,
        issued_at,
        issued_by,
        created_at
      `);

    const certsByEvalId = new Map<string, any>();
    (rawCerts || []).forEach((c) => {
      certsByEvalId.set(c.final_evaluation_id, c);
    });

    // 6. Ambil Klarifikasi (clarification_requests)
    const { data: rawClarifications } = await supabaseAdmin
      .from('clarification_requests')
      .select(`
        id,
        period_id,
        member_id,
        related_activity_id,
        request_type,
        request_status,
        request_description,
        resolution_note,
        created_at,
        resolved_at,
        member:profiles!clarification_requests_member_id_fkey(full_name, member_code),
        activity:activities!clarification_requests_related_activity_id_fkey(activity_name, activity_code)
      `)
      .order('created_at', { ascending: false });

    const openClarificationsSet = new Set<string>();
    (rawClarifications || []).forEach((cl) => {
      if (cl.request_status === 'submitted' || cl.request_status === 'under_review') {
        openClarificationsSet.add(cl.member_id);
      }
    });

    // 7. Ambil Agenda Kegiatan & Presensi
    const { data: rawActivities } = await supabaseAdmin
      .from('activities')
      .select(`
        id,
        period_id,
        activity_code,
        activity_name,
        activity_description,
        activity_location,
        start_at,
        end_at,
        activity_status,
        attendance_required
      `)
      .order('start_at', { ascending: true });

    const activitiesList = rawActivities || [];

    // Ambil rekapitulasi presensi dari v_activity_attendance_summary jika tersedia
    const { data: viewActSummary } = await supabaseAdmin
      .from('v_activity_attendance_summary')
      .select('*');

    const actSummaryMap = new Map<string, any>();
    (viewActSummary || []).forEach((as) => {
      actSummaryMap.set(as.activity_id, as);
    });

    // Jika view kosong atau belum terisi, hitung manual dari activity_assignments & attendances
    const { data: rawAssignments } = await supabaseAdmin
      .from('activity_assignments')
      .select(`
        id,
        activity_id,
        member_id,
        assignment_status,
        attendances (
          id,
          check_in_at,
          check_in_status,
          verification_status,
          check_out_at
        )
      `)
      .eq('assignment_status', 'active');

    const activityStatsMap = new Map<string, { assigned: number; onTime: number; late: number; attended: number; absent: number }>();
    (rawAssignments || []).forEach((asg) => {
      if (!activityStatsMap.has(asg.activity_id)) {
        activityStatsMap.set(asg.activity_id, { assigned: 0, onTime: 0, late: 0, attended: 0, absent: 0 });
      }
      const st = activityStatsMap.get(asg.activity_id)!;
      st.assigned++;

      const atts = asg.attendances as any[];
      const approvedAtt = atts?.find((a) => a.verification_status === 'approved' && a.check_in_at);
      if (approvedAtt) {
        st.attended++;
        if (approvedAtt.check_in_status === 'on_time') {
          st.onTime++;
        } else if (approvedAtt.check_in_status === 'late') {
          st.late++;
        }
      } else {
        st.absent++;
      }
    });

    const enrichedActivities = activitiesList.map((act) => {
      const fromView = actSummaryMap.get(act.id);
      const fromManual = activityStatsMap.get(act.id) || { assigned: 0, onTime: 0, late: 0, attended: 0, absent: 0 };

      const totalAssigned = fromView ? Number(fromView.total_assigned_members || 0) : fromManual.assigned;
      const totalOnTime = fromView ? Number(fromView.total_on_time || 0) : fromManual.onTime;
      const totalLate = fromView ? Number(fromView.total_late || 0) : fromManual.late;
      const totalAttended = fromView ? Number(fromView.total_checked_in || 0) : fromManual.attended;
      const totalAbsent = totalAssigned > totalAttended ? totalAssigned - totalAttended : 0;
      const attendanceRate = totalAssigned > 0 ? Number(((totalAttended / totalAssigned) * 100).toFixed(1)) : 0;

      return {
        id: act.id,
        activity_code: act.activity_code,
        activity_name: act.activity_name,
        activity_description: act.activity_description,
        activity_location: act.activity_location,
        start_at: act.start_at,
        end_at: act.end_at,
        activity_status: act.activity_status,
        attendance_required: act.attendance_required,
        total_assigned: totalAssigned,
        total_on_time: totalOnTime,
        total_late: totalLate,
        total_checked_in: totalAttended,
        total_absent_or_excused: totalAbsent,
        attendance_rate: attendanceRate,
      };
    });

    // 8. Bentuk Rekapitulasi Lengkap Seluruh Panitia (memberRecap)
    const fieldMap = new Map<string, any>();
    fieldsList.forEach((f) => fieldMap.set(f.id, f));

    const memberRecap = profilesList.map((p) => {
      const f = p.field_id ? fieldMap.get(p.field_id) : null;
      const fe = finalEvalsMap.get(p.id) || null;
      const cert = fe ? certsByEvalId.get(fe.id) : null;
      const hasClarification = openClarificationsSet.has(p.id);

      const coordObj = Array.isArray(f?.coordinator) ? f.coordinator[0] : f?.coordinator;
      const sysScore = Number(fe?.system_score ?? 0.0);
      const coordScore = Number(fe?.coordinator_score ?? 0.0);
      const finalScore = Number(fe?.final_score ?? (sysScore + coordScore));
      const isEligible = finalScore >= certThreshold;

      let certEligibility = fe?.certificate_eligibility_status || (finalScore > 0 ? (isEligible ? 'eligible' : 'ineligible') : 'pending');
      if (hasClarification) certEligibility = 'pending';

      return {
        member_id: p.id,
        member_code: p.member_code,
        full_name: p.full_name,
        email: p.email,
        phone_number: p.phone_number,
        system_role: p.system_role,
        organization_position: p.organization_position,
        field_id: p.field_id,
        field_name: f ? f.field_name : (p.organization_position || 'Umum'),
        field_code: f ? f.field_code : '-',
        coordinator_name: coordObj?.full_name || null,
        attendance_points: Number(fe?.attendance_points ?? 0.0),
        punctuality_points: Number(fe?.punctuality_points ?? 0.0),
        task_completion_points: Number(fe?.task_completion_points ?? 0.0),
        system_score: sysScore,
        coordinator_score: coordScore,
        final_score: finalScore,
        evaluation_status: hasClarification ? 'clarification_open' : (fe?.evaluation_status || 'calculating'),
        certificate_eligibility_status: certEligibility,
        certificate_number: cert?.certificate_number || null,
        certificate_status: cert?.certificate_status || (isEligible && finalScore > 0 ? 'eligible_unissued' : 'ineligible'),
        certificate_id: cert?.id || null,
        has_open_clarification: hasClarification,
      };
    });

    // 9. Agregasi Kinerja per Divisi / Bidang (Field Performance Overview)
    const fieldSummaries = fieldsList
      .map((f) => {
        const fieldMembers = memberRecap.filter((m) => m.field_id === f.id);
        const totalMembers = fieldMembers.length;

        let avgSys = 0;
        let avgCoord = 0;
        let avgFinal = 0;
        let eligibleCount = 0;

        if (totalMembers > 0) {
          const sumSys = fieldMembers.reduce((acc, m) => acc + m.system_score, 0);
          const sumCoord = fieldMembers.reduce((acc, m) => acc + m.coordinator_score, 0);
          const sumFinal = fieldMembers.reduce((acc, m) => acc + m.final_score, 0);
          eligibleCount = fieldMembers.filter((m) => m.certificate_eligibility_status === 'eligible').length;

          avgSys = Number((sumSys / totalMembers).toFixed(2));
          avgCoord = Number((sumCoord / totalMembers).toFixed(2));
          avgFinal = Number((sumFinal / totalMembers).toFixed(2));
        }

        const eligPct = totalMembers > 0 ? Number(((eligibleCount / totalMembers) * 100).toFixed(1)) : 0;
        const coordObj = Array.isArray(f?.coordinator) ? f.coordinator[0] : f?.coordinator;

        return {
          field_id: f.id,
          field_name: f.field_name,
          field_code: f.field_code,
          coordinator_name: coordObj?.full_name || (f.field_code === 'PNJ' ? 'Ida Bagus Angga Prabaswara' : f.field_code === 'KPT' ? 'Sukkun Siregar' : f.field_code === 'SEK' ? 'Kadek Dari Widia Ningsih' : f.field_code === 'BEN' ? 'Made Melda Yogiani' : '-'),
          coordinator_email: coordObj?.email || null,
          total_members: totalMembers,
          average_system_score: avgSys,
          average_coordinator_score: avgCoord,
          average_final_score: avgFinal,
          eligible_count: eligibleCount,
          eligibility_percentage: eligPct,
        };
      })
      .filter((f) => f.total_members > 0)
      .sort((a, b) => b.total_members - a.total_members);

    // 10. Agregasi Master KPI Metrics
    const totalPanitia = memberRecap.length;
    const totalEligible = memberRecap.filter((m) => m.certificate_eligibility_status === 'eligible').length;
    const totalIneligible = memberRecap.filter((m) => m.certificate_eligibility_status === 'ineligible').length;
    const totalPending = memberRecap.filter((m) => m.certificate_eligibility_status === 'pending').length;
    const overallEligPct = totalPanitia > 0 ? Number(((totalEligible / totalPanitia) * 100).toFixed(1)) : 0;

    const totalAssignedActivities = enrichedActivities.reduce((acc, a) => acc + a.total_assigned, 0);
    const totalPresentActivities = enrichedActivities.reduce((acc, a) => acc + a.total_checked_in, 0);
    const totalOnTimeActivities = enrichedActivities.reduce((acc, a) => acc + a.total_on_time, 0);
    const overallAttRate = totalAssignedActivities > 0
      ? Number(((totalPresentActivities / totalAssignedActivities) * 100).toFixed(1))
      : 0.0;
    const overallOnTimeRate = totalPresentActivities > 0
      ? Number(((totalOnTimeActivities / totalPresentActivities) * 100).toFixed(1))
      : 0.0;

    const avgOverallFinalScore = totalPanitia > 0
      ? Number((memberRecap.reduce((acc, m) => acc + m.final_score, 0) / totalPanitia).toFixed(2))
      : 0;

    const totalCertificatesIssued = Array.from(certsByEvalId.values()).filter(c => c.certificate_status === 'issued').length;

    // Filter jika fieldId spesifik diminta
    let filteredMemberRecap = memberRecap;
    if (filterFieldId && filterFieldId !== 'all') {
      filteredMemberRecap = memberRecap.filter((m) => m.field_id === filterFieldId);
    }

    return NextResponse.json({
      success: true,
      period: periodData,
      overview: {
        totalMembers: totalPanitia,
        totalFields: fieldsList.length,
        totalActivities: enrichedActivities.length,
        totalAssignedActivities,
        totalPresentActivities,
        totalOnTimeActivities,
        overallAttendanceRate: overallAttRate,
        overallOnTimeRate: overallOnTimeRate,
        totalEligible,
        totalIneligible,
        totalPending,
        overallEligibilityPercentage: overallEligPct,
        totalCertificatesIssued,
        totalClarifications: (rawClarifications || []).length,
        averageFinalScore: avgOverallFinalScore,
        certificateThreshold: certThreshold,
      },
      fieldSummaries,
      activitySummaries: enrichedActivities,
      memberRecap: filteredMemberRecap,
      clarifications: rawClarifications || [],
      certificates: Array.from(certsByEvalId.values()),
    });
  } catch (err: any) {
    console.error('Error in GET /api/reports:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan server saat memuat laporan' }, { status: 500 });
  }
}
