'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Award,
  Users,
  Building,
  Activity as ActivityIcon,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  Filter
} from 'lucide-react';

export interface ReportOverviewData {
  totalMembers: number;
  totalFields: number;
  totalActivities: number;
  totalAssignedActivities: number;
  totalPresentActivities: number;
  totalOnTimeActivities: number;
  overallAttendanceRate: number;
  overallOnTimeRate: number;
  totalEligible: number;
  totalIneligible: number;
  totalPending: number;
  overallEligibilityPercentage: number;
  totalCertificatesIssued: number;
  totalClarifications?: number;
  averageFinalScore: number;
  certificateThreshold: number;
}

export interface FieldSummaryData {
  field_id: string;
  field_name: string;
  field_code: string;
  coordinator_name: string;
  coordinator_email?: string;
  total_members: number;
  average_system_score: number;
  average_coordinator_score: number;
  average_final_score: number;
  eligible_count: number;
  eligibility_percentage: number;
}

export interface ActivitySummaryData {
  id: string;
  activity_code: string;
  activity_name: string;
  activity_location?: string;
  start_at?: string;
  total_assigned: number;
  total_on_time: number;
  total_late: number;
  total_checked_in: number;
  total_absent_or_excused: number;
  attendance_rate: number;
}

export interface GradeDistributionData {
  total: number;
  totalEvaluated: number;
  gradeA: number;
  pctA: number;
  gradeB: number;
  pctB: number;
  gradeC: number;
  pctC: number;
  pendingCount: number;
  pctPending: number;
}

interface ReportChartsProps {
  overview: ReportOverviewData;
  fieldSummaries: FieldSummaryData[];
  activitySummaries: ActivitySummaryData[];
  gradeDistribution: GradeDistributionData;
  onSelectDivision?: (fieldId: string) => void;
  onSelectActivity?: (activityId: string) => void;
}

