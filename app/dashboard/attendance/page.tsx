'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { CameraQrScanner } from '@/components/attendance/CameraQrScanner';
import { 
  QrCode, 
  Camera,
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Calendar,
  LogOut,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Edit2,
  Trash2,
  FileText
} from 'lucide-react';
import { ActivityAssignment } from '@/lib/types';
import { formatDateTimeWITA, formatTimeWITA } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AttendancePage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<ActivityAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeScanAction, setActiveScanAction] = useState<'check_in' | 'check_out'>('check_in');

  // Manual Request Modal State: Create
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out' | 'both'>('check_in');
  const [claimedTime, setClaimedTime] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  // Manual Request State: Riwayat & CRUD
  const [manualRequests, setManualRequests] = useState<any[]>([]);
  const [loadingManual, setLoadingManual] = useState(true);

  // Modal State: Edit Manual Request
  const [isEditManualModalOpen, setIsEditManualModalOpen] = useState(false);
  const [selectedManualForEdit, setSelectedManualForEdit] = useState<any | null>(null);
  const [editManualForm, setEditManualForm] = useState({
    requestId: '',
    attendanceType: 'check_in',
    claimedTime: '',
    reason: '',
    evidenceUrl: '',
  });
  const [updatingManual, setUpdatingManual] = useState(false);

  // Modal State: Delete Manual Request
  const [isDeleteManualModalOpen, setIsDeleteManualModalOpen] = useState(false);
  const [selectedManualForDelete, setSelectedManualForDelete] = useState<any | null>(null);
  const [deletingManual, setDeletingManual] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchAssignments();
    fetchManualRequests();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('activity_assignments')
        .select('*, activity:activities(*), attendance:attendances(*)')
        .eq('member_id', user.id)
        .eq('assignment_status', 'active')
        .order('created_at', { ascending: false });

      if (data) setAssignments(data as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchManualRequests = async () => {
    setLoadingManual(true);
    try {
      const res = await fetch('/api/attendance/manual');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setManualRequests(json.data);
      }
    } catch (err) {
      console.error('Error fetching manual requests:', err);
    } finally {
      setLoadingManual(false);
    }
  };

  // Callback saat QR Code berhasil dipindai oleh kamera
  const handleQrDecoded = async (decodedText: string) => {
    setSubmittingCode(true);
    setScanMessage(null);

    let activityId: string | undefined = undefined;
    let sessionCode: string | undefined = undefined;

    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.activityId) activityId = parsed.activityId;
      if (parsed.sessionCode) sessionCode = parsed.sessionCode;
    } catch {
      sessionCode = decodedText.trim();
    }

    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          sessionCode,
          actionType: activeScanAction,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyCheckedIn || data.alreadyCheckedOut || data.alreadyCompleted) {
          setScanMessage({ type: 'error', text: data.error });
          toast.warning('Pemberitahuan Presensi', data.error);
          setIsCameraOpen(false);
          fetchAssignments();
          return;
        }
        throw new Error(data.error || 'Gagal memproses presensi QR');
      }

      setScanMessage({ 
        type: 'success', 
        text: `Presensi Berhasil: ${data.message || 'Status kehadiran berhasil dicatat ke sistem!'}` 
      });
      toast.success(
        'Presensi Berhasil Dicatat',
        data.message || 'Status kehadiran Anda berhasil dicatat ke sistem!'
      );
      setIsCameraOpen(false);
      fetchAssignments();
    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message });
      toast.error('Gagal Melakukan Presensi', err.message);
      setIsCameraOpen(false);
    } finally {
      setSubmittingCode(false);
    }
  };

  // Kode Sesi Submit Manual
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCodeInput) return;
    setSubmittingCode(true);
    setScanMessage(null);

    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode: sessionCodeInput.trim().toUpperCase(),
          actionType: activeScanAction,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyCheckedIn || data.alreadyCheckedOut || data.alreadyCompleted) {
          setScanMessage({ type: 'error', text: data.error });
          toast.warning('Pemberitahuan Presensi', data.error);
          fetchAssignments();
          return;
        }
        throw new Error(data.error || 'Kode presensi tidak valid');
      }

      setScanMessage({ type: 'success', text: data.message });
      toast.success('Presensi Berhasil', data.message);
      setSessionCodeInput('');
      fetchAssignments();
    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message });
      toast.error('Presensi Gagal', err.message);
    } finally {
      setSubmittingCode(false);
    }
  };

  // Pengajuan Presensi Manual jika Kamera Bermasalah
  const handleSubmitManualRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: selectedAssignmentId,
          attendanceType,
          claimedTime,
          reason: manualReason.trim(),
          evidenceUrl: evidenceUrl.trim() || null,
          requestedBy: user?.id,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal mengirim pengajuan.');

      toast.success(
        'Permohonan Presensi Terkirim',
        'Permohonan presensi manual Anda berhasil diajukan dan sedang menunggu verifikasi koordinator.'
      );

      // Kirim notifikasi in-app
      sendInAppNotification({
        title: 'Permohonan Presensi Manual Baru',
        message: `Pengajuan presensi manual baru telah dikirimkan. Alasan: "${manualReason.trim().slice(0, 45)}..."`,
        notificationType: 'attendance',
        actionUrl: '/dashboard/attendance/manage',
        broadcastToAll: true,
      });

      setIsManualModalOpen(false);
      setManualReason('');
      setEvidenceUrl('');
      await fetchAssignments();
      await fetchManualRequests();
    } catch (err: any) {
      toast.error('Gagal Mengirim Pengajuan', err.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  // Helper date format for input
  const formatForInput = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Open Edit Manual Request
  const openEditManualModal = (req: any) => {
    setSelectedManualForEdit(req);
    setEditManualForm({
      requestId: req.id,
      attendanceType: req.attendance_type || 'check_in',
      claimedTime: formatForInput(req.claimed_event_time),
      reason: req.reason || '',
      evidenceUrl: req.evidence_url || '',
    });
    setIsEditManualModalOpen(true);
  };

  // Submit Edit Manual Request
  const handleEditManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editManualForm.requestId) return;

    setUpdatingManual(true);
    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editManualForm),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal memperbarui permohonan.');

      toast.success('Permohonan Diperbarui', 'Data permohonan presensi manual berhasil diperbarui.');
      setIsEditManualModalOpen(false);
      setSelectedManualForEdit(null);
      await fetchManualRequests();
    } catch (err: any) {
      toast.error('Gagal Mengedit Permohonan', err.message);
    } finally {
      setUpdatingManual(false);
    }
  };

  // Open Delete Manual Request
  const openDeleteManualModal = (req: any) => {
    setSelectedManualForEdit(req);
    setIsDeleteManualModalOpen(true);
  };

  // Submit Delete Manual Request
  const handleDeleteManualSubmit = async () => {
    if (!selectedManualForDelete) return;

    setDeletingManual(true);
    try {
      const res = await fetch(`/api/attendance/manual?id=${selectedManualForDelete.id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal membatalkan permohonan.');

      toast.success('Permohonan Dibatalkan', 'Permohonan presensi manual telah ditarik kembali.');
      setIsDeleteManualModalOpen(false);
      setSelectedManualForDelete(null);
      await fetchManualRequests();
    } catch (err: any) {
      toast.error('Gagal Membatalkan Permohonan', err.message);
    } finally {
      setDeletingManual(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <QrCode className="w-6 h-6 text-teal-600" />
          Presensi Mandiri Panitia
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Lakukan check-in dan check-out kegiatan resmi Pemilihan Duta GenRe Kabupaten Buleleng 2026 secara mandiri.
        </p>
      </div>

      {/* Pesan Hasil Scan */}
      {scanMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-3 animate-fade-in ${
            scanMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {scanMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span className="font-semibold">{scanMessage.text}</span>
        </div>
      )}

      {/* ============================================================================== */}
      {/* HERO SECTION: KAMERA SCANNER QR LIVE (CHECK-IN & CHECK-OUT) */}
      {/* ============================================================================== */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-white via-teal-50/30 to-emerald-50/40 border-teal-200 shadow-sm overflow-hidden">
        {isCameraOpen ? (
          <div className="space-y-3">
            <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
              activeScanAction === 'check_out'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-teal-50 border-teal-200 text-teal-800'
            }`}>
              <div className="flex items-center gap-2">
                {activeScanAction === 'check_out' ? (
                  <LogOut className="w-4 h-4 text-amber-600" />
                ) : (
                  <Camera className="w-4 h-4 text-teal-600" />
                )}
                <span>
                  Mode Pemindaian: <strong>{activeScanAction === 'check_out' ? 'Check-out (Kepulangan)' : 'Check-in (Kedatangan)'}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveScanAction(activeScanAction === 'check_in' ? 'check_out' : 'check_in')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Ganti ke {activeScanAction === 'check_in' ? 'Check-out' : 'Check-in'}
              </button>
            </div>

            <CameraQrScanner
              onScanSuccess={handleQrDecoded}
              onClose={() => setIsCameraOpen(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100/80 border border-teal-200 text-teal-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Pemindai Kamera QR HTML5 Real-Time</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Pindai QR Code di Lokasi Kegiatan
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pindai QR Code stasiun presensi saat tiba di lokasi untuk <strong>Check-in</strong>, dan pindai kembali saat selesai bertugas untuk <strong>Check-out</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveScanAction('check_in');
                  setIsCameraOpen(true);
                }}
                className="px-5 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 animate-pulse" />
                <span>Scan Check-in (Masuk)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveScanAction('check_out');
                  setIsCameraOpen(true);
                }}
                className="px-5 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Scan Check-out (Pulang)</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* ALTERNATIF: INPUT KODE SESI MANUAL (CHECK-IN / CHECK-OUT) */}
      {/* ============================================================================== */}
      <Card
        title="Atau Presensi via Kode Sesi Unik"
        subtitle="Jika kamera ponsel tidak dapat digunakan, masukkan kode yang tertera di bawah QR Code stasiun presensi"
      >
        <form onSubmit={handleCodeSubmit} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Pilih Aksi:</span>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="codeAction"
                checked={activeScanAction === 'check_in'}
                onChange={() => setActiveScanAction('check_in')}
                className="accent-teal-600"
              />
              <span>Check-in (Kedatangan)</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="codeAction"
                checked={activeScanAction === 'check_out'}
                onChange={() => setActiveScanAction('check_out')}
                className="accent-amber-600"
              />
              <span>Check-out (Kepulangan)</span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Contoh: ACT-001-MAIN atau NEIU-MAIN"
                value={sessionCodeInput}
                onChange={(e) => setSessionCodeInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs font-mono uppercase focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <button
              type="submit"
              disabled={submittingCode || !sessionCodeInput}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                activeScanAction === 'check_out'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {submittingCode
                ? 'Memvalidasi...'
                : activeScanAction === 'check_out'
                ? 'Check-out Sekarang'
                : 'Check-in Sekarang'}
            </button>
          </div>
        </form>
      </Card>

      {/* ============================================================================== */}
      {/* DAFTAR KEGIATAN YANG DITUGASKAN KEPADA SAYA */}
      {/* ============================================================================== */}
      <Card
        title="Agenda Kegiatan yang Ditugaskan Kepada Saya"
        subtitle="Surat tugas sah yang mewajibkan presensi Anda dan menjadi dasar perolehan poin sertifikat"
        action={
          <button
            onClick={() => {
              if (assignments.length > 0) {
                setSelectedAssignmentId(assignments[0].id);
                setClaimedTime(new Date().toISOString().slice(0, 16));
                setIsManualModalOpen(true);
              } else {
                toast.warning('Tidak Ada Agenda Aktif', 'Tidak ada penugasan kegiatan yang aktif untuk diajukan presensi manual.');
              }
            }}
            className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ajukan Presensi Manual</span>
          </button>
        }
      >
        {loading ? (
          <div className="space-y-3.5 animate-fade-in">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-5 w-3/4 max-w-sm" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-40" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <Skeleton className="h-8 w-28 rounded-xl" />
                  <Skeleton className="h-8 w-28 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Anda belum memiliki surat tugas pada kegiatan aktif saat ini. Hubungi koordinator bidang untuk penugasan.
          </div>
        ) : (
          <div className="space-y-3.5">
            {assignments.map((item) => {
              const act = item.activity;
              const att = item.attendance;
              const isCheckedIn = Boolean(att?.check_in_at);
              const isCheckedOut = Boolean(att?.check_out_at);
              const checkOutDeadline = act?.check_out_closes_at || act?.end_at;
              const isCheckoutClosed = Boolean(
                act?.activity_status === 'completed' ||
                (checkOutDeadline && new Date() > new Date(checkOutDeadline))
              );
              const isMissedCheckout = isCheckedIn && !isCheckedOut && isCheckoutClosed;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-300 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-teal-700 px-2.5 py-0.5 rounded bg-teal-50 border border-teal-200">
                        {act?.activity_code}
                      </span>
                      {isCheckedIn ? (
                        <Badge status={att?.check_in_status || 'on_time'} />
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                          Belum Hadir
                        </span>
                      )}
                      {isCheckedOut ? (
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                          att?.check_out_status === 'early_departure'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {att?.check_out_status === 'early_departure'
                            ? 'Pulang Mendahului'
                            : 'Pulang Sesuai Jadwal'}
                        </span>
                      ) : isMissedCheckout ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold border bg-rose-50 text-rose-700 border-rose-200">
                          Tidak Check-out (Batas Waktu Berakhir)
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900">{act?.activity_name}</h3>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {act?.activity_location}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Jadwal: {formatDateTimeWITA(act?.start_at)}
                      </span>
                    </div>

                    {/* Rincian Waktu Hadir */}
                    {(isCheckedIn || isCheckedOut) && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap gap-4 text-xs font-mono text-slate-600">
                        {isCheckedIn && (
                          <span className="text-emerald-700 font-semibold">
                            Masuk: {formatTimeWITA(att?.check_in_at)}
                          </span>
                        )}
                        {isCheckedOut ? (
                          <span className="text-teal-700 font-semibold">
                            Pulang: {formatTimeWITA(att?.check_out_at)}
                          </span>
                        ) : isMissedCheckout ? (
                          <span className="text-rose-600 font-medium">
                            Pulang: Tidak tercatat presensi keluar
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi Mandiri */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {!isCheckedIn ? (
                      <button
                        onClick={() => {
                          setActiveScanAction('check_in');
                          setIsCameraOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Scan Kamera</span>
                      </button>
                    ) : !isCheckedOut ? (
                      isMissedCheckout ? (
                        <button
                          onClick={() => {
                            setSelectedAssignmentId(item.id);
                            setClaimedTime(new Date().toISOString().slice(0, 16));
                            setIsManualModalOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          title="Batas waktu check-out telah berakhir. Ajukan presensi manual jika Anda hadir sampai kegiatan selesai."
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Ajukan Pulang Manual</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveScanAction('check_out');
                            setIsCameraOpen(true);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Check-out Kamera</span>
                        </button>
                      )
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Presensi Lengkap</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* RIWAYAT PENGAJUAN PRESENSI MANUAL & MANAJEMEN CRUD */}
      {/* ============================================================================== */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              Riwayat Pengajuan Presensi Manual Anda
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau status verifikasi, ubah catatan, atau batalkan permohonan yang masih ditinjau.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {manualRequests.length} Pengajuan
          </span>
        </div>

        {loadingManual ? (
          <div className="space-y-3 animate-fade-in">
            {[1, 2].map((i) => (
              <div key={i} className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex justify-between">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : manualRequests.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Belum ada permohonan presensi manual yang diajukan.
          </div>
        ) : (
          <div className="space-y-3">
            {manualRequests.map((req) => (
              <div 
                key={req.id}
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      {req.activity_assignment?.activity?.activity_name || 'Agenda Kegiatan'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Waktu Hadir: {formatDateTimeWITA(req.claimed_event_time)} • Tipe: {req.attendance_type === 'check_in' ? 'Check-in' : req.attendance_type === 'check_out' ? 'Check-out' : 'Keduanya'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                      req.review_status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      req.review_status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {req.review_status === 'approved' ? 'Disetujui' :
                       req.review_status === 'rejected' ? 'Ditolak' : 'Menunggu Review'}
                    </span>

                    {/* Jika masih pending, pembuat bisa Edit atau Batalkan/Hapus */}
                    {req.review_status === 'pending' && (
                      <div className="flex items-center gap-1.5 ml-1">
                        <button
                          onClick={() => openEditManualModal(req)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Edit Pengajuan"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => openDeleteManualModal(req)}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Batalkan Pengajuan"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Batalkan</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                  <span className="font-semibold text-slate-800">Alasan: </span>
                  {req.reason}
                </div>

                {req.review_note && (
                  <div className="text-xs text-emerald-800 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
                    <span className="font-semibold text-emerald-900">Catatan Koordinator: </span>
                    {req.review_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* MODAL: AJUKAN PRESENSI MANUAL */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Form Pengajuan Presensi Manual"
        description="Gunakan formulir ini jika Anda mengalami kendala kamera atau kendala jaringan di lokasi acara."
      >
        <form onSubmit={handleSubmitManualRequest} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pilih Kegiatan *</label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
            >
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.activity?.activity_code} - {item.activity?.activity_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenis Presensi *</label>
              <select
                value={attendanceType}
                onChange={(e) => setAttendanceType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="check_in">Check-in (Kedatangan)</option>
                <option value="check_out">Check-out (Kepulangan)</option>
                <option value="both">Keduanya (Check-in & Check-out)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Waktu Kehadiran Sebenarnya *</label>
              <input
                type="datetime-local"
                required
                value={claimedTime}
                onChange={(e) => setClaimedTime(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alasan Kendala *</label>
            <textarea
              required
              rows={3}
              placeholder="Contoh: Kamera smartphone blank saat scan di meja registrasi, hadir bertugas di bagian sound system..."
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tautan Bukti Kehadiran (Opsional)</label>
            <input
              type="url"
              placeholder="https://drive.google.com/... (Foto kegiatan / dokumentasi)"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingManual}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {submittingManual ? 'Mengirim...' : 'Kirim Permohonan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT PENGAJUAN MANUAL */}
      <Modal
        isOpen={isEditManualModalOpen}
        onClose={() => setIsEditManualModalOpen(false)}
        title="Edit Permohonan Presensi Manual"
        description="Perbarui waktu kehadiran, alasan, atau tautan bukti dokumentasi."
      >
        <form onSubmit={handleEditManualSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenis Presensi *</label>
              <select
                value={editManualForm.attendanceType}
                onChange={(e) => setEditManualForm({ ...editManualForm, attendanceType: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="check_in">Check-in (Kedatangan)</option>
                <option value="check_out">Check-out (Kepulangan)</option>
                <option value="both">Keduanya (Check-in & Check-out)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Waktu Kehadiran *</label>
              <input
                type="datetime-local"
                required
                value={editManualForm.claimedTime}
                onChange={(e) => setEditManualForm({ ...editManualForm, claimedTime: e.target.value })}
                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alasan Kendala *</label>
            <textarea
              required
              rows={3}
              value={editManualForm.reason}
              onChange={(e) => setEditManualForm({ ...editManualForm, reason: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tautan Bukti Kehadiran</label>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={editManualForm.evidenceUrl}
              onChange={(e) => setEditManualForm({ ...editManualForm, evidenceUrl: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditManualModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updatingManual}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {updatingManual ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: KONFIRMASI HAPUS/BATALKAN PENGAJUAN MANUAL */}
      <Modal
        isOpen={isDeleteManualModalOpen}
        onClose={() => setIsDeleteManualModalOpen(false)}
        title="Batalkan Permohonan Presensi Manual"
        description="Apakah Anda yakin ingin membatalkan dan menghapus permohonan presensi manual ini?"
      >
        <div className="space-y-4 text-xs">
          {selectedManualForDelete && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
              <span className="font-bold block">
                {selectedManualForDelete.activity_assignment?.activity?.activity_name || 'Agenda'}
              </span>
              <p className="italic text-rose-700">"{selectedManualForDelete.reason}"</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={deletingManual}
              onClick={() => setIsDeleteManualModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deletingManual}
              onClick={handleDeleteManualSubmit}
              className="px-4 py-2 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm shadow-rose-600/20"
            >
              {deletingManual ? 'Membatalkan...' : 'Ya, Batalkan Permohonan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
