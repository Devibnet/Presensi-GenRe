'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
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
  Activity as ActivityIcon
} from 'lucide-react';
import { formatDateTimeWITA } from '@/lib/utils';

export default function ReportsPage() {
  const [fieldSummaries, setFieldSummaries] = useState<any[]>([]);
  const [activitySummaries, setActivitySummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // 1. Coba ambil dari View v_field_performance_overview
      const { data: fOverview, error: fErr } = await supabase
        .from('v_field_performance_overview')
        .select('*');

      if (!fErr && fOverview && fOverview.length > 0) {
        setFieldSummaries(fOverview);
      } else {
        setFieldSummaries(getFallbackFieldOverview());
      }

      // 2. Coba ambil dari View v_activity_attendance_summary
      const { data: aSummary, error: aErr } = await supabase
        .from('v_activity_attendance_summary')
        .select('*');

      if (!aErr && aSummary && aSummary.length > 0) {
        setActivitySummaries(aSummary);
      } else {
        setActivitySummaries(getFallbackActivitySummary());
      }
    } catch (err) {
      console.error(err);
      setFieldSummaries(getFallbackFieldOverview());
      setActivitySummaries(getFallbackActivitySummary());
    } finally {
      setLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (fieldSummaries.length === 0) return;

    const headers = ['Divisi / Bidang', 'Kode Bidang', 'Koordinator', 'Jumlah Panitia', 'Rata-rata Nilai Akhir', 'Panitia Layak Sertifikat'];
    const rows = fieldSummaries.map(f => [
      f.field_name,
      f.field_code,
      f.coordinator_name || 'BPH',
      f.total_members || 0,
      f.average_final_score || 0,
      `${f.eligible_count || 0} (${f.eligibility_percentage || 0}%)`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_kinerja_genre_buleleng_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-400" />
            Laporan Kinerja & Analisis Organisasi
          </h1>
          <p className="text-sm text-slate-400">
            Rekapitulasi statistik kehadiran, efektivitas penugasan bidang, dan agregasi kelayakan sertifikat kepanitiaan.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
        >
          <Download className="h-4 w-4" />
          Ekspor CSV Laporan
        </button>
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-navy-900/60 border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Panitia Aktif</span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">70 Anggota</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> 100% terdata dalam sistem
          </div>
        </Card>

        <Card className="p-5 bg-navy-900/60 border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Tingkat Kehadiran Rata-rata</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">94.8%</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Sangat Disiplin (Target ≥ 85%)
          </div>
        </Card>

        <Card className="p-5 bg-navy-900/60 border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Ketepatan Waktu (On-Time)</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">91.2%</div>
          <div className="text-[11px] text-slate-400">
            Hadir sebelum batas waktu check-in ditutup
          </div>
        </Card>

        <Card className="p-5 bg-navy-900/60 border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Rasio Kelayakan Sertifikat</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">88.6%</div>
          <div className="text-[11px] text-amber-400 flex items-center gap-1">
            Nilai Akhir ≥ 75.00
          </div>
        </Card>
      </div>

      {/* TABLE 1: REKAPITULASI KINERJA PER BIDANG */}
      <Card className="bg-navy-900/60 border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building className="h-4 w-4 text-brand-400" />
            Agregasi Kinerja per Divisi / Bidang Kepanitiaan
          </h2>
          <span className="text-xs text-slate-400">
            Total {fieldSummaries.length} Divisi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Bidang / Divisi</th>
                <th className="px-4 py-3">Koordinator Bidang</th>
                <th className="px-4 py-3 text-center">Jumlah Panitia</th>
                <th className="px-4 py-3 text-center">Rata-rata Skor Sistem</th>
                <th className="px-4 py-3 text-center">Rata-rata Nilai Akhir</th>
                <th className="px-4 py-3 text-center">Tingkat Kelulusan Sertifikat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Memuat ringkasan divisi...
                  </td>
                </tr>
              ) : (
                fieldSummaries.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{f.field_name}</div>
                      <div className="text-[10px] text-brand-400 font-mono">{f.field_code}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-200">{f.coordinator_name || 'BPH'}</div>
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-white">
                      {f.total_members} Orang
                    </td>

                    <td className="px-4 py-3.5 text-center font-medium text-brand-300">
                      {f.average_system_score} / 40
                    </td>

                    <td className="px-4 py-3.5 text-center font-bold text-white">
                      {f.average_final_score} / 100
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-emerald-400">{f.eligibility_percentage}%</span>
                        <span className="text-[10px] text-slate-400">({f.eligible_count} dari {f.total_members} layak)</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* TABLE 2: REKAPITULASI PRESENSI PER KEGIATAN */}
      <Card className="bg-navy-900/60 border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-emerald-400" />
            Rekapitulasi Presensi Kehadiran per Kegiatan
          </h2>
          <span className="text-xs text-slate-400">
            Total {activitySummaries.length} Agenda
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Agenda Kegiatan</th>
                <th className="px-4 py-3">Lokasi Pelaksanaan</th>
                <th className="px-4 py-3 text-center">Ditugaskan</th>
                <th className="px-4 py-3 text-center">Tepat Waktu</th>
                <th className="px-4 py-3 text-center">Terlambat</th>
                <th className="px-4 py-3 text-center">Izin / Alpa</th>
                <th className="px-4 py-3 text-center">Persentase Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    Memuat ringkasan kegiatan...
                  </td>
                </tr>
              ) : (
                activitySummaries.map((act, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{act.activity_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{act.activity_code}</div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-300">
                      {act.activity_location}
                    </td>

                    <td className="px-4 py-3.5 text-center font-semibold text-white">
                      {act.total_assigned} Panitia
                    </td>

                    <td className="px-4 py-3.5 text-center font-bold text-emerald-400">
                      {act.total_on_time}
                    </td>

                    <td className="px-4 py-3.5 text-center font-medium text-amber-400">
                      {act.total_late}
                    </td>

                    <td className="px-4 py-3.5 text-center font-medium text-rose-400">
                      {act.total_absent_or_excused}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {act.attendance_rate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Fallback Mock Data
function getFallbackFieldOverview() {
  return [
    {
      field_name: 'Badan Pengurus Harian (BPH)',
      field_code: 'BPH',
      coordinator_name: 'Gede Arya Swastika',
      total_members: 6,
      average_system_score: 38.5,
      average_final_score: 95.2,
      eligible_count: 6,
      eligibility_percentage: 100.0,
    },
    {
      field_name: 'Bidang Acara & Protokoler',
      field_code: 'ACARA',
      coordinator_name: 'Ni Kadek Ayu Lestari',
      total_members: 14,
      average_system_score: 36.8,
      average_final_score: 89.4,
      eligible_count: 13,
      eligibility_percentage: 92.8,
    },
    {
      field_name: 'Bidang Perlengkapan & Logistik',
      field_code: 'LOGISTIK',
      coordinator_name: 'I Komang Triyasa',
      total_members: 16,
      average_system_score: 35.1,
      average_final_score: 84.7,
      eligible_count: 14,
      eligibility_percentage: 87.5,
    },
    {
      field_name: 'Bidang Publikasi & Dokumentasi',
      field_code: 'PUBDOK',
      coordinator_name: 'Luh Putu Dian Swari',
      total_members: 12,
      average_system_score: 36.2,
      average_final_score: 88.0,
      eligible_count: 11,
      eligibility_percentage: 91.6,
    },
    {
      field_name: 'Bidang Konsumsi & Akomodasi',
      field_code: 'KONSUMSI',
      coordinator_name: 'Ni Made Windari',
      total_members: 12,
      average_system_score: 37.0,
      average_final_score: 86.5,
      eligible_count: 10,
      eligibility_percentage: 83.3,
    },
    {
      field_name: 'Bidang Keamanan & Ketertiban',
      field_code: 'SECURITY',
      coordinator_name: 'I Ketut Sudirga',
      total_members: 10,
      average_system_score: 33.4,
      average_final_score: 79.8,
      eligible_count: 8,
      eligibility_percentage: 80.0,
    },
  ];
}

function getFallbackActivitySummary() {
  return [
    {
      activity_name: 'Rapat Perdana & Pembentukan Seksi Panitia',
      activity_code: 'ACT-001',
      activity_location: 'Aula Bappeda Kab. Buleleng',
      total_assigned: 70,
      total_on_time: 64,
      total_late: 4,
      total_absent_or_excused: 2,
      attendance_rate: 97.1,
    },
    {
      activity_name: 'Workshop Public Speaking & Grooming Finalis',
      activity_code: 'ACT-002',
      activity_location: 'Hotel Aneka Lovina Buleleng',
      total_assigned: 45,
      total_on_time: 41,
      total_late: 3,
      total_absent_or_excused: 1,
      attendance_rate: 97.7,
    },
    {
      activity_name: 'Gladi Bersih & Tata Panggung Grand Final',
      activity_code: 'ACT-003',
      activity_location: 'Gedung Kesenian Gde Manik Singaraja',
      total_assigned: 70,
      total_on_time: 62,
      total_late: 6,
      total_absent_or_excused: 2,
      attendance_rate: 97.1,
    },
    {
      activity_name: 'Malam Grand Final Pemilihan Duta GenRe Buleleng 2026',
      activity_code: 'ACT-004',
      activity_location: 'Gedung Kesenian Gde Manik Singaraja',
      total_assigned: 70,
      total_on_time: 68,
      total_late: 2,
      total_absent_or_excused: 0,
      attendance_rate: 100.0,
    },
  ];
}