// =========================================================================
// 1. DONUT CHART KOMPOSISI PRESENSI (SVG)
// =========================================================================
export function AttendanceDonutChart({
  overview,
}: {
  overview: ReportOverviewData;
}) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const totalAssigned = overview.totalAssignedActivities || 0;
  const onTime = overview.totalOnTimeActivities || 0;
  const late = Math.max(0, (overview.totalPresentActivities || 0) - onTime);
  const absent = Math.max(0, totalAssigned - (overview.totalPresentActivities || 0));

  const pctOnTime = totalAssigned > 0 ? Number(((onTime / totalAssigned) * 100).toFixed(1)) : 0;
  const pctLate = totalAssigned > 0 ? Number(((late / totalAssigned) * 100).toFixed(1)) : 0;
  const pctAbsent = totalAssigned > 0 ? Number(((absent / totalAssigned) * 100).toFixed(1)) : 0;

  // SVG parameters
  const size = 180;
  const strokeWidth = 20;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  // Calculate slice lengths
  const lenOnTime = totalAssigned > 0 ? (onTime / totalAssigned) * circumference : 0;
  const lenLate = totalAssigned > 0 ? (late / totalAssigned) * circumference : 0;
  const lenAbsent = totalAssigned > 0 ? (absent / totalAssigned) * circumference : 0;

  const offsetOnTime = 0;
  const offsetLate = -lenOnTime;
  const offsetAbsent = -(lenOnTime + lenLate);

  // Dynamic Center Content based on hover
  let centerTitle = `${overview.overallAttendanceRate}%`;
  let centerSubtitle = 'Total Kehadiran';
  let centerColor = 'text-teal-700';

  if (hoveredSlice === 'ontime') {
    centerTitle = `${onTime}`;
    centerSubtitle = `Tepat Waktu (${pctOnTime}%)`;
    centerColor = 'text-emerald-700';
  } else if (hoveredSlice === 'late') {
    centerTitle = `${late}`;
    centerSubtitle = `Terlambat (${pctLate}%)`;
    centerColor = 'text-amber-700';
  } else if (hoveredSlice === 'absent') {
    centerTitle = `${absent}`;
    centerSubtitle = `Izin / Alpa (${pctAbsent}%)`;
    centerColor = 'text-rose-700';
  }

  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <PieChart className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Komposisi Presensi Kegiatan
              </h3>
              <p className="text-[11px] text-slate-500">
                Rincian kepatuhan waktu hadir seluruh sesi
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {totalAssigned} Sesi
          </span>
        </div>

        {/* Circular SVG Donut Chart */}
        <div className="relative flex items-center justify-center my-3">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90 drop-shadow-xs"
          >
            {/* Background Circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />

            {totalAssigned > 0 ? (
              <>
                {/* On-Time Slice (Emerald) */}
                {lenOnTime > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth={hoveredSlice === 'ontime' ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${lenOnTime} ${circumference}`}
                    strokeDashoffset={offsetOnTime}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    onMouseEnter={() => setHoveredSlice('ontime')}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                )}

                {/* Late Slice (Amber) */}
                {lenLate > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#f59e0b"
                    strokeWidth={hoveredSlice === 'late' ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${lenLate} ${circumference}`}
                    strokeDashoffset={offsetLate}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    onMouseEnter={() => setHoveredSlice('late')}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                )}

                {/* Absent Slice (Rose) */}
                {lenAbsent > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#f43f5e"
                    strokeWidth={hoveredSlice === 'absent' ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${lenAbsent} ${circumference}`}
                    strokeDashoffset={offsetAbsent}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    onMouseEnter={() => setHoveredSlice('absent')}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                )}
              </>
            ) : (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
              />
            )}
          </svg>

          {/* Center Info Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            <span className={`text-2xl font-extrabold tracking-tight transition-colors duration-200 ${centerColor}`}>
              {centerTitle}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5 max-w-[100px] truncate">
              {centerSubtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
        <div
          onMouseEnter={() => setHoveredSlice('ontime')}
          onMouseLeave={() => setHoveredSlice(null)}
          className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
            hoveredSlice === 'ontime' ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <span>Tepat Waktu (On-Time)</span>
          </div>
          <span className="font-mono font-bold text-emerald-700">
            {onTime} ({pctOnTime}%)
          </span>
        </div>

        <div
          onMouseEnter={() => setHoveredSlice('late')}
          onMouseLeave={() => setHoveredSlice(null)}
          className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
            hoveredSlice === 'late' ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <span>Terlambat (Late)</span>
          </div>
          <span className="font-mono font-bold text-amber-700">
            {late} ({pctLate}%)
          </span>
        </div>

        <div
          onMouseEnter={() => setHoveredSlice('absent')}
          onMouseLeave={() => setHoveredSlice(null)}
          className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
            hoveredSlice === 'absent' ? 'bg-rose-50 text-rose-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
            <span>Izin / Sakit / Alpa</span>
          </div>
          <span className="font-mono font-bold text-rose-700">
            {absent} ({pctAbsent}%)
          </span>
        </div>
      </div>
    </Card>
  );
}

// =========================================================================
// 2. DONUT CHART DISTRIBUSI KELAYAKAN SERTIFIKAT (SVG)
// =========================================================================
export function EligibilityDonutChart({
  overview,
}: {
  overview: ReportOverviewData;
}) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const totalMembers = overview.totalMembers || 0;
  const eligible = overview.totalEligible || 0;
  const pending = overview.totalPending || 0;
  const ineligible = overview.totalIneligible || 0;

  const pctEligible = totalMembers > 0 ? Number(((eligible / totalMembers) * 100).toFixed(1)) : 0;
  const pctPending = totalMembers > 0 ? Number(((pending / totalMembers) * 100).toFixed(1)) : 0;
  const pctIneligible = totalMembers > 0 ? Number(((ineligible / totalMembers) * 100).toFixed(1)) : 0;

  // SVG parameters
  const size = 180;
  const strokeWidth = 20;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  // Calculate slice lengths
  const lenEligible = totalMembers > 0 ? (eligible / totalMembers) * circumference : 0;
  const lenPending = totalMembers > 0 ? (pending / totalMembers) * circumference : 0;
  const lenIneligible = totalMembers > 0 ? (ineligible / totalMembers) * circumference : 0;

  const offsetEligible = 0;
  const offsetPending = -lenEligible;
  const offsetIneligible = -(lenEligible + lenPending);

  let centerTitle = `${overview.overallEligibilityPercentage}%`;
  let centerSubtitle = 'Tingkat Kelulusan';
  let centerColor = 'text-teal-700';

  if (hoveredSlice === 'eligible') {
    centerTitle = `${eligible}`;
    centerSubtitle = `Layak (≥ ${overview.certificateThreshold})`;
    centerColor = 'text-teal-700';
  } else if (hoveredSlice === 'pending') {
    centerTitle = `${pending}`;
    centerSubtitle = `Pending / Sanggahan`;
    centerColor = 'text-sky-700';
  } else if (hoveredSlice === 'ineligible') {
    centerTitle = `${ineligible}`;
    centerSubtitle = `Belum Layak (< ${overview.certificateThreshold})`;
    centerColor = 'text-rose-700';
  }

  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Kelayakan Sertifikat Panitia
              </h3>
              <p className="text-[11px] text-slate-500">
                Berdasarkan ambang batas nilai akhir ≥ {overview.certificateThreshold}.00
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {totalMembers} Panitia
          </span>
        </div>

        {/* Circular SVG Donut Chart */}
        <div className="relative flex items-center justify-center my-3">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90 drop-shadow-xs"
          >
            {/* Background Circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />

            {totalMembers > 0 ? (
              <>
                {/* Eligible Slice (Teal) */}
                {lenEligible > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#0d9488"
                    strokeWidth={hoveredSlice === 'eligible' ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${lenEligible} ${circumference}`}
                    strokeDashoffset={offsetEligible}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    onMouseEnter={() => setHoveredSlice('eligible')}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                )}

                {/* Pending Slice (Sky) */}
                {lenPending > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#0284c7"
                    strokeWidth={hoveredSlice === 'pending' ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${lenPending} ${circumference}`}
                    strokeDashoffset={offsetPending}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    onMouseEnter={() => setHoveredSlice('pending')}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                )}

                {/* Ineligible Slice (Rose) */}
                {lenIneligible > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="#e11d48"
                    strokeWidth={hoveredSlice === 'ineligible' ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${lenIneligible} ${circumference}`}
                    strokeDashoffset={offsetIneligible}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300 hover:opacity-90"
                    onMouseEnter={() => setHoveredSlice('ineligible')}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                )}
              </>
            ) : (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
              />
            )}
          </svg>

          {/* Center Info Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            <span className={`text-2xl font-extrabold tracking-tight transition-colors duration-200 ${centerColor}`}>
              {centerTitle}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5 max-w-[100px] truncate">
              {centerSubtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
        <div
          onMouseEnter={() => setHoveredSlice('eligible')}
          onMouseLeave={() => setHoveredSlice(null)}
          className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
            hoveredSlice === 'eligible' ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-600 shrink-0" />
            <span>Layak Sertifikat (≥ {overview.certificateThreshold})</span>
          </div>
          <span className="font-mono font-bold text-teal-700">
            {eligible} ({pctEligible}%)
          </span>
        </div>

        <div
          onMouseEnter={() => setHoveredSlice('pending')}
          onMouseLeave={() => setHoveredSlice(null)}
          className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
            hoveredSlice === 'pending' ? 'bg-sky-50 text-sky-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
            <span>Menunggu Evaluasi / Sanggahan</span>
          </div>
          <span className="font-mono font-bold text-sky-700">
            {pending} ({pctPending}%)
          </span>
        </div>

        <div
          onMouseEnter={() => setHoveredSlice('ineligible')}
          onMouseLeave={() => setHoveredSlice(null)}
          className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
            hoveredSlice === 'ineligible' ? 'bg-rose-50 text-rose-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0" />
            <span>Belum Memenuhi Syarat</span>
          </div>
          <span className="font-mono font-bold text-rose-700">
            {ineligible} ({pctIneligible}%)
          </span>
        </div>
      </div>
    </Card>
  );
}

// =========================================================================
// 3. BAR CHART KOMPARASI KINERJA ANTAR DIVISI / BIDANG
// =========================================================================
export function DivisionPerformanceBarChart({
  fieldSummaries,
  threshold = 75,
  onSelectDivision,
}: {
  fieldSummaries: FieldSummaryData[];
  threshold?: number;
  onSelectDivision?: (fieldId: string) => void;
}) {
  const [metricMode, setMetricMode] = useState<'final_score' | 'split_score' | 'eligibility'>('final_score');
  const [sortBy, setSortBy] = useState<'score' | 'members' | 'name'>('score');

  // Sort division list
  const sortedFields = [...fieldSummaries].sort((a, b) => {
    if (sortBy === 'score') return b.average_final_score - a.average_final_score;
    if (sortBy === 'members') return b.total_members - a.total_members;
    if (sortBy === 'name') return a.field_name.localeCompare(b.field_name);
    return 0;
  });

  return (
    <Card className="p-5">
      {/* Header with Metric Mode Switcher & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Grafik Komparasi Kinerja Antar Divisi / Bidang
            </h3>
            <p className="text-xs text-slate-500">
              Perbandingan capaian nilai dan kelulusan dari {fieldSummaries.length} divisi
            </p>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setMetricMode('final_score')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                metricMode === 'final_score'
                  ? 'bg-white text-teal-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nilai Akhir (100)
            </button>
            <button
              onClick={() => setMetricMode('split_score')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                metricMode === 'split_score'
                  ? 'bg-white text-teal-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sistem vs Koord
            </button>
            <button
              onClick={() => setMetricMode('eligibility')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                metricMode === 'eligibility'
                  ? 'bg-white text-teal-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kelayakan (%)
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="score">Urut Nilai</option>
            <option value="members">Urut Panitia</option>
            <option value="name">Urut Abjad</option>
          </select>
        </div>
      </div>

      {/* Guide line indicator for threshold */}
      <div className="pt-3 pb-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>Divisi / Bidang</span>
        <div className="flex items-center gap-3">
          {metricMode === 'split_score' && (
            <div className="flex items-center gap-3 mr-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-500" /> Sistem (40)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> Koord (60)
              </span>
            </div>
          )}
          <span className="flex items-center gap-1 font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Standar Lulus: ≥ {threshold}.00
          </span>
        </div>
      </div>

      {/* Bars Container */}
      <div className="space-y-3.5 mt-2">
        {sortedFields.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Belum ada data divisi tercatat.
          </div>
        ) : (
          sortedFields.map((field) => {
            const isPassing = field.average_final_score >= threshold;

            return (
              <div
                key={field.field_id}
                className="group p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {field.field_code}
                    </span>
                    <button
                      onClick={() => onSelectDivision?.(field.field_id)}
                      className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors text-left flex items-center gap-1"
                    >
                      <span>{field.field_name}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      ({field.total_members} panitia • {field.coordinator_name})
                    </span>
                  </div>

                  {/* Right Score Pill */}
                  <div className="font-mono font-bold text-xs shrink-0">
                    {metricMode === 'final_score' && (
                      <span
                        className={`px-2 py-0.5 rounded-lg ${
                          isPassing
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {field.average_final_score.toFixed(2)} / 100
                      </span>
                    )}

                    {metricMode === 'split_score' && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-teal-700 font-semibold">{field.average_system_score}</span>
                        <span className="text-slate-300">+</span>
                        <span className="text-blue-700 font-semibold">{field.average_coordinator_score}</span>
                        <span className="text-slate-400">=</span>
                        <span className="text-slate-900 font-bold">{field.average_final_score.toFixed(1)}</span>
                      </div>
                    )}

                    {metricMode === 'eligibility' && (
                      <span className="text-emerald-700 font-bold">
                        {field.eligibility_percentage}% ({field.eligible_count}/{field.total_members} Lulus)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar Container with Benchmark Line */}
                <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                  {/* Vertical Benchmark Threshold Line at 75% */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-300 z-10"
                    style={{ left: `${threshold}%` }}
                    title={`Ambang Batas Kelulusan (${threshold}%)`}
                  />

                  {metricMode === 'final_score' && (
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isPassing
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                          : 'bg-gradient-to-r from-rose-400 to-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, field.average_final_score))}%` }}
                    />
                  )}

                  {metricMode === 'split_score' && (
                    <div className="flex h-full rounded-full overflow-hidden">
                      {/* System Score (out of 40) */}
                      <div
                        className="bg-teal-500 h-full transition-all duration-700"
                        style={{ width: `${Math.min(40, (field.average_system_score / 100) * 100)}%` }}
                        title={`Skor Sistem: ${field.average_system_score}/40`}
                      />
                      {/* Coordinator Score (out of 60) */}
                      <div
                        className="bg-blue-600 h-full transition-all duration-700"
                        style={{ width: `${Math.min(60, (field.average_coordinator_score / 100) * 100)}%` }}
                        title={`Nilai Koordinator: ${field.average_coordinator_score}/60`}
                      />
                    </div>
                  )}

                  {metricMode === 'eligibility' && (
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(2, field.eligibility_percentage))}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          Klik nama divisi untuk meninjau anggota panitia terkait
        </span>
        <span className="font-mono text-slate-400">
          Garis vertikal = Target Kelulusan ({threshold} Poin)
        </span>
      </div>
    </Card>
  );
}

// =========================================================================
// 4. COLUMN CHART TREN KEHADIRAN PER KEGIATAN
// =========================================================================
export function ActivityAttendanceColumnChart({
  activitySummaries,
  onSelectActivity,
}: {
  activitySummaries: ActivitySummaryData[];
  onSelectActivity?: (activityId: string) => void;
}) {
  const [activeActId, setActiveActId] = useState<string | null>(null);

  const activeActivity = activitySummaries.find((a) => a.id === activeActId) || null;

  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <ActivityIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Grafik Tingkat Kehadiran per Agenda Kegiatan
            </h3>
            <p className="text-xs text-slate-500">
              Analisis persentase partisipasi panitia di setiap rangkaian acara
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs self-start sm:self-auto">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Tepat Waktu
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Terlambat
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Alpa/Izin
          </span>
        </div>
      </div>

      {/* Chart Visual Columns */}
      <div className="mt-6">
        {activitySummaries.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Belum ada agenda kegiatan yang ditugaskan.
          </div>
        ) : (
          <div className="relative">
            {/* Grid Lines for 100%, 75%, 50%, 25% */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-12 opacity-60">
              <div className="border-b border-slate-100 w-full flex justify-between text-[10px] text-slate-400">
                <span>100%</span>
              </div>
              <div className="border-b border-dashed border-emerald-200 w-full flex justify-between text-[10px] text-emerald-600 font-semibold">
                <span>75% (Target)</span>
              </div>
              <div className="border-b border-slate-100 w-full flex justify-between text-[10px] text-slate-400">
                <span>50%</span>
              </div>
              <div className="border-b border-slate-100 w-full flex justify-between text-[10px] text-slate-400">
                <span>25%</span>
              </div>
              <div className="border-b border-slate-200 w-full" />
            </div>

            {/* Columns Container */}
            <div className="relative z-10 flex items-end justify-between gap-2 sm:gap-4 overflow-x-auto pt-6 pb-2 min-h-[220px]">
              {activitySummaries.map((act) => {
                const total = act.total_assigned || 0;
                const attended = act.total_checked_in || 0;
                const onTime = act.total_on_time || 0;
                const late = act.total_late || 0;
                const rate = act.attendance_rate || 0;

                const onTimePct = total > 0 ? (onTime / total) * 100 : 0;
                const latePct = total > 0 ? (late / total) * 100 : 0;

                const isHovered = activeActId === act.id;

                return (
                  <div
                    key={act.id}
                    onMouseEnter={() => setActiveActId(act.id)}
                    onMouseLeave={() => setActiveActId(null)}
                    onClick={() => onSelectActivity?.(act.id)}
                    className="flex-1 min-w-[56px] max-w-[88px] flex flex-col items-center cursor-pointer group"
                  >
                    {/* Rate Percentage Badge on top */}
                    <div
                      className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md mb-2 transition-all ${
                        isHovered
                          ? 'bg-slate-900 text-white scale-110 shadow-sm'
                          : rate >= 75
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {rate}%
                    </div>

                    {/* Column Bar with fixed height scale (140px max) */}
                    <div className="relative w-7 sm:w-9 h-[140px] bg-slate-100 rounded-t-xl overflow-hidden flex flex-col justify-end group-hover:ring-2 group-hover:ring-teal-500 transition-all">
                      {/* Late Portion (Amber) */}
                      {latePct > 0 && (
                        <div
                          className="w-full bg-amber-500 transition-all duration-500"
                          style={{ height: `${latePct}%` }}
                          title={`Terlambat: ${late} panitia`}
                        />
                      )}

                      {/* On-Time Portion (Emerald) */}
                      {onTimePct > 0 && (
                        <div
                          className="w-full bg-emerald-500 transition-all duration-500"
                          style={{ height: `${onTimePct}%` }}
                          title={`Tepat Waktu: ${onTime} panitia`}
                        />
                      )}
                    </div>

                    {/* Activity Code & Name below */}
                    <div className="mt-2 text-center w-full">
                      <div className="text-[10px] font-mono font-bold text-slate-800 truncate">
                        {act.activity_code}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate max-w-[56px] sm:max-w-[70px]">
                        {act.activity_name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating / Active Activity Tooltip Card */}
      {activeActivity && (
        <div className="mt-4 p-3.5 rounded-xl bg-slate-900 text-white text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {activeActivity.activity_code}
              </span>
              <h4 className="font-bold text-sm text-white">
                {activeActivity.activity_name}
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Lokasi: {activeActivity.activity_location || 'Venue Resmi'} • Total Ditugaskan: {activeActivity.total_assigned} Panitia
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
            <div>
              <span className="text-[10px] text-emerald-400 block">Tepat Waktu</span>
              <span className="font-bold text-sm text-white">{activeActivity.total_on_time}</span>
            </div>
            <div>
              <span className="text-[10px] text-amber-400 block">Terlambat</span>
              <span className="font-bold text-sm text-white">{activeActivity.total_late}</span>
            </div>
            <div>
              <span className="text-[10px] text-rose-400 block">Alpa / Izin</span>
              <span className="font-bold text-sm text-white">{activeActivity.total_absent_or_excused}</span>
            </div>
            <div className="pl-3 border-l border-slate-700">
              <span className="text-[10px] text-teal-400 block">Persentase</span>
              <span className="font-extrabold text-base text-teal-300">{activeActivity.attendance_rate}%</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// =========================================================================
// 5. MASTER REPORT CHARTS WRAPPER COMPONENT
// =========================================================================
export default function ReportCharts({
  overview,
  fieldSummaries,
  activitySummaries,
  gradeDistribution,
  onSelectDivision,
  onSelectActivity,
}: ReportChartsProps) {
  return (
    <div className="space-y-6">
      {/* SECTION 1: Donut Charts (Attendance Composition & Certificate Eligibility) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AttendanceDonutChart overview={overview} />
        <EligibilityDonutChart overview={overview} />
      </div>

      {/* SECTION 2: Division Performance Bar Chart */}
      <DivisionPerformanceBarChart
        fieldSummaries={fieldSummaries}
        threshold={overview.certificateThreshold || 75}
        onSelectDivision={onSelectDivision}
      />

      {/* SECTION 3: Activity Attendance Rate Trend Column Chart */}
      <ActivityAttendanceColumnChart
        activitySummaries={activitySummaries}
        onSelectActivity={onSelectActivity}
      />
    </div>
  );
}
