import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Award, 
  AlertTriangle, 
  QrCode, 
  ArrowRight, 
  Star,
  FileSpreadsheet,
  CheckSquare,
  HelpCircle
} from 'lucide-react';
import { formatDateTimeWITA, getRoleBadgeClass, getRoleLabel } from '@/lib/utils';
import { SystemRole } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();

  let userRole: SystemRole = 'member';
  let userId: string = '';
  let userFieldId: string | null = null;
  let userFieldName: string = 'Panitia Pelaksana';
  let userName = 'Panitia GenRe';

  // 1. Ambil Identitas Pengguna
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      userId = user.id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, system_role, field_id, organization_position, field:fields!profiles_field_id_fkey(field_name)')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        userRole = (profile.system_role as SystemRole) || 'member';
        userName = profile.full_name || userName;
        userFieldId = profile.field_id;
        userFieldName = (profile.field as any)?.field_name || profile.organization_position || 'Panitia Pelaksana';
      }
    }
  } catch (e) {
    console.warn('Dashboard user profile load error:', e);
  }

  // 2. Ambil Data Real dari Database Supabase (Semua default 0 agar data akurat)
  let activeMembersCount = 0;
  let activitiesCount = 0;
  let pendingManualCount = 0;
  let openClarificationsCount = 0;
  let activitiesList: any[] = [];
  let userAssignments: any[] = [];
  let userTasks: any[] = [];
  let finalEval: any = null;

  try {
    // Total Anggota Aktif
    const { count: mCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('account_status', 'active');
    if (mCount !== null) activeMembersCount = mCount;

    // Total Agenda Kegiatan (Ambil total count dan list jadwal terbaru)
    const { count: actTotal, data: acts } = await supabase
      .from('activities')
      .select('id, activity_code, activity_name, start_at, activity_status, activity_location', { count: 'exact' })
      .order('start_at', { ascending: true });
    
    activitiesCount = actTotal ?? (acts?.length || 0);
    activitiesList = acts || [];

    // Permohonan presensi manual yang butuh verifikasi
    const { count: reqCount } = await supabase
      .from('manual_attendance_requests')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'pending');
    if (reqCount !== null) pendingManualCount = reqCount;

    // Sanggahan terbuka
    const { count: clarCount } = await supabase
      .from('clarification_requests')
      .select('*', { count: 'exact', head: true })
      .in('request_status', ['submitted', 'under_review']);
    if (clarCount !== null) openClarificationsCount = clarCount;

    // Penugasan spesifik untuk panitia yang sedang login
    if (userId) {
      const { data: assigns } = await supabase
        .from('activity_assignments')
        .select('*, activity:activities(*), attendance:attendances(*)')
        .eq('member_id', userId)
        .limit(5);
      if (assigns) userAssignments = assigns;

      const { data: tasks } = await supabase
        .from('task_assignments')
        .select('*, task:tasks(*)')
        .eq('member_id', userId)
        .limit(5);
      if (tasks) userTasks = tasks;

      const { data: fe } = await supabase
        .from('final_evaluations')
        .select('*')
        .eq('member_id', userId)
        .maybeSingle();
      if (fe) finalEval = fe;
    }
  } catch (err) {
    console.error('Dashboard data load error:', err);
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Welcome Hero Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-white p-5 sm:p-8 border border-slate-200 shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-teal-500/10 via-emerald-500/5 to-transparent blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(userRole)}`}>
                {getRoleLabel(userRole)}
              </span>
              <span className="text-xs text-slate-500 font-medium">Divisi: {userFieldName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Selamat Datang, {userName}! 👋
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
              Pantau jadwal kepanitiaan, presensi QR dinamis, penugasan mandiri, dan kelayakan sertifikat Pemilihan Duta GenRe Kabupaten Buleleng 2026.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {userRole === 'admin' && (
              <Link
                href="/dashboard/members"
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Impor Panitia CSV</span>
              </Link>
            )}
            <Link
              href="/dashboard/attendance"
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200/80 flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>Buka Scanner Presensi</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        <Card className="hover:border-teal-500/40 transition-all p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Panitia Aktif</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{activeMembersCount}</span>
            <span className="text-[11px] sm:text-xs text-slate-500">anggota</span>
          </div>
          <p className="mt-1.5 text-[10px] sm:text-[11px] text-slate-500">
            {activeMembersCount > 0 ? 'Tersebar di 12 divisi / sie' : 'Belum ada panitia aktif'}
          </p>
        </Card>

        <Card className="hover:border-blue-500/40 transition-all p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Agenda Kegiatan</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{activitiesCount}</span>
            <span className="text-[11px] sm:text-xs text-slate-500">agenda</span>
          </div>
          <p className="mt-1.5 text-[10px] sm:text-[11px] text-slate-500">
            {activitiesCount > 0 ? `${activitiesCount} agenda terdaftar` : 'Belum ada agenda dibuat'}
          </p>
        </Card>

        <Card className="hover:border-amber-500/40 transition-all p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Verifikasi Presensi</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{pendingManualCount}</span>
            <span className="text-[11px] sm:text-xs text-amber-700 font-semibold">tertunda</span>
          </div>
          <p className="mt-1.5 text-[10px] sm:text-[11px] text-slate-500">
            {pendingManualCount > 0 ? `${pendingManualCount} perlu persetujuan` : 'Semua presensi terverifikasi'}
          </p>
        </Card>

        <Card className="hover:border-purple-500/40 transition-all p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Klarifikasi Terbuka</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{openClarificationsCount}</span>
            <span className="text-[11px] sm:text-xs text-purple-700 font-semibold">sanggahan</span>
          </div>
          <p className="mt-1.5 text-[10px] sm:text-[11px] text-slate-500">
            {openClarificationsCount > 0 ? `${openClarificationsCount} menahan sertifikat` : 'Tidak ada sanggahan aktif'}
          </p>
        </Card>
      </div>

      {/* Role-Specific Sections */}
      {userRole === 'member' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Member Score Card */}
          <Card
            title="Capaian Nilai Panitia Saya"
            subtitle="Formula resmi 40 poin sistem + 60 poin koordinator"
            className="lg:col-span-1"
          >
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block font-medium">Skor Sistem (Maks 40)</span>
                  <span className="text-xl sm:text-2xl font-bold text-teal-700">
                    {finalEval ? Number(finalEval.system_score).toFixed(1) : '0.0'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block font-medium">Koordinator (Maks 60)</span>
                  <span className="text-xl sm:text-2xl font-bold text-purple-700">
                    {finalEval ? Number(finalEval.coordinator_score).toFixed(1) : '0.0'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 uppercase">Nilai Akhir Total</span>
                  <Badge 
                    status={finalEval ? (Number(finalEval.final_score || 0) >= 75 ? 'eligible' : 'ineligible') : 'pending'} 
                    label={finalEval ? (Number(finalEval.final_score || 0) >= 75 ? 'Layak Sertifikat' : 'Belum Layak') : 'Belum Dinilai'} 
                  />
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                  {finalEval ? Number(finalEval.final_score).toFixed(1) : '0.0'}
                  <span className="text-xs sm:text-sm font-normal text-slate-500"> / 100</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600">
                  Ambang batas kelulusan sertifikat: 75.00 poin
                </p>
              </div>

              <Link
                href="/dashboard/certificates"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center justify-center gap-2"
              >
                <Award className="w-4 h-4 text-teal-600" />
                <span>Lihat Sertifikat Kelulusan</span>
              </Link>
            </div>
          </Card>

          {/* Member Activities List */}
          <Card
            title="Kegiatan & Penugasan Wajib Saya"
            subtitle="Pastikan hadir tepat waktu dan lakukan pemindaian QR"
            className="lg:col-span-2"
          >
            {activitiesList.length === 0 ? (
              <div className="py-10 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-6">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Belum ada agenda kegiatan saat ini</p>
                <p className="text-[11px] text-slate-400 mt-1">Jadwal kegiatan kepanitiaan akan otomatis muncul di sini setelah dijadwalkan oleh Koordinator atau Admin.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activitiesList.slice(0, 3).map((act, idx) => (
                  <div
                    key={act.id || idx}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-teal-700">{act.activity_code}</span>
                        <Badge status={act.activity_status} />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{act.activity_name}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">{act.activity_location}</p>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {formatDateTimeWITA(act.start_at)}
                      </span>
                    </div>

                    <Link
                      href={`/dashboard/attendance`}
                      className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors self-start sm:self-center shadow-sm"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Check-in QR</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Admin / Coordinator Quick Management Section */}
      {(userRole === 'admin' || userRole === 'coordinator') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Action Center */}
          <Card
            title="Pusat Tindakan & Kontrol"
            subtitle="Navigasi cepat untuk koordinasi operasional panitia"
            className="lg:col-span-1"
          >
            <div className="space-y-2.5 sm:space-y-3 text-xs">
              <Link
                href="/dashboard/attendance/manage"
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-900">Verifikasi Presensi Manual</span>
                    <span className="text-[11px] text-slate-500">Tinjau bukti & dispensasi panitia</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-600 transition-all" />
              </Link>

              <Link
                href="/dashboard/activities"
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-900">Penugasan Panitia di Agenda</span>
                    <span className="text-[11px] text-slate-500">Tugaskan anggota sie per kegiatan</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-600 transition-all" />
              </Link>

              <Link
                href="/dashboard/evaluations"
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-800 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
                    <Star className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-900">Penilaian Panitia (Evaluasi 60 Poin)</span>
                    <span className="text-[11px] text-slate-500">Input 5 kriteria rubrik koordinator</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-600 transition-all" />
              </Link>

              {userRole === 'admin' && (
                <Link
                  href="/dashboard/certificates"
                  className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200 text-slate-800 flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold block text-slate-900">Pengesahan & Terbit Sertifikat</span>
                      <span className="text-[11px] text-slate-500">Validasi ambang 75 poin</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-600 transition-all" />
                </Link>
              )}
            </div>
          </Card>

          {/* Agenda Kegiatan Terbaru */}
          <Card
            title="Daftar Agenda Kegiatan Panitia"
            subtitle="Jadwal rangkaian Pemilihan Duta GenRe Buleleng 2026"
            className="lg:col-span-2"
            action={
              <Link
                href="/dashboard/activities"
                className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            {activitiesList.length === 0 ? (
              <div className="py-10 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-6">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Belum ada agenda kegiatan dibuat</p>
                <p className="text-[11px] text-slate-400 mt-1 mb-4">Buat agenda baru untuk memulai penugasan kepanitiaan dan presensi QR di lokasi.</p>
                <Link
                  href="/dashboard/activities"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Buat Agenda Baru</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activitiesList.slice(0, 5).map((act) => (
                  <div
                    key={act.id}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex items-center justify-between gap-3 sm:gap-4 hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-teal-700">{act.activity_code}</span>
                        <Badge status={act.activity_status} />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{act.activity_name}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">{act.activity_location}</p>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {formatDateTimeWITA(act.start_at)}
                      </span>
                    </div>

                    <Link
                      href={`/dashboard/activities/${act.id}`}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-200 shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <span>Detail & QR</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
