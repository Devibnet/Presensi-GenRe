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
  ShieldCheck
} from 'lucide-react';
import { ActivityAssignment } from '@/lib/types';
import { formatDateTimeWITA, formatTimeWITA } from '@/lib/utils';

export default function AttendancePage() {
  const [assignments, setAssignments] = useState<ActivityAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeScanAction, setActiveScanAction] = useState<'check_in' | 'check_out'>('check_in');

  // Manual Request Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out' | 'both'>('check_in');
  const [claimedTime, setClaimedTime] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchAssignments();
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

  // Callback saat QR Code berhasil dipindai oleh kamera
  const handleQrDecoded = async (decodedText: string) => {
    setSubmittingCode(true);
    setScanMessage(null);

    let activityId: string | undefined = undefined;
    let sessionCode: string | undefined = undefined;

    try {
      // 1. Coba parse JSON payload
      const parsed = JSON.parse(decodedText);
      if (parsed.activityId) activityId = parsed.activityId;
      if (parsed.sessionCode) sessionCode = parsed.sessionCode;
    } catch {
      // 2. Jika bukan JSON, anggap sebagai session code string (misal: ACT-001-MAIN)
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
      if (!res.ok) throw new Error(data.error || 'Gagal memproses presensi QR');

      setScanMessage({ 
        type: 'success', 
        text: `Presensi Berhasil: ${data.message || 'Status kehadiran berhasil dicatat ke sistem!'}` 
      });
      setIsCameraOpen(false);
      fetchAssignments();
    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message });
      setIsCameraOpen(false);
    } finally {
      setSubmittingCode(false);
    }
  };

  // Manual Check-in / Out click from card
  const handleCheckAction = async (activityId: string, actionType: 'check_in' | 'check_out' = 'check_in') => {
    setSubmittingCode(true);
    setScanMessage(null);

    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, actionType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses presensi');

      setScanMessage({ type: 'success', text: data.message });
      fetchAssignments();
    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message });
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
        body: JSON.stringify({ sessionCode: sessionCodeInput.trim().toUpperCase() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kode presensi tidak valid');

      setScanMessage({ type: 'success', text: data.message });
      setSessionCodeInput('');
      fetchAssignments();
    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message });
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
      if (!user) throw new Error('Harap login');

      const { error } = await supabase.from('manual_attendance_requests').insert({
        activity_assignment_id: selectedAssignmentId,
        attendance_type: attendanceType,
        claimed_event_time: new Date(claimedTime).toISOString(),
        reason: manualReason.trim(),
        evidence_url: evidenceUrl.trim() || null,
        requested_by: user.id,
        review_status: 'pending',
      });

      if (error) throw error;

      alert('Permohonan presensi manual berhasil dikirim! Menunggu verifikasi koordinator bidang.');
      setIsManualModalOpen(false);
      setManualReason('');
      setEvidenceUrl('');
      fetchAssignments();
    } catch (err: any) {
      alert('Gagal mengirim pengajuan: ' + err.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <QrCode className="w-6 h-6 text-brand-400" />
          Presensi Mandiri Panitia
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Lakukan check-in dan check-out kegiatan resmi Pemilihan Duta GenRe Kabupaten Buleleng 2026 secara mandiri.
        </p>
      </div>

      {/* Pesan Hasil Scan */}
      {scanMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-3 animate-fade-in ${
            scanMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {scanMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          )}
          <span className="font-semibold">{scanMessage.text}</span>
        </div>
      )}

      {/* ============================================================================== */}
      {/* HERO SECTION: KAMERA SCANNER QR LIVE */}
      {/* ============================================================================== */}
      <Card className="p-6 bg-gradient-to-br from-navy-900 via-navy-950 to-brand-950/40 border-brand-500/30 overflow-hidden">
        {isCameraOpen ? (
          <div>
            <CameraQrScanner
              onScanSuccess={handleQrDecoded}
              onClose={() => setIsCameraOpen(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pemindai Kamera HTML5 Live Active</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Pindai QR Code di Lokasi Kegiatan
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Arahkan kamera smartphone atau webcam laptop Anda ke stasiun QR Code di meja registrasi / layar proyektor untuk mencatat kehadiran secara real-time.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveScanAction('check_in');
                  setIsCameraOpen(true);
                }}
                className="px-6 py-3.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 via-accent-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 transition-all shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2.5 hover:scale-[1.02]"
              >
                <Camera className="w-5 h-5 animate-pulse" />
                <span>Buka Kamera Scan QR</span>
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* ALTERNATIF: INPUT KODE SESI MANUAL */}
      {/* ============================================================================== */}
      <Card
        title="Atau Check-in via Kode Sesi Unik"
        subtitle="Jika kamera ponsel tidak dapat digunakan, masukkan kode yang tertera di bawah QR Code stasiun presensi"
        className="p-5 bg-navy-900/60 border-slate-800"
      >
        <form onSubmit={handleCodeSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Contoh: ACT-001-MAIN atau PLENO1-IN"
              value={sessionCodeInput}
              onChange={(e) => setSessionCodeInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono uppercase focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={submittingCode || !sessionCodeInput}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submittingCode ? 'Memvalidasi...' : 'Check-in Sekarang'}
          </button>
        </form>
      </Card>

      {/* ============================================================================== */}
      {/* DAFTAR KEGIATAN YANG DITUGASKAN KEPADA SAYA */}
      {/* ============================================================================== */}
      <Card
        title="Agenda Kegiatan yang Ditugaskan Kepada Saya"
        subtitle="Surat tugas sah yang mewajibkan presensi Anda dan menjadi dasar perolehan poin sertifikat"
        className="bg-navy-900/60 border-slate-800"
        action={
          <button
            onClick={() => {
              if (assignments.length > 0) {
                setSelectedAssignmentId(assignments[0].id);
                setClaimedTime(new Date().toISOString().slice(0, 16));
                setIsManualModalOpen(true);
              } else {
                alert('Tidak ada penugasan kegiatan yang aktif untuk diajukan manual.');
              }
            }}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ajukan Presensi Manual</span>
          </button>
        }
      >
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span>Memuat penugasan presensi Anda...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Anda belum memiliki surat tugas pada kegiatan aktif saat ini. Hubungi koordinator bidang untuk penugasan.
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((item) => {
              const act = item.activity;
              const att = item.attendance;
              const isCheckedIn = Boolean(att?.check_in_at);
              const isCheckedOut = Boolean(att?.check_out_at);

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-navy-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-5 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
                        {act?.activity_code}
                      </span>
                      {isCheckedIn ? (
                        <Badge status={att?.check_in_status || 'on_time'} />
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                          Belum Hadir
                        </span>
                      )}
                      {isCheckedOut && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-semibold">
                          Sudah Check-Out
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white">{act?.activity_name}</h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {act?.activity_location}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Jadwal: {formatDateTimeWITA(act?.start_at)}
                      </span>
                    </div>

                    {/* Rincian Waktu Hadir */}
                    {(isCheckedIn || isCheckedOut) && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap gap-4 text-xs font-mono text-slate-400">
                        {isCheckedIn && (
                          <span className="text-emerald-400">
                            Masuk: {formatTimeWITA(att?.check_in_at)}
                          </span>
                        )}
                        {isCheckedOut && (
                          <span className="text-teal-400">
                            Pulang: {formatTimeWITA(att?.check_out_at)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi Mandiri */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {!isCheckedIn ? (
                      <button
                        onClick={() => {
                          setActiveScanAction('check_in');
                          setIsCameraOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Scan Kamera</span>
                      </button>
                    ) : !isCheckedOut ? (
                      <button
                        onClick={() => {
                          setActiveScanAction('check_out');
                          setIsCameraOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all shadow-md flex items-center gap-1.5"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Check-out Kamera</span>
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
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
            <label className="block font-semibold text-slate-300 mb-1">Pilih Kegiatan *</label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
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
              <label className="block font-semibold text-slate-300 mb-1">Jenis Presensi *</label>
              <select
                value={attendanceType}
                onChange={(e) => setAttendanceType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
              >
                <option value="check_in">Check-in (Kedatangan)</option>
                <option value="check_out">Check-out (Kepulangan)</option>
                <option value="both">Keduanya (Check-in & Check-out)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Waktu Kehadiran Sebenarnya *</label>
              <input
                type="datetime-local"
                required
                value={claimedTime}
                onChange={(e) => setClaimedTime(e.target.value)}
                className="w-full p-2 rounded-xl bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Alasan Kendala *</label>
            <textarea
              required
              rows={3}
              placeholder="Contoh: Kamera smartphone blank saat scan di meja registrasi, hadir bertugas di bagian sound system..."
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tautan Bukti Kehadiran (Opsional)</label>
            <input
              type="url"
              placeholder="https://drive.google.com/... (Foto kegiatan / dokumentasi)"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingManual}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {submittingManual ? 'Mengirim...' : 'Kirim Permohonan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
