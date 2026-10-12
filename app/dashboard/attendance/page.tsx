'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  QrCode, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Calendar,
  LogOut,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { ActivityAssignment } from '@/lib/types';
import { formatDateTimeWITA, formatTimeWITA } from '@/lib/utils';

export default function AttendancePage() {
  const [assignments, setAssignments] = useState<ActivityAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleManualCheckIn = async (activityId: string, actionType: 'check_in' | 'check_out' = 'check_in') => {
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

      alert('Permohonan presensi manual berhasil dikirim! Menunggu verifikasi koordinator.');
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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Presensi Mandiri Panitia</h1>
        <p className="text-xs text-slate-400 mt-1">
          Lakukan check-in dan check-out kegiatan resmi Pemilihan Duta GenRe Buleleng 2026
        </p>
      </div>

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

      {/* Code Input Card */}
      <Card
        title="Check-in Cepat via Kode Sesi"
        subtitle="Masukkan kode unik yang tertera pada layar proyektor panggung / stasiun QR"
      >
        <form onSubmit={handleCodeSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Contoh: PLENO1-IN atau ACT-WORKSHOP-1-MAIN"
              value={sessionCodeInput}
              onChange={(e) => setSessionCodeInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-genre-400"
            />
          </div>
          <button
            type="submit"
            disabled={submittingCode || !sessionCodeInput}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-genre-600 hover:bg-genre-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submittingCode ? 'Memvalidasi...' : 'Check-in Sekarang'}
          </button>
        </form>
      </Card>

      {/* Assigned Activities Cards */}
      <Card
        title="Kegiatan yang Ditugaskan Kepada Saya"
        subtitle="Daftar surat tugas sah yang mewajibkan presensi Anda"
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
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ajukan Presensi Manual</span>
          </button>
        }
      >
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-genre-500 border-t-transparent rounded-full animate-spin" />
            <span>Memuat penugasan presensi Anda...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Anda belum memiliki surat tugas pada kegiatan aktif saat ini.
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
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-5 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-genre-400 px-2 py-0.5 rounded bg-genre-500/10 border border-genre-500/20">
                        {act?.activity_code}
                      </span>
                      {isCheckedIn ? (
                        <Badge status={att?.check_in_status || 'on_time'} />
                      ) : (
                        <span className="text-xs text-amber-400 font-semibold">Belum Hadir</span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-base">{act?.activity_name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{act?.activity_location}</span>
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span>Jadwal: {formatDateTimeWITA(act?.start_at)}</span>
                      {isCheckedIn && (
                        <span className="text-emerald-400 font-mono">
                          Masuk: {formatTimeWITA(att?.check_in_at)}
                        </span>
                      )}
                      {isCheckedOut && (
                        <span className="text-blue-400 font-mono">
                          Pulang: {formatTimeWITA(att?.check_out_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    {!isCheckedIn ? (
                      <button
                        onClick={() => act && handleManualCheckIn(act.id, 'check_in')}
                        disabled={submittingCode}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-genre-600 hover:bg-genre-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-genre-500/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Check-in Sekarang</span>
                      </button>
                    ) : !isCheckedOut ? (
                      <button
                        onClick={() => act && handleManualCheckIn(act.id, 'check_out')}
                        disabled={submittingCode}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Check-out Pulang</span>
                      </button>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold border border-slate-700">
                        Presensi Selesai
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal Pengajuan Presensi Manual */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Form Pengajuan Presensi Manual"
        description="Gunakan form ini jika Anda mengalami kendala kamera atau kendala jaringan saat berada di lokasi."
      >
        <form onSubmit={handleSubmitManualRequest} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Pilih Penugasan Kegiatan *</label>
            <select
              required
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.activity?.activity_name} ({a.activity?.activity_code})
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
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
              >
                <option value="check_in">Hanya Check-in Masuk</option>
                <option value="check_out">Hanya Check-out Pulang</option>
                <option value="both">Masuk & Pulang Sekaligus</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Waktu Kejadian Diklaim *</label>
              <input
                type="datetime-local"
                required
                value={claimedTime}
                onChange={(e) => setClaimedTime(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Alasan Kendala Teknis / Penugasan Khusus *</label>
            <textarea
              required
              rows={3}
              placeholder="Contoh: Kamera ponsel mengalami blank screen saat memindai QR, hadir di lokasi sejak pukul 13:40 WITA bersama Koordinator Sie Acara."
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Link Bukti Foto / Drive (Opsional)</label>
            <input
              type="url"
              placeholder="https://drive.google.com/file/..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingManual}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-genre-600 hover:bg-genre-500 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submittingManual ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
