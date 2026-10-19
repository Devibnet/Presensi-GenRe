'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Award, 
  Clock, 
  FileSpreadsheet,
  Building,
  Activity as ActivityIcon,
  RefreshCw,
  Search,
  Filter,
  Printer,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Layers,
  FileText,
  AlertTriangle,
  ChevronRight,
  Check,
  Star
} from 'lucide-react';
import { formatDateTimeWITA } from '@/lib/utils';
import ReportCharts, {
  DivisionPerformanceBarChart,
  ActivityAttendanceColumnChart,
} from '@/components/reports/ReportCharts';

export default function ReportsPage() {
  const { toast } = useToast();

  // Data states
  const [dataPeriod, setDataPeriod] = useState<any>(null);
  const [overview, setOverview] = useState<any>({
    totalMembers: 0,
    totalFields: 0,
    totalActivities: 0,
    totalAssignedActivities: 0,
    totalPresentActivities: 0,
    totalOnTimeActivities: 0,
    overallAttendanceRate: 0.0,
    overallOnTimeRate: 0.0,
    totalEligible: 0,
    totalIneligible: 0,
    totalPending: 0,
    overallEligibilityPercentage: 0.0,
    totalCertificatesIssued: 0,
    totalClarifications: 0,
    averageFinalScore: 0.0,
    certificateThreshold: 75.0,
  });
  const [fieldSummaries, setFieldSummaries] = useState<any[]>([]);
  const [activitySummaries, setActivitySummaries] = useState<any[]>([]);
  const [memberRecap, setMemberRecap] = useState<any[]>([]);
  const [clarifications, setClarifications] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'fields' | 'members' | 'activities' | 'clarifications' | 'certificates'>('overview');

  // Filter & Search states
  const [searchMember, setSearchMember] = useState('');
  const [filterDivision, setFilterDivision] = useState('all');
  const [filterEligibility, setFilterEligibility] = useState('all');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'name_asc' | 'code_asc'>('score_desc');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async (isManualSync = false) => {
    if (!isManualSync) setLoading(true);
    try {
      const res = await fetch('/api/reports');
      const json = await res.json();

      if (res.ok && json.success) {
        if (json.period) setDataPeriod(json.period);
        if (json.overview) setOverview(json.overview);
        if (json.fieldSummaries) setFieldSummaries(json.fieldSummaries);
        if (json.activitySummaries) setActivitySummaries(json.activitySummaries);
        if (json.memberRecap) setMemberRecap(json.memberRecap);
        if (json.clarifications) setClarifications(json.clarifications);
        if (json.certificates) setCertificates(json.certificates);

        if (isManualSync) {
          toast.success('Sinkronisasi Sukses', 'Seluruh data laporan & statistik terintegrasi telah diperbarui secara akurat.');
        }
      } else {
        throw new Error(json.error || 'Gagal memuat data laporan');
      }
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      toast.error('Gagal Memuat Laporan', err.message || 'Terjadi kendala saat menghubungkan data laporan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Trigger Recalculate & Sync across all modules
  const handleRecalculateAll = async () => {
    setRefreshing(true);
    try {
      toast.info('Menghitung Ulang...', 'Memproses ulang skor sistem, presensi, tugas, dan evaluasi seluruh panitia.');
      const calcRes = await fetch('/api/evaluations/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const calcJson = await calcRes.json();
      if (!calcRes.ok) {
        console.warn('Perhitungan ulang sebagian:', calcJson.error);
      }
      // Re-fetch report data
      await fetchReportData(true);
    } catch (err: any) {
      console.error('Recalculate error:', err);
      toast.error('Gagal Menghitung Ulang', err.message);
      setRefreshing(false);
    }
  };

  // Filtered members calculation
  const filteredMembers = useMemo(() => {
    return memberRecap
      .filter((m) => {
        const matchSearch =
          m.full_name?.toLowerCase().includes(searchMember.toLowerCase()) ||
          m.member_code?.toLowerCase().includes(searchMember.toLowerCase()) ||
          m.field_name?.toLowerCase().includes(searchMember.toLowerCase()) ||
          m.email?.toLowerCase().includes(searchMember.toLowerCase());

        const matchDiv = filterDivision === 'all' || m.field_id === filterDivision;
        const matchElig =
          filterEligibility === 'all' ||
          (filterEligibility === 'eligible' && m.certificate_eligibility_status === 'eligible') ||
          (filterEligibility === 'ineligible' && m.certificate_eligibility_status === 'ineligible') ||
          (filterEligibility === 'pending' && m.certificate_eligibility_status === 'pending');

        return matchSearch && matchDiv && matchElig;
      })
      .sort((a, b) => {
        if (sortBy === 'score_desc') return b.final_score - a.final_score;
        if (sortBy === 'score_asc') return a.final_score - b.final_score;
        if (sortBy === 'name_asc') return a.full_name.localeCompare(b.full_name);
        if (sortBy === 'code_asc') return a.member_code.localeCompare(b.member_code);
        return 0;
      });
  }, [memberRecap, searchMember, filterDivision, filterEligibility, sortBy]);

  // Grade distributions calculation
  const gradeDistribution = useMemo(() => {
    const total = memberRecap.length;
    const evaluatedMembers = memberRecap.filter(
      (m) => m.final_score > 0 || (m.evaluation_status && m.evaluation_status !== 'calculating' && m.evaluation_status !== 'pending')
    );
    const totalEvaluated = evaluatedMembers.length;

    const gradeA = evaluatedMembers.filter((m) => m.final_score >= 90).length;
    const gradeB = evaluatedMembers.filter((m) => m.final_score >= 75 && m.final_score < 90).length;
    const gradeC = evaluatedMembers.filter((m) => m.final_score < 75).length;
    const pendingCount = total - totalEvaluated;

    return {
      total,
      totalEvaluated,
      gradeA,
      pctA: totalEvaluated > 0 ? Math.round((gradeA / totalEvaluated) * 100) : 0,
      gradeB,
      pctB: totalEvaluated > 0 ? Math.round((gradeB / totalEvaluated) * 100) : 0,
      gradeC,
      pctC: totalEvaluated > 0 ? Math.round((gradeC / totalEvaluated) * 100) : 0,
      pendingCount,
      pctPending: total > 0 ? Math.round((pendingCount / total) * 100) : 0,
    };
  }, [memberRecap]);

  // Export CSV Handlers
  const handleExportMembersCSV = () => {
    if (memberRecap.length === 0) return;
    const headers = [
      'No',
      'Kode Panitia',
      'Nama Lengkap',
      'Divisi / Bidang',
      'Jabatan Organisasi',
      'Poin Presensi Check-In (Max 20)',
      'Poin Ketepatan Waktu (Max 10)',
      'Poin Presensi Check-Out (Max 10)',
      'Skor Sistem (Max 40)',
      'Skor Koordinator (Max 60)',
      'Nilai Akhir (Max 100)',
      'Kelayakan Sertifikat',
      'Nomor Sertifikat',
      'Status Sertifikat'
    ];
    const rows = memberRecap.map((m, idx) => [
      idx + 1,
      `"${m.member_code}"`,
      `"${m.full_name}"`,
      `"${m.field_name}"`,
      `"${m.organization_position}"`,
      m.attendance_points,
      m.punctuality_points,
      m.task_completion_points,
      m.system_score,
      m.coordinator_score,
      m.final_score,
      `"${m.certificate_eligibility_status === 'eligible' ? 'Layak' : 'Belum Layak'}"`,
      `"${m.certificate_number || '-'}"`,
      `"${m.certificate_status}"`
    ]);

    downloadCSV(headers, rows, `laporan_lengkap_panitia_genre_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportFieldsCSV = () => {
    if (fieldSummaries.length === 0) return;
    const headers = [
      'Divisi / Bidang',
      'Kode Bidang',
      'Koordinator Penanggung Jawab',
      'Jumlah Panitia',
      'Rata-rata Skor Sistem (40)',
      'Rata-rata Nilai Koordinator (60)',
      'Rata-rata Nilai Akhir (100)',
      'Panitia Layak Sertifikat',
      'Persentase Kelulusan'
    ];
    const rows = fieldSummaries.map((f) => [
      `"${f.field_name}"`,
      `"${f.field_code}"`,
      `"${f.coordinator_name || '-'}"`,
      f.total_members,
      f.average_system_score,
      f.average_coordinator_score,
      f.average_final_score,
      f.eligible_count,
      `"${f.eligibility_percentage}%"`
    ]);

    downloadCSV(headers, rows, `laporan_kinerja_divisi_genre_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportActivitiesCSV = () => {
    if (activitySummaries.length === 0) return;
    const headers = [
      'Kode Agenda',
      'Nama Kegiatan',
      'Lokasi Pelaksanaan',
      'Jadwal Mulai',
      'Status Kegiatan',
      'Panitia Ditugaskan',
      'Tepat Waktu',
      'Terlambat',
      'Izin/Alpa',
      'Persentase Hadir'
    ];
    const rows = activitySummaries.map((a) => [
      `"${a.activity_code}"`,
      `"${a.activity_name}"`,
      `"${a.activity_location}"`,
      `"${a.start_at}"`,
      `"${a.activity_status}"`,
      a.total_assigned,
      a.total_on_time,
      a.total_late,
      a.total_absent_or_excused,
      `"${a.attendance_rate}%"`
    ]);

    downloadCSV(headers, rows, `laporan_presensi_kegiatan_genre_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadCSV = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
    toast.success('Ekspor Selesai', `Berkas ${filename} telah diunduh.`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in print:p-0 print:space-y-4">
      {/* =========================================================================
          PRINT HEADER (Visible only on print preview)
      ========================================================================= */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 text-center">
        <h1 className="text-xl font-bold tracking-tight uppercase text-slate-900">
          PEMILIHAN DUTA GENRE KABUPATEN BULELENG 2026/2027
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Laporan Rekapitulasi Kinerja Organisasi, Presensi Kegiatan, Evaluasi Sistem, dan Registrasi Sertifikat
        </p>
        <div className="text-[10px] text-slate-500 mt-2 flex justify-between">
          <span>Periode Resmi: GENRE-BL-2026</span>
          <span>Dicetak Pada: {formatDateTimeWITA(new Date().toISOString())}</span>
        </div>
      </div>

      {/* =========================================================================
          PAGE HEADER & TOP ACTION BUTTONS (Screen only)
      ========================================================================= */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Sistem Terintegrasi Penuh
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Periode: {dataPeriod?.period_name || 'Pemilihan Duta GenRe Buleleng 2026/2027'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="h-7 w-7 text-teal-600" />
            Laporan Kinerja & Statistik Organisasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Pusat analitik terpadu yang menyinkronkan data presensi kegiatan (check-in & check-out), ketepatan waktu, evaluasi skor koordinator (60), skor sistem (40), dan registrasi sertifikat resmi.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {/* Recalculate & Sync Button */}
          <button
            onClick={handleRecalculateAll}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs transition-all disabled:opacity-50"
            title="Hitung ulang evaluasi dan sinkronkan statistik terbaru"
          >
            <RefreshCw className={`h-4 w-4 text-teal-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Menyinkronkan...' : 'Hitung Ulang & Sinkronkan'}</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs transition-all"
            title="Cetak format laporan resmi"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Cetak Dokumen</span>
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2 rounded-xl shadow-xs shadow-teal-600/20 text-xs transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Ekspor Laporan (CSV)</span>
            </button>

            {exportMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setExportMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs text-slate-700 animate-fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Pilih Format Rekapitulasi
                  </div>
                  <button
                    onClick={handleExportMembersCSV}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2 transition-colors"
                  >
                    <Users className="h-4 w-4 text-teal-600" />
                    <span>Rekap Seluruh Panitia ({overview.totalMembers} Orang)</span>
                  </button>
                  <button
                    onClick={handleExportFieldsCSV}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2 transition-colors"
                  >
                    <Building className="h-4 w-4 text-teal-600" />
                    <span>Rekap Kinerja per Divisi ({overview.totalFields} Divisi)</span>
                  </button>
                  <button
                    onClick={handleExportActivitiesCSV}
                    className="w-full text-left px-3.5 py-2 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2 transition-colors"
                  >
                    <Calendar className="h-4 w-4 text-teal-600" />
                    <span>Rekap Presensi Kegiatan ({overview.totalActivities} Agenda)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODULE CONNECTIVITY HUB STRIP (Integrated with All Pages)
      ========================================================================= */}
      <div className="print:hidden bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-blue-50/40 p-4 rounded-2xl border border-teal-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-700" />
            <span className="text-xs font-bold text-slate-900">
              Navigasi Terintegrasi Lintas Modul & Halaman
            </span>
          </div>
          <span className="text-[11px] text-teal-700 font-medium">
            Semua perubahan pada setiap halaman otomatis tercermin dalam laporan ini
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Link
            href="/dashboard/members"
            className="p-2.5 bg-white hover:bg-teal-50/60 rounded-xl border border-slate-200/80 shadow-2xs transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-semibold">Panitia</span>
              <Users className="h-3.5 w-3.5 text-teal-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-extrabold text-sm text-slate-900">{overview.totalMembers} Anggota</div>
            <div className="text-[10px] text-teal-600 flex items-center gap-0.5 mt-1 font-medium">
              Buka Modul <ChevronRight className="h-2.5 w-2.5" />
            </div>
          </Link>

          <Link
            href="/dashboard/activities"
            className="p-2.5 bg-white hover:bg-teal-50/60 rounded-xl border border-slate-200/80 shadow-2xs transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-semibold">Kegiatan</span>
              <Calendar className="h-3.5 w-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-extrabold text-sm text-slate-900">{overview.totalActivities} Agenda</div>
            <div className="text-[10px] text-blue-600 flex items-center gap-0.5 mt-1 font-medium">
              Buka Modul <ChevronRight className="h-2.5 w-2.5" />
            </div>
          </Link>

          <Link
            href="/dashboard/attendance"
            className="p-2.5 bg-white hover:bg-teal-50/60 rounded-xl border border-slate-200/80 shadow-2xs transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-semibold">Presensi</span>
              <Clock className="h-3.5 w-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-extrabold text-sm text-slate-900">{overview.overallAttendanceRate}% Hadir</div>
            <div className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-1 font-medium">
              Buka Modul <ChevronRight className="h-2.5 w-2.5" />
            </div>
          </Link>

          <Link
            href="/dashboard/evaluations"
            className="p-2.5 bg-white hover:bg-teal-50/60 rounded-xl border border-slate-200/80 shadow-2xs transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-semibold">Evaluasi</span>
              <Star className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-extrabold text-sm text-slate-900">{overview.averageFinalScore} Rata-rata</div>
            <div className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-1 font-medium">
              Buka Modul <ChevronRight className="h-2.5 w-2.5" />
            </div>
          </Link>

          <Link
            href="/dashboard/certificates"
            className="p-2.5 bg-white hover:bg-teal-50/60 rounded-xl border border-slate-200/80 shadow-2xs transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-semibold">Sertifikat</span>
              <Award className="h-3.5 w-3.5 text-violet-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-extrabold text-sm text-slate-900">{overview.totalCertificatesIssued} Terbit</div>
            <div className="text-[10px] text-violet-600 flex items-center gap-0.5 mt-1 font-medium">
              Buka Modul <ChevronRight className="h-2.5 w-2.5" />
            </div>
          </Link>

          <Link
            href="/dashboard/clarifications"
            className="p-2.5 bg-white hover:bg-teal-50/60 rounded-xl border border-slate-200/80 shadow-2xs transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-semibold">Sanggahan</span>
              <HelpCircle className="h-3.5 w-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-extrabold text-sm text-slate-900">{overview.totalClarifications} Permohonan</div>
            <div className="text-[10px] text-rose-600 flex items-center gap-0.5 mt-1 font-medium">
              Buka Modul <ChevronRight className="h-2.5 w-2.5" />
            </div>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          MASTER KPI METRIC CARDS
      ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Panitia Aktif */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Panitia Aktif</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">
            {overview.totalMembers} Anggota
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Tersebar di {overview.totalFields} divisi resmi
          </div>
        </Card>

        {/* Card 2: Tingkat Kehadiran Presensi */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Tingkat Kehadiran</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">
            {overview.overallAttendanceRate}%
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {overview.totalPresentActivities} presensi terverifikasi
          </div>
        </Card>

        {/* Card 3: Ketepatan Waktu */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Ketepatan Waktu</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">
            {overview.overallOnTimeRate}%
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500">
            {overview.totalOnTimeActivities} hadir tepat waktu (on-time)
          </div>
        </Card>

        {/* Card 4: Kelayakan Sertifikat */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Kelayakan Sertifikat</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">
            {overview.overallEligibilityPercentage}%
          </div>
          <div className="text-[10px] sm:text-[11px] text-amber-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {overview.totalEligible} dari {overview.totalMembers} panitia memenuhi syarat (≥ {overview.certificateThreshold})
          </div>
        </Card>
      </div>

      {/* =========================================================================
          TAB NAVIGATION SWITCHER (Screen only)
      ========================================================================= */}
      <div className="print:hidden flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 font-bold rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'text-teal-700 bg-white border-t-2 border-teal-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Ringkasan Eksekutif & Analitik</span>
        </button>

        <button
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-2 px-3.5 py-2 font-bold rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === 'fields'
              ? 'text-teal-700 bg-white border-t-2 border-teal-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Kinerja Divisi ({fieldSummaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-3.5 py-2 font-bold rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === 'members'
              ? 'text-teal-700 bg-white border-t-2 border-teal-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Nilai Individu Panitia ({memberRecap.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activities')}
          className={`flex items-center gap-2 px-3.5 py-2 font-bold rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === 'activities'
              ? 'text-teal-700 bg-white border-t-2 border-teal-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <ActivityIcon className="h-4 w-4" />
          <span>Presensi Kegiatan ({activitySummaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('certificates')}
          className={`flex items-center gap-2 px-3.5 py-2 font-bold rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === 'certificates'
              ? 'text-teal-700 bg-white border-t-2 border-teal-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Registrasi Sertifikat ({overview.totalCertificatesIssued})</span>
        </button>

        <button
          onClick={() => setActiveTab('clarifications')}
          className={`flex items-center gap-2 px-3.5 py-2 font-bold rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === 'clarifications'
              ? 'text-teal-700 bg-white border-t-2 border-teal-600 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Sanggahan ({clarifications.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: RINGKASAN EKSEKUTIF & ANALITIK
      ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Visual Interactive Analytics & Graphic Charts */}
          <ReportCharts
            overview={overview}
            fieldSummaries={fieldSummaries}
            activitySummaries={activitySummaries}
            gradeDistribution={gradeDistribution}
            onSelectDivision={(fieldId) => {
              setFilterDivision(fieldId);
              setActiveTab('members');
            }}
            onSelectActivity={() => {
              setActiveTab('activities');
            }}
          />

          {/* Analytics Visual Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: Distribusi Grade Nilai Akhir */}
            <Card className="p-4 sm:p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                <span>Distribusi Capaian Nilai</span>
                <Award className="h-4 w-4 text-teal-600" />
              </h3>

              <div className="space-y-3">
                {gradeDistribution.totalEvaluated === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-slate-500">
                      Belum ada penilaian panitia yang selesai dihitung.
                    </p>
                    <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      {gradeDistribution.pendingCount} panitia menunggu agenda kegiatan
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-emerald-700">Sangat Baik (≥ 90.0)</span>
                        <span className="text-slate-900 font-bold">{gradeDistribution.gradeA} Panitia ({gradeDistribution.pctA}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${gradeDistribution.pctA}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-teal-700">Baik / Layak (75.0 - 89.9)</span>
                        <span className="text-slate-900 font-bold">{gradeDistribution.gradeB} Panitia ({gradeDistribution.pctB}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${gradeDistribution.pctB}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-rose-700">Perlu Perbaikan (&lt; 75.0)</span>
                        <span className="text-slate-900 font-bold">{gradeDistribution.gradeC} Panitia ({gradeDistribution.pctC}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${gradeDistribution.pctC}%` }} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Standar Kelulusan Sertifikat:</span>
                <span className="font-bold text-slate-900 font-mono">≥ {overview.certificateThreshold}.00 Poin</span>
              </div>
            </Card>

            {/* Box 2: Komposisi Bobot Penilaian */}
            <Card className="p-4 sm:p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                <span>Struktur Formula Penilaian</span>
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Skor Sistem Otomatis</div>
                    <div className="text-[10px] text-slate-500">Check-In (20) + Tepat Waktu (10) + Check-Out (10)</div>
                  </div>
                  <span className="font-extrabold text-teal-700 font-mono text-sm">40 Poin</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Evaluasi Koordinator</div>
                    <div className="text-[10px] text-slate-500">5 Rubrik: Komunikasi, Tanggung Jawab, Tim, Inisiatif, Sikap</div>
                  </div>
                  <span className="font-extrabold text-blue-700 font-mono text-sm">60 Poin</span>
                </div>

                <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-teal-900">Rata-rata Nilai Akhir</div>
                    <div className="text-[10px] text-teal-700">Skor Total Gabungan Seluruh Panitia</div>
                  </div>
                  <span className="font-extrabold text-teal-800 font-mono text-base">{overview.averageFinalScore} / 100</span>
                </div>
              </div>
            </Card>

            {/* Box 3: Efektivitas Presensi & Waktu Hadir */}
            <Card className="p-4 sm:p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                <span>Kepatuhan Jadwal & Presensi</span>
                <Clock className="h-4 w-4 text-emerald-600" />
              </h3>

              <div className="space-y-3 text-xs">
                {overview.totalAssignedActivities === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-slate-500">
                      Belum ada agenda kegiatan yang ditugaskan kepada panitia.
                    </p>
                    <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      0 Sesi Presensi Aktif
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Presensi Tepat Waktu (On-Time):</span>
                      <span className="font-bold text-emerald-700">{overview.totalOnTimeActivities} ({overview.overallOnTimeRate}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Presensi Terlambat (Late):</span>
                      <span className="font-bold text-amber-700">
                        {Math.max(0, overview.totalPresentActivities - overview.totalOnTimeActivities)} (
                        {overview.totalPresentActivities > 0 
                          ? (((overview.totalPresentActivities - overview.totalOnTimeActivities) / overview.totalPresentActivities) * 100).toFixed(1) 
                          : '0.0'}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Izin / Sakit / Alpa:</span>
                      <span className="font-bold text-rose-700">
                        {Math.max(0, overview.totalAssignedActivities - overview.totalPresentActivities)} (
                        {overview.totalAssignedActivities > 0
                          ? (((overview.totalAssignedActivities - overview.totalPresentActivities) / overview.totalAssignedActivities) * 100).toFixed(1)
                          : '0.0'}%)
                      </span>
                    </div>
                  </>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Validasi Check-in:</span>
                  <span className="font-bold text-teal-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                    QR Scan & Manual Valid
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Overview Table: Top Divisions */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="h-4 w-4 text-teal-600" />
                  Rekapitulasi Kinerja per Divisi / Bidang Kepanitiaan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Agregasi terpadu nilai sistem, evaluasi koordinator, dan kelulusan per divisi
                </p>
              </div>

              <button
                onClick={() => setActiveTab('fields')}
                className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 self-start sm:self-auto"
              >
                Lihat Selengkapnya <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Divisi / Bidang</th>
                    <th className="px-4 py-3">Koordinator Penanggung Jawab</th>
                    <th className="px-4 py-3 text-center">Jumlah Panitia</th>
                    <th className="px-4 py-3 text-center">Rata-rata Skor Sistem</th>
                    <th className="px-4 py-3 text-center">Rata-rata Nilai Akhir</th>
                    <th className="px-4 py-3 text-center">Tingkat Kelayakan Sertifikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fieldSummaries.slice(0, 6).map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{f.field_name}</div>
                        <div className="text-[10px] text-teal-700 font-mono font-medium">{f.field_code}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-800 font-medium">
                        {f.coordinator_name}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                        {f.total_members} Orang
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-teal-700">
                        {f.average_system_score} / 40
                      </td>
                      <td className="px-4 py-3.5 text-center font-extrabold text-slate-900">
                        <span className="px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
                          {f.average_final_score} / 100
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-emerald-700">{f.eligibility_percentage}%</span>
                        <div className="text-[10px] text-slate-500">
                          ({f.eligible_count} dari {f.total_members} layak)
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 2: KINERJA DIVISI LENGKAP (FIELDS PERFORMANCE)
      ========================================================================= */}
      {activeTab === 'fields' && (
        <div className="space-y-6">
          <DivisionPerformanceBarChart
            fieldSummaries={fieldSummaries}
            threshold={overview.certificateThreshold || 75}
            onSelectDivision={(fieldId) => {
              setFilterDivision(fieldId);
              setActiveTab('members');
            }}
          />

          <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="h-4.5 w-4.5 text-teal-600" />
                Rekapitulasi Kinerja Komprehensif Seluruh Divisi Kepanitiaan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total {fieldSummaries.length} divisi resmi Pemilihan Duta GenRe Kabupaten Buleleng 2026/2027
              </p>
            </div>

            <button
              onClick={handleExportFieldsCSV}
              className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 font-semibold bg-teal-50 hover:bg-teal-100/70 border border-teal-200 px-3 py-1.5 rounded-xl transition-all self-start sm:self-auto"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh CSV Divisi
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Divisi / Bidang</th>
                  <th className="px-4 py-3">Koordinator Penanggung Jawab</th>
                  <th className="px-4 py-3 text-center">Jumlah Panitia</th>
                  <th className="px-4 py-3 text-center">Rata-rata Skor Sistem</th>
                  <th className="px-4 py-3 text-center">Rata-rata Nilai Koordinator</th>
                  <th className="px-4 py-3 text-center">Rata-rata Nilai Akhir</th>
                  <th className="px-4 py-3 text-center">Kelayakan Sertifikat</th>
                  <th className="px-4 py-3 text-center print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      Memuat ringkasan divisi...
                    </td>
                  </tr>
                ) : (
                  fieldSummaries.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{f.field_name}</div>
                        <div className="text-[10px] text-teal-700 font-mono font-medium">{f.field_code}</div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-800 font-medium">
                        <div>{f.coordinator_name}</div>
                        {f.coordinator_email && (
                          <div className="text-[10px] text-slate-400 font-mono">{f.coordinator_email}</div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                        {f.total_members} Orang
                      </td>

                      <td className="px-4 py-3.5 text-center font-semibold text-teal-700">
                        {f.average_system_score} / 40
                      </td>

                      <td className="px-4 py-3.5 text-center font-semibold text-blue-700">
                        {f.average_coordinator_score} / 60
                      </td>

                      <td className="px-4 py-3.5 text-center font-extrabold text-slate-900">
                        <span className="px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-mono">
                          {f.average_final_score} / 100
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-emerald-700">{f.eligibility_percentage}%</span>
                          <span className="text-[10px] text-slate-500">({f.eligible_count} dari {f.total_members} layak)</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center print:hidden">
                        <button
                          onClick={() => {
                            setFilterDivision(f.field_id);
                            setActiveTab('members');
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 transition-colors"
                        >
                          Lihat Anggota
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      )}

      {/* =========================================================================
          TAB 3: REKAPITULASI NILAI INDIVIDU PANITIA (MEMBERS RECAP)
      ========================================================================= */}
      {activeTab === 'members' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-teal-600" />
                Laporan Nilai Individu & Kelayakan Sertifikat Seluruh Panitia
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan {filteredMembers.length} dari total {memberRecap.length} anggota panitia resmi
              </p>
            </div>

            <button
              onClick={handleExportMembersCSV}
              className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 font-semibold bg-teal-50 hover:bg-teal-100/70 border border-teal-200 px-3 py-1.5 rounded-xl transition-all self-start md:self-auto"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh CSV Nilai Panitia
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 bg-slate-50/60 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 print:hidden">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                placeholder="Cari nama atau kode panitia..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Division Filter */}
            <div>
              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Semua Divisi / Bidang ({fieldSummaries.length})</option>
                {fieldSummaries.map((f) => (
                  <option key={f.field_id} value={f.field_id}>
                    {f.field_name} ({f.total_members})
                  </option>
                ))}
              </select>
            </div>

            {/* Eligibility Filter */}
            <div>
              <select
                value={filterEligibility}
                onChange={(e) => setFilterEligibility(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Semua Kelayakan Sertifikat</option>
                <option value="eligible">Layak Sertifikat (≥ 75 Poin)</option>
                <option value="ineligible">Belum Layak (&lt; 75 Poin)</option>
                <option value="pending">Menunggu / Sanggahan Terbuka</option>
              </select>
            </div>

            {/* Sorting */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="score_desc">Urutkan: Nilai Tertinggi</option>
                <option value="score_asc">Urutkan: Nilai Terendah</option>
                <option value="name_asc">Urutkan: Nama (A - Z)</option>
                <option value="code_asc">Urutkan: Kode Panitia</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-3 text-center">No</th>
                  <th className="px-4 py-3">Panitia</th>
                  <th className="px-4 py-3">Divisi & Jabatan</th>
                  <th className="px-3 py-3 text-center" title="Poin Presensi Check-In Maks 20">Check-In</th>
                  <th className="px-3 py-3 text-center" title="Poin Ketepatan Waktu Maks 10">Ketepatan</th>
                  <th className="px-3 py-3 text-center" title="Poin Presensi Check-Out Kepulangan Maks 10">Check-Out</th>
                  <th className="px-3.5 py-3 text-center font-bold text-teal-800">Sistem (40)</th>
                  <th className="px-3.5 py-3 text-center font-bold text-blue-800">Koord (60)</th>
                  <th className="px-4 py-3 text-center font-extrabold text-slate-900">Nilai Akhir</th>
                  <th className="px-4 py-3 text-center">Kelayakan</th>
                  <th className="px-4 py-3">No. Sertifikat</th>
                  <th className="px-3 py-3 text-center print:hidden">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-slate-500">
                      Memuat daftar rekapitulasi panitia...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-slate-500">
                      Tidak ada panitia yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m, idx) => (
                    <tr key={m.member_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{m.full_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{m.member_code}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{m.field_name}</div>
                        <div className="text-[10px] text-teal-700 font-semibold">{m.organization_position}</div>
                      </td>

                      <td className="px-3 py-3 text-center text-slate-700 font-mono font-medium">
                        {m.attendance_points}
                      </td>

                      <td className="px-3 py-3 text-center text-slate-700 font-mono font-medium">
                        {m.punctuality_points}
                      </td>

                      <td className="px-3 py-3 text-center text-slate-700 font-mono font-medium">
                        {m.task_completion_points}
                      </td>

                      <td className="px-3.5 py-3 text-center font-bold text-teal-700 font-mono bg-teal-50/40">
                        {m.system_score}
                      </td>

                      <td className="px-3.5 py-3 text-center font-bold text-blue-700 font-mono bg-blue-50/40">
                        {m.coordinator_score}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="font-extrabold text-sm text-slate-900 font-mono px-2 py-0.5 rounded-lg bg-slate-100">
                          {m.final_score}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Badge
                          status={m.certificate_eligibility_status}
                          label={
                            m.certificate_eligibility_status === 'eligible'
                              ? 'Layak'
                              : m.certificate_eligibility_status === 'pending'
                              ? 'Pending'
                              : 'Belum Layak'
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        {m.certificate_number ? (
                          <div className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block border border-emerald-200">
                            {m.certificate_number}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum terbit</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center print:hidden">
                        <Link
                          href={`/dashboard/evaluations?memberId=${m.member_id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors inline-block"
                          title="Lihat penilaian di Modul Evaluasi"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =========================================================================
          TAB 4: REKAPITULASI PRESENSI KEGIATAN (ACTIVITIES & ATTENDANCE)
      ========================================================================= */}
      {activeTab === 'activities' && (
        <div className="space-y-6">
          <ActivityAttendanceColumnChart
            activitySummaries={activitySummaries}
          />

          <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ActivityIcon className="h-4.5 w-4.5 text-emerald-600" />
                Rekapitulasi Presensi Kehadiran per Agenda Kegiatan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total {activitySummaries.length} agenda kegiatan resmi Pemilihan Duta GenRe Kabupaten Buleleng 2026
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/activities"
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-all print:hidden"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Kelola Kegiatan
              </Link>
              <button
                onClick={handleExportActivitiesCSV}
                className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh CSV Presensi
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Agenda Kegiatan</th>
                  <th className="px-4 py-3">Lokasi Pelaksanaan</th>
                  <th className="px-4 py-3 text-center">Status Agenda</th>
                  <th className="px-4 py-3 text-center">Ditugaskan</th>
                  <th className="px-4 py-3 text-center">Tepat Waktu</th>
                  <th className="px-4 py-3 text-center">Terlambat</th>
                  <th className="px-4 py-3 text-center">Izin / Alpa</th>
                  <th className="px-4 py-3 text-center">Persentase Hadir</th>
                  <th className="px-3 py-3 text-center print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activitySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-500">
                      Belum ada data agenda kegiatan tercatat.
                    </td>
                  </tr>
                ) : (
                  activitySummaries.map((act, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{act.activity_name}</div>
                        <div className="text-[10px] text-teal-700 font-mono font-medium">{act.activity_code}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{act.start_at ? formatDateTimeWITA(act.start_at) : '-'}</div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-700">
                        {act.activity_location}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <Badge status={act.activity_status} />
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                        {act.total_assigned} Panitia
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-emerald-700 bg-emerald-50/30">
                        {act.total_on_time}
                      </td>

                      <td className="px-4 py-3.5 text-center font-medium text-amber-700 bg-amber-50/30">
                        {act.total_late}
                      </td>

                      <td className="px-4 py-3.5 text-center font-medium text-rose-700">
                        {act.total_absent_or_excused}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {act.attendance_rate}%
                        </span>
                      </td>

                      <td className="px-3 py-3.5 text-center print:hidden">
                        <Link
                          href={`/dashboard/activities/${act.id}`}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 transition-colors inline-block"
                        >
                          Detail Sesi
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      )}

      {/* =========================================================================
          TAB 5: REGISTRASI SERTIFIKAT RESMI (CERTIFICATES)
      ========================================================================= */}
      {activeTab === 'certificates' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-amber-500" />
                Buku Registrasi Penerbitan Sertifikat Kelulusan Kepanitiaan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total {certificates.length} nomor sertifikat resmi terdaftar dalam basis data
              </p>
            </div>

            <Link
              href="/dashboard/certificates"
              className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100/70 border border-amber-200 px-3 py-1.5 rounded-xl transition-all self-start sm:self-auto print:hidden"
            >
              <Award className="h-3.5 w-3.5 text-amber-600" />
              Kelola & Cetak Sertifikat di Modul
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nomor Sertifikat</th>
                  <th className="px-4 py-3">Nama Penerima Panitia</th>
                  <th className="px-4 py-3">Divisi & Jabatan</th>
                  <th className="px-4 py-3 text-center">Nilai Akhir</th>
                  <th className="px-4 py-3 text-center">Status Sertifikat</th>
                  <th className="px-4 py-3">Tanggal Penerbitan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certificates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Belum ada nomor sertifikat yang diterbitkan.
                    </td>
                  </tr>
                ) : (
                  certificates.map((c, i) => {
                    const recipient = memberRecap.find((m) => m.certificate_number === c.certificate_number) || null;
                    return (
                      <tr key={c.id || i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {c.certificate_number}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{recipient?.full_name || 'Panitia Duta GenRe'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{recipient?.member_code}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">{recipient?.field_name || '-'}</div>
                          <div className="text-[10px] text-teal-700">{recipient?.organization_position || '-'}</div>
                        </td>
                        <td className="px-4 py-3.5 text-center font-extrabold text-slate-900 font-mono">
                          {recipient?.final_score || '-'} / 100
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Badge status={c.certificate_status} label="Terbit Resmi" />
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                          {c.issued_at ? formatDateTimeWITA(c.issued_at) : '12 April 2026'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =========================================================================
          TAB 6: LAPORAN SANGGAHAN & KLARIFIKASI (CLARIFICATIONS)
      ========================================================================= */}
      {activeTab === 'clarifications' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="h-4.5 w-4.5 text-rose-500" />
                Laporan Penanganan Sanggahan & Klarifikasi Presensi
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit transparansi proses sanggahan panitia sebelum penetapan nilai akhir
              </p>
            </div>

            <Link
              href="/dashboard/clarifications"
              className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold bg-rose-50 hover:bg-rose-100/70 border border-rose-200 px-3 py-1.5 rounded-xl transition-all self-start sm:self-auto print:hidden"
            >
              <HelpCircle className="h-3.5 w-3.5 text-rose-500" />
              Kelola Sanggahan di Modul
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Pemohon Sanggahan</th>
                  <th className="px-4 py-3">Jenis Permohonan</th>
                  <th className="px-4 py-3">Terkait Agenda</th>
                  <th className="px-4 py-3">Uraian Alasan</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Catatan Resolusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clarifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Tidak ada data permohonan sanggahan aktif.
                    </td>
                  </tr>
                ) : (
                  clarifications.map((cl, i) => (
                    <tr key={cl.id || i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{cl.member?.full_name || 'Panitia'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{cl.member?.member_code}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="capitalize font-semibold text-slate-800">
                          {cl.request_type?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-700">
                        {cl.activity?.activity_name || 'Agenda Kegiatan'}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600 max-w-xs">
                        {cl.request_description || '-'}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <Badge status={cl.request_status} />
                      </td>

                      <td className="px-4 py-3.5 text-slate-700 max-w-xs">
                        {cl.resolution_note || <span className="text-slate-400 italic">Menunggu verifikasi admin</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =========================================================================
          PRINT SIGNATURE FOOTER (Visible only on print preview)
      ========================================================================= */}
      <div className="hidden print:block mt-12 pt-6 border-t border-slate-300">
        <div className="grid grid-cols-2 text-center text-xs text-slate-800">
          <div>
            <p className="mb-1">Mengetahui,</p>
            <p className="font-bold">Ketua Panitia Pelaksana</p>
            <div className="h-16" />
            <p className="font-bold underline">Sukkun Siregar</p>
            <p className="text-[10px] text-slate-500">KPT-2026/001</p>
          </div>

          <div>
            <p className="mb-1" suppressHydrationWarning>Singaraja, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold">Penanggung Jawab Kepanitiaan</p>
            <div className="h-16" />
            <p className="font-bold underline">Ida Bagus Angga Prabaswara, S.Pd</p>
            <p className="text-[10px] text-slate-500">PNJ-2026/001</p>
          </div>
        </div>
      </div>
    </div>
  );
}
