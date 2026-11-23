'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  Users,
  FileText,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  X
} from 'lucide-react';
import { formatDateTimeWITA } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { AuditActivityItem } from '@/app/api/audit-logs/route';

interface ActivityOption {
  id: string;
  activity_name: string;
  activity_code: string;
}

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditActivityItem[]>([]);
  const [actors, setActors] = useState<{ id: string; fullName: string; memberCode: string; systemRole: string }[]>([]);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    assignments: 0,
    attendances: 0,
    excuses: 0,
    evaluations: 0,
    activities: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'assignment' | 'attendance' | 'excuse' | 'evaluation' | 'activity'>('all');
  const [selectedActorId, setSelectedActorId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [categoryFilter, selectedActorId, selectedActivityId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (selectedActorId) params.set('actorId', selectedActorId);
      if (selectedActivityId) params.set('activityId', selectedActivityId);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '300');

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat log audit');
      }

      setLogs(json.data || []);
      if (json.actors && json.actors.length > 0) setActors(json.actors);
      if (json.activities && json.activities.length > 0) setActivities(json.activities);
      if (json.stats) setStats(json.stats);
    } catch (err: any) {
      toast.error('Gagal Memuat Log Aktivitas', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setSelectedActorId('');
    setSelectedActivityId('');
  };

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'assignment':
        return {
          label: 'Penugasan Panitia',
          bg: 'bg-indigo-50',
          border: 'border-indigo-200',
          text: 'text-indigo-700',
          dot: 'bg-indigo-500',
          icon: Users,
        };
      case 'attendance':
        return {
          label: 'Presensi & Kehadiran',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          dot: 'bg-emerald-500',
          icon: CheckCircle2,
        };
      case 'excuse':
        return {
          label: 'Dispensasi & Izin',
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          text: 'text-purple-700',
          dot: 'bg-purple-500',
          icon: FileText,
        };
      case 'evaluation':
        return {
          label: 'Evaluasi & Nilai',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-800',
          dot: 'bg-amber-500',
          icon: Star,
        };
      case 'activity':
        return {
          label: 'Agenda Kegiatan',
          bg: 'bg-teal-50',
          border: 'border-teal-200',
          text: 'text-teal-700',
          dot: 'bg-teal-500',
          icon: Calendar,
        };
      default:
        return {
          label: 'Aktivitas Sistem',
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          text: 'text-slate-700',
          dot: 'bg-slate-500',
          icon: Clock,
        };
    }
  };

  const isFiltering = searchQuery || categoryFilter !== 'all' || selectedActorId || selectedActivityId;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Audit & Keamanan Sistem</span>
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Buleleng 2026</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Log Aktivitas & Jejak Operasional Panitia
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Lacak kronologi setiap mutasi penugasan panitia, presensi kedatangan, pengesahan dispensasi izin, hingga penilaian nilai kinerja secara transparan.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Aktivitas
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.total}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Tercatat di sistem</span>
        </div>

        <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">
            Penugasan
          </span>
          <span className="text-xl sm:text-2xl font-black text-indigo-950">{stats.assignments}</span>
          <span className="text-[10px] text-indigo-700/80 block mt-0.5">Mandat panitia</span>
        </div>

        <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Presensi Hadir
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-950">{stats.attendances}</span>
          <span className="text-[10px] text-emerald-700/80 block mt-0.5">Check-in tercatat</span>
        </div>

        <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
            Dispensasi Izin
          </span>
          <span className="text-xl sm:text-2xl font-black text-purple-950">{stats.excuses}</span>
          <span className="text-[10px] text-purple-700/80 block mt-0.5">Pengajuan & tinjauan</span>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
            Evaluasi Nilai
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-950">{stats.evaluations}</span>
          <span className="text-[10px] text-amber-800/80 block mt-0.5">Input skor koordinator</span>
        </div>
      </div>

      {/* FILTER & PENCARIAN */}
      <Card className="p-4 sm:p-5 bg-white border-slate-200">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama pelaku, nama panitia ditugaskan, nama agenda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
              {/* Filter Agenda Kegiatan */}
              <div className="relative min-w-[190px]">
                <select
                  value={selectedActivityId}
                  onChange={(e) => setSelectedActivityId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="">Semua Agenda Kegiatan</option>
                  {activities.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.activity_name} ({act.activity_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Aktor / Pelaku */}
              <div className="relative min-w-[190px]">
                <select
                  value={selectedActorId}
                  onChange={(e) => setSelectedActorId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="">Semua Pelaku / Aktor</option>
                  {actors.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.fullName} ({act.memberCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Cari</span>
                </button>

                {isFiltering && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                    title="Reset Semua Filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Kategori Tabs Pill */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 no-scrollbar text-xs">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1 shrink-0">
              <SlidersHorizontal className="w-3 h-3" />
              <span>Kategori:</span>
            </span>

            {[
              { id: 'all', label: 'Semua Kategori' },
              { id: 'assignment', label: 'Penugasan Panitia' },
              { id: 'attendance', label: 'Presensi & Kehadiran' },
              { id: 'excuse', label: 'Dispensasi Izin' },
              { id: 'evaluation', label: 'Evaluasi Kinerja' },
              { id: 'activity', label: 'Agenda Kegiatan' },
            ].map((tab) => {
              const isActive = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </form>
      </Card>

      {/* DAFTAR LOG AUDIT KRONOLOGIS */}
      <Card
        title={`Kronologi Jejak Audit (${logs.length} Aktivitas)`}
        subtitle="Riwayat lengkap setiap aksi pengguna terekam dengan timestamp WITA presisi"
      >
        {loading ? (
          <div className="space-y-3 animate-fade-in py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start justify-between gap-3"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-28 rounded-md" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-3.5 w-full max-w-lg" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <span className="font-semibold block text-slate-700">Tidak Ada Log Aktivitas yang Cocok</span>
            <span>Coba ubah filter agenda kegiatan, aktor, atau kata kunci pencarian.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((item) => {
              const meta = getCategoryMeta(item.category);
              const IconComp = meta.icon;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-4.5 rounded-2xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3.5"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${meta.bg} ${meta.border} border flex items-center justify-center shrink-0 mt-0.5`}>
                      <IconComp className={`w-4 h-4 ${meta.text}`} />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.bg} ${meta.border} ${meta.text}`}>
                          {meta.label}
                        </span>

                        {item.activityName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/70 text-slate-700 border border-slate-300/60 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{item.activityName}</span>
                          </span>
                        )}

                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                          {item.actionTitle}
                        </h4>
                      </div>

                      <p className="text-slate-700 leading-relaxed text-xs">
                        {item.actionDescription}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Pelaku: </span>
                          <strong className="text-slate-800">{item.actor.fullName}</strong>
                          <span className="font-mono text-teal-700">({item.actor.memberCode})</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-[9px] font-semibold text-slate-700 uppercase">
                            {item.actor.systemRole}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp & Target Pill */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDateTimeWITA(item.timestamp)}
                    </span>
                    {item.target && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium truncate max-w-[200px]">
                        Target: <strong>{item.target.name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
