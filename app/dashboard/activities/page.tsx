'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  Calendar, 
  Plus, 
  MapPin, 
  Clock, 
  QrCode, 
  Users, 
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Edit2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Activity } from '@/lib/types';
import { formatDateTimeWITA, generateActivityCode } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';
import { SkeletonActivityCard } from '@/components/ui/Skeleton';

export default function ActivitiesPage() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'coordinator' | 'member'>('member');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State: Create
  const [periodId, setPeriodId] = useState('');
  const [activityCode, setActivityCode] = useState('');
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [activityLocation, setActivityLocation] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [checkInOpensAt, setCheckInOpensAt] = useState('');
  const [checkInClosesAt, setCheckInClosesAt] = useState('');
  const [checkOutOpensAt, setCheckOutOpensAt] = useState('');
  const [checkOutClosesAt, setCheckOutClosesAt] = useState('');
  const [assignAllMembers, setAssignAllMembers] = useState(false);

  // Form State: Edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedActivityForEdit, setSelectedActivityForEdit] = useState<Activity | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    activityCode: '',
    activityName: '',
    activityLocation: '',
    activityDescription: '',
    startAt: '',
    endAt: '',
    checkInOpensAt: '',
    checkInClosesAt: '',
    checkOutOpensAt: '',
    checkOutClosesAt: '',
    activityStatus: 'scheduled' as any,
    attendanceRequired: true,
  });

  // Modal State: Delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedActivityForDelete, setSelectedActivityForDelete] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('system_role')
          .eq('id', user.id)
          .single();
        if (profile) setUserRole(profile.system_role);
      }

      const { data: periods } = await supabase
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .limit(1);
      if (periods && periods.length > 0) setPeriodId(periods[0].id);

      const { data } = await supabase
        .from('activities')
        .select('*')
        .order('start_at', { ascending: true });
      if (data) setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    const initialCode = generateActivityCode('', activities);
    setActivityCode(initialCode);
    setIsCodeManual(false);
    setActivityName('');
    setActivityLocation('');
    setActivityDescription('');
    setStartAt('');
    setEndAt('');
    setCheckInOpensAt('');
    setCheckInClosesAt('');
    setCheckOutOpensAt('');
    setCheckOutClosesAt('');
    setAssignAllMembers(false);
    setIsCreateModalOpen(true);
  };

  const handleActivityNameChange = (name: string) => {
    setActivityName(name);
    if (!isCodeManual) {
      const autoCode = generateActivityCode(name, activities);
      setActivityCode(autoCode);
    }
  };

  const handleRegenerateCode = (format: 'smart' | 'sequence' | 'date' = 'smart') => {
    const newCode = generateActivityCode(activityName, activities, format);
    setActivityCode(newCode);
    setIsCodeManual(false);
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let creatorId = user?.id;

      const effectiveStartAt = checkInOpensAt;
      const effectiveEndAt = checkOutClosesAt || checkInClosesAt;

      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: periodId || '00000000-0000-0000-0000-000000000001',
          activityCode: activityCode.trim().toUpperCase(),
          activityName: activityName.trim(),
          activityDescription: activityDescription.trim() || null,
          activityLocation: activityLocation.trim(),
          startAt: new Date(effectiveStartAt).toISOString(),
          endAt: new Date(effectiveEndAt).toISOString(),
          checkInOpensAt: new Date(checkInOpensAt).toISOString(),
          checkInClosesAt: new Date(checkInClosesAt).toISOString(),
          checkOutOpensAt: new Date(checkOutOpensAt || effectiveStartAt).toISOString(),
          checkOutClosesAt: new Date(checkOutClosesAt || effectiveEndAt).toISOString(),
          assignAllMembers,
          createdBy: creatorId,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal membuat agenda kegiatan');

      toast.success(
        'Agenda Kegiatan Berhasil Dibuat',
        `Kegiatan "${activityName}" telah berhasil didaftarkan ke sistem.`
      );

      // Broadcast notifikasi in-app
      const notifDate = effectiveStartAt ? new Date(effectiveStartAt).toLocaleDateString('id-ID', { dateStyle: 'long' }) : 'segera';
      sendInAppNotification({
        title: 'Agenda Baru Telah Diterbitkan',
        message: `Kegiatan "${activityName}" dijadwalkan pada ${notifDate}. Lokasi: ${activityLocation}.`,
        notificationType: 'assignment',
        actionUrl: `/dashboard/activities/${result.data?.id || ''}`,
        broadcastToAll: true,
      });

      setIsCreateModalOpen(false);
      setIsCodeManual(false);
      setActivityCode('');
      setActivityName('');
      setActivityLocation('');
      setActivityDescription('');
      setStartAt('');
      setEndAt('');
      setCheckInOpensAt('');
      setCheckInClosesAt('');
      setCheckOutOpensAt('');
      setCheckOutClosesAt('');
      setAssignAllMembers(false);
      await fetchActivities();
    } catch (err: any) {
      toast.error('Gagal Membuat Agenda', err.message);
    } finally {
      setCreating(false);
    }
  };

  // Helper untuk format datetime ke format input datetime-local
  const formatForInput = (isoStr?: string | null) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Buka Modal Edit
  const openEditModal = (act: Activity) => {
    setSelectedActivityForEdit(act);
    setEditForm({
      id: act.id,
      activityCode: act.activity_code,
      activityName: act.activity_name,
      activityLocation: act.activity_location,
      activityDescription: act.activity_description || '',
      startAt: formatForInput(act.start_at),
      endAt: formatForInput(act.end_at),
      checkInOpensAt: formatForInput(act.check_in_opens_at),
      checkInClosesAt: formatForInput(act.check_in_closes_at),
      checkOutOpensAt: formatForInput(act.check_out_opens_at || act.end_at),
      checkOutClosesAt: formatForInput(act.check_out_closes_at || act.end_at),
      activityStatus: act.activity_status,
      attendanceRequired: act.attendance_required,
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleEditActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;

    setUpdating(true);
    try {
      const effectiveStartAt = editForm.checkInOpensAt;
      const effectiveEndAt = editForm.checkOutClosesAt || editForm.checkInClosesAt;

      const res = await fetch('/api/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          startAt: effectiveStartAt,
          endAt: effectiveEndAt,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal memperbarui agenda.');

      toast.success(
        'Agenda Kegiatan Berhasil Diperbarui',
        'Informasi jadwal, lokasi, dan status kegiatan telah diperbarui.'
      );
      setIsEditModalOpen(false);
      setSelectedActivityForEdit(null);
      await fetchActivities();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Mengedit Agenda', err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Buka Modal Hapus
  const openDeleteModal = (act: Activity) => {
    setSelectedActivityForDelete(act);
    setIsDeleteModalOpen(true);
  };

  // Submit Hapus
  const handleDeleteActivitySubmit = async () => {
    if (!selectedActivityForDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/activities?id=${selectedActivityForDelete.id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menghapus agenda kegiatan.');

      toast.success(
        'Agenda Kegiatan Dihapus',
        'Kegiatan telah berhasil dihapus dari sistem.'
      );
      setIsDeleteModalOpen(false);
      setSelectedActivityForDelete(null);
      await fetchActivities();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Menghapus Agenda', err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-50 text-teal-700 border border-teal-200">
              Agenda & Penugasan Panitia
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Buleleng 2026</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-600" />
            Agenda Kegiatan & Penugasan Panitia
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Jadwal kegiatan resmi, penugasan anggota per sie, jendela toleransi presensi, dan stasiun QR code.
          </p>
        </div>

        {(userRole === 'admin' || userRole === 'coordinator') && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 self-start sm:self-auto active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Agenda Kegiatan</span>
          </button>
        )}
      </div>

      {/* Info Banner untuk Koordinator */}
      {(userRole === 'admin' || userRole === 'coordinator') && (
        <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-start gap-3 text-xs text-teal-900">
          <Users className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold block mb-0.5">Panduan Penugasan Koordinator Bidang:</span>
            <span>
              Untuk menugaskan anggota sie Anda pada suatu kegiatan, klik tombol <strong className="text-teal-800 underline">"Tugaskan Panitia"</strong> pada kartu agenda di bawah. Anda dapat memilih anggota sie tertentu atau opsi pilih semua untuk agenda wajib bersama.
            </span>
          </div>
        </div>
      )}

      {/* Activities Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((n) => (
            <SkeletonActivityCard key={n} />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <Card className="text-center py-12">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">Belum Ada Agenda Kegiatan</h3>
          <p className="text-xs text-slate-500 mt-1">Agenda kegiatan resmi yang dibuat akan muncul di sini.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {activities.map((act) => (
            <Card key={act.id} className="hover:border-teal-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-mono font-bold text-teal-800 px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200">
                    {act.activity_code}
                  </span>
                  <Badge status={act.activity_status} />
                </div>

                <h3 className="font-bold text-slate-900 text-base leading-snug">{act.activity_name}</h3>
                {act.activity_description && (
                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {act.activity_description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{act.activity_location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{formatDateTimeWITA(act.start_at)} s/d {formatDateTimeWITA(act.end_at)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                    <span className="text-teal-800 font-semibold block">Jendela Check-in On-Time:</span>
                    <span>{formatDateTimeWITA(act.check_in_opens_at)} - {formatDateTimeWITA(act.check_in_closes_at)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">
                  {act.attendance_required ? 'Wajib Presensi' : 'Opsional'}
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(userRole === 'admin' || userRole === 'coordinator') && (
                    <>
                      <button
                        onClick={() => openEditModal(act)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Edit Agenda Kegiatan"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => openDeleteModal(act)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Hapus Agenda Kegiatan"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Hapus</span>
                      </button>

                      <Link
                        href={`/dashboard/activities/${act.id}?openAssign=true`}
                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Tugaskan</span>
                      </Link>
                    </>
                  )}

                  <Link
                    href={`/dashboard/activities/${act.id}`}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-teal-600" />
                    <span>Detail & QR</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Buat Kegiatan */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Buat Agenda Kegiatan Baru"
        description="Atur jadwal agenda kepanitiaan dan rentang waktu toleransi check-in."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateActivity} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>Kode Kegiatan</span>
                  <span className="text-rose-500">*</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                      isCodeManual
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                    {isCodeManual ? 'Manual' : 'Auto'}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => handleRegenerateCode('smart')}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1 transition-colors"
                  title="Generate ulang kode berdasarkan nama kegiatan"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Ulang</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  placeholder="ACT-WORKSHOP-2"
                  value={activityCode}
                  onChange={(e) => {
                    setActivityCode(e.target.value.toUpperCase());
                    setIsCodeManual(true);
                  }}
                  className="w-full p-2.5 pr-16 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 font-mono font-bold focus:outline-none focus:border-teal-500 uppercase tracking-wide transition-all shadow-sm"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRegenerateCode('smart')}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1"
                    title="Generate kode otomatis"
                  >
                    <Sparkles className="w-3 h-3 text-teal-600" />
                    <span>Auto</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                <span className="truncate mr-2">
                  {isCodeManual
                    ? 'Diedit manual. Klik "Auto" untuk kembali sinkron.'
                    : 'Kode menyesuaikan nama kegiatan secara otomatis.'}
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRegenerateCode('sequence')}
                    className="hover:text-teal-700 hover:underline"
                    title="Format Urut: ACT-YYYY-001"
                  >
                    #Urut
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleRegenerateCode('date')}
                    className="hover:text-teal-700 hover:underline"
                    title="Format Tanggal: ACT-YYYYMMDD-XXX"
                  >
                    #Tgl
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kegiatan *</label>
              <input
                type="text"
                required
                placeholder="Workshop Public Speaking Finalis"
                value={activityName}
                onChange={(e) => handleActivityNameChange(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Lokasi Kegiatan *</label>
            <input
              type="text"
              required
              placeholder="Gedung Kesenian Gde Manik Singaraja"
              value={activityLocation}
              onChange={(e) => setActivityLocation(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deskripsi & Instruksi Panitia</label>
            <textarea
              rows={2}
              placeholder="Briefing dress code dan jobdesk per divisi..."
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Jendela Presensi Masuk (Check-in) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-teal-50/60 rounded-xl border border-teal-200">
            <div>
              <label className="block font-semibold text-teal-900 mb-1">Check-in Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={checkInOpensAt}
                onChange={(e) => setCheckInOpensAt(e.target.value)}
                className="w-full p-2 rounded-lg bg-white border border-teal-300 text-slate-900 focus:outline-none focus:border-teal-500"
              />
              <p className="text-[10px] text-teal-700/80 mt-1">Waktu dimulainya presensi masuk panitia.</p>
            </div>
            <div>
              <label className="block font-semibold text-teal-900 mb-1">Batas Toleransi Check-in (On-Time) *</label>
              <input
                type="datetime-local"
                required
                value={checkInClosesAt}
                onChange={(e) => setCheckInClosesAt(e.target.value)}
                className="w-full p-2 rounded-lg bg-white border border-teal-300 text-slate-900 focus:outline-none focus:border-teal-500"
              />
              <p className="text-[10px] text-teal-700/80 mt-1">Setelah jam ini, status kehadiran dicatat "Terlambat".</p>
            </div>
          </div>

          {/* Jendela Presensi Pulang (Check-out) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
            <div>
              <label className="block font-semibold text-amber-900 mb-1">Check-out Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={checkOutOpensAt}
                onChange={(e) => setCheckOutOpensAt(e.target.value)}
                className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-amber-700/80 mt-1">Check-out sebelum jam ini dicatat status "Mendahului".</p>
            </div>
            <div>
              <label className="block font-semibold text-amber-900 mb-1">Batas Toleransi Check-out *</label>
              <input
                type="datetime-local"
                required
                value={checkOutClosesAt}
                onChange={(e) => setCheckOutClosesAt(e.target.value)}
                className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-amber-700/80 mt-1">Batas akhir penutupan jendela presensi kepulangan.</p>
            </div>
          </div>

          {/* Opsi Wajib Hadir Seluruh Panitia */}
          <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-teal-900">
              <input
                type="checkbox"
                checked={assignAllMembers}
                onChange={(e) => setAssignAllMembers(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span>Wajib Hadir Seluruh Panitia (Otomatis tugaskan seluruh anggota panitia aktif)</span>
            </label>
            <p className="text-[11px] text-slate-600 mt-1 pl-6">
              Cocok untuk Rapat Pleno, Gladi Bersih, atau Malam Grand Final di mana seluruh panitia wajib hadir tanpa perlu ditugaskan manual per sie.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-teal-600/20"
            >
              {creating ? 'Menyimpan...' : 'Simpan Agenda Kegiatan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Agenda Kegiatan */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Agenda Kegiatan"
        description="Perbarui informasi kegiatan, jadwal, toleransi presensi, atau status agenda."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleEditActivitySubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Kode Kegiatan *</label>
                <button
                  type="button"
                  onClick={() => {
                    const otherActs = activities.filter((a) => a.id !== editForm.id);
                    const newCode = generateActivityCode(editForm.activityName, otherActs);
                    setEditForm({ ...editForm, activityCode: newCode });
                  }}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
                  title="Generate otomatis kode berdasarkan nama"
                >
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Generate Otomatis</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={editForm.activityCode}
                onChange={(e) => setEditForm({ ...editForm, activityCode: e.target.value.toUpperCase() })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 font-mono font-bold focus:outline-none focus:border-teal-500 uppercase tracking-wide"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kegiatan *</label>
              <input
                type="text"
                required
                value={editForm.activityName}
                onChange={(e) => setEditForm({ ...editForm, activityName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lokasi Kegiatan *</label>
              <input
                type="text"
                required
                value={editForm.activityLocation}
                onChange={(e) => setEditForm({ ...editForm, activityLocation: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Kegiatan</label>
              <select
                value={editForm.activityStatus}
                onChange={(e) => setEditForm({ ...editForm, activityStatus: e.target.value as any })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500"
              >
                <option value="scheduled">Terjadwal (Scheduled)</option>
                <option value="ongoing">Sedang Berlangsung (Ongoing)</option>
                <option value="completed">Selesai (Completed)</option>
                <option value="cancelled">Dibatalkan (Cancelled)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deskripsi Kegiatan</label>
            <textarea
              rows={2}
              value={editForm.activityDescription}
              onChange={(e) => setEditForm({ ...editForm, activityDescription: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-teal-50/50 rounded-xl border border-teal-200">
            <div>
              <label className="block font-semibold text-teal-900 mb-1">Check-in Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkInOpensAt}
                onChange={(e) => setEditForm({ ...editForm, checkInOpensAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-teal-300 text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-teal-900 mb-1">Batas Toleransi Check-in *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkInClosesAt}
                onChange={(e) => setEditForm({ ...editForm, checkInClosesAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-teal-300 text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
            <div>
              <label className="block font-semibold text-amber-900 mb-1">Check-out Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkOutOpensAt}
                onChange={(e) => setEditForm({ ...editForm, checkOutOpensAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-amber-700/80 mt-1">Check-out sebelum jam ini tercatat status "Mendahului".</p>
            </div>
            <div>
              <label className="block font-semibold text-amber-900 mb-1">Batas Toleransi Check-out *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkOutClosesAt}
                onChange={(e) => setEditForm({ ...editForm, checkOutClosesAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-amber-700/80 mt-1">Batas akhir penutupan jendela presensi pulang.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editAttendanceRequired"
              checked={editForm.attendanceRequired}
              onChange={(e) => setEditForm({ ...editForm, attendanceRequired: e.target.checked })}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <label htmlFor="editAttendanceRequired" className="font-semibold text-slate-700 select-none">
              Wajib Melakukan Presensi
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-teal-600/20"
            >
              {updating ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Konfirmasi Hapus Agenda Kegiatan */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Agenda Kegiatan"
        description="Apakah Anda yakin ingin menghapus agenda kegiatan ini beserta seluruh riwayat presensi terkait?"
      >
        <div className="space-y-4 text-xs">
          {selectedActivityForDelete && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
              <span className="font-bold block text-sm">{selectedActivityForDelete.activity_name}</span>
              <p className="font-mono text-[11px] text-rose-700">{selectedActivityForDelete.activity_code} • {selectedActivityForDelete.activity_location}</p>
              <p className="text-[11px] text-rose-600 mt-2">
                ⚠️ Menghapus kegiatan ini akan menghapus penugasan dan riwayat presensi yang terkait secara otomatis.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteActivitySubmit}
              className="px-4 py-2 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm shadow-rose-600/20"
            >
              {deleting ? 'Menghapus...' : 'Ya, Hapus Kegiatan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
