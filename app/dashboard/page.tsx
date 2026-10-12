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

  let userRole: SystemRole = 'admin';
  let userId: string = '';
  let userFieldId: string | null = null;
  let userFieldName: string = 'Badan Pengurus Harian';
  let userName = 'Putu Gede Adnyana';

  // 1. Ambil Identitas Pengguna
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      userId = user.id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, system_role, field_id, field:fields(field_name)')
        .eq('id', user.id)
        .single();

      if (profile) {
        userRole = profile.system_role as SystemRole;
        userName = profile.full_name;
        userFieldId = profile.field_id;
        userFieldName = (profile.field as any)?.field_name || 'Umum';
      }
    }
  } catch (e) {
    // Demo fallback
  }

  // 2. Ambil Data Real dari Database Supabase
  let activeMembersCount = 12;
  let activitiesCount = 4;
  let pendingManualCount = 1;
  let openClarificationsCount = 1;
  let activitiesList: any[] = [];
  let userAssignments: any[] = [];
  let userTasks: any[] = [];
  let finalEval: any = null;

  try {
    // Total Anggota
    const { count: mCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('account_status', 'active');
    if (mCount !== null) activeMembersCount = mCount;

    // Total Kegiatan
    const { data: acts } = await supabase
      .from('activities')
      .select('id, activity_code, activity_name, start_at, activity_status, activity_location')
      .order('start_at', { ascending: true })
      .limit(5);
    if (acts && acts.length > 0) {
      activitiesList = acts;
      activitiesCount = acts.length;
    }

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
    // Fallback gracefully
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden glass-panel p-6 sm:p-8 border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-genre-500/20 to-transparent blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(userRole)}`}>
                {getRoleLabel(userRole)}
              </span>
              <span className="text-xs text-slate-400 font-medium">Divisi: {userFieldName}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Selamat Datang, {userName}! 👋
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-xl leading-relaxed">
              Pantau jadwal kepanitiaan, presensi QR dinamis, penugasan tugas mandiri, dan kelayakan sertifikat Pemilihan Duta GenRe Kabupaten Buleleng 2026.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {userRole === 'admin' && (
              <Link
                href="/dashboard/members"
                className="px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-genre-600 hover:bg-genre-500 transition-colors shadow-lg shadow-genre-500/20 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Impor Panitia CSV</span>
              </Link>
            )}
            <Link
              href="/dashboard/attendance"
              className="px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-genre-400" />
              <span>Buka Scanner Presensi</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="hover:border-genre-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Panitia Aktif</span>
            <div className="w-9 h-9 rounded-xl bg-genre-500/10 border border-genre-500/20 flex items-center justify-center text-genre-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activeMembersCount}</span>
            <span className="text-xs text-slate-400">anggota terdaftar</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Tersebar di 6 divisi kepanitiaan</p>
        </Card>

        <Card className="hover:border-genre-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Agenda Kegiatan</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activitiesCount}</span>
            <span className="text-xs text-slate-400">agenda resmi</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Pleno, Workshop, Gladi, & Grand Final</p>
        </Card>

        <Card className="hover:border-genre-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Verifikasi Presensi</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{pendingManualCount}</span>
            <span className="text-xs text-amber-400 font-medium">permohonan tertunda</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Menunggu keputusan koordinator/admin</p>
        </Card>

        <Card className="hover:border-genre-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Klarifikasi Terbuka</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{openClarificationsCount}</span>
            <span className="text-xs text-purple-400 font-medium">sanggahan aktif</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Menahan penetapan sertifikat akhir</p>
        </Card>
      </div>

      {/* Role-Specific Sections */}
      {userRole === 'member' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member Score Card */}
          <Card
            title="Capaian Nilai Panitia Saya"
            subtitle="Formula resmi 40 poin sistem + 60 poin koordinator"
            className="lg:col-span-1"
          >
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Skor Sistem (Maks 40)</span>
                  <span className="text-2xl font-bold text-teal-300">
                    {finalEval ? Number(finalEval.system_score).toFixed(1) : '40.0'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Evaluasi Koordinator (Maks 60)</span>
                  <span className="text-2xl font-bold text-purple-300">
                    {finalEval ? Number(finalEval.coordinator_score).toFixed(1) : '57.6'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-genre-950/60 to-slate-900/80 border border-genre-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase">Nilai Akhir Total</span>
                  <Badge 
                    status={finalEval?.certificate_eligibility_status || 'eligible'} 
                    label={finalEval?.certificate_eligibility_status === 'eligible' ? 'Layak Sertifikat' : 'Pending'} 
                  />
                </div>
                <div className="mt-2 text-4xl font-extrabold text-white">
                  {finalEval ? Number(finalEval.final_score).toFixed(1) : '97.6'}
                  <span className="text-sm font-normal text-slate-400"> / 100</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Ambang batas kelulusan sertifikat: 75.00 poin
                </p>
              </div>

              <Link
                href="/dashboard/certificates"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center text-genre-300 bg-genre-500/10 hover:bg-genre-500/20 border border-genre-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <Award className="w-4 h-4" />
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
            <div className="space-y-3">
              {activitiesList.slice(0, 3).map((act, idx) => (
                <div
                  key={act.id || idx}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-genre-400">{act.activity_code}</span>
                      <Badge status={act.activity_status} />
                    </div>
                    <h4 className="font-bold text-white text-sm mt-1">{act.activity_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{act.activity_location}</p>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {formatDateTimeWITA(act.start_at)}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/attendance`}
                    className="px-3.5 py-2 rounded-lg bg-genre-600/20 hover:bg-genre-600/30 border border-genre-500/30 text-genre-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors self-start sm:self-center"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Check-in QR</span>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Admin / Coordinator Quick Management Section */}
      {(userRole === 'admin' || userRole === 'coordinator') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Action Center */}
          <Card
            title="Pusat Tindakan & Kontrol"
            subtitle="Navigasi cepat untuk koordinasi operasional panitia"
            className="lg:col-span-1"
          >
            <div className="space-y-3 text-xs">
              <Link
                href="/dashboard/attendance/manage"
                className="w-full p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-200 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold block">Verifikasi Presensi Manual</span>
                    <span className="text-[11px] text-slate-400">Tinjau bukti & dispensasi panitia</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/dashboard/evaluations"
                className="w-full p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-200 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Star className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold block">Lembar Evaluasi Kinerja (60 Poin)</span>
                    <span className="text-[11px] text-slate-400">5 kriteria rubrik koordinator</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/dashboard/tasks"
                className="w-full p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-200 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold block">Delegasi & Cek Tugas</span>
                    <span className="text-[11px] text-slate-400">Kelola progres tugas mandiri</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </Link>

              {userRole === 'admin' && (
                <Link
                  href="/dashboard/certificates"
                  className="w-full p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-200 flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold block">Pengesahan & Terbit Sertifikat</span>
                      <span className="text-[11px] text-slate-400">Validasi ambang 75 poin</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
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
                className="text-xs text-genre-400 hover:text-genre-300 font-semibold flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <div className="space-y-3">
              {activitiesList.map((act) => (
                <div
                  key={act.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-genre-400">{act.activity_code}</span>
                      <Badge status={act.activity_status} />
                    </div>
                    <h4 className="font-bold text-white text-sm mt-1">{act.activity_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{act.activity_location}</p>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {formatDateTimeWITA(act.start_at)}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/activities/${act.id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <span>Detail & QR</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
