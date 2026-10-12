'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  QrCode, 
  Users, 
  MapPin, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  UserPlus, 
  RefreshCw,
  Maximize2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { Activity, ActivityAssignment, Profile, AttendanceSession } from '@/lib/types';
import { formatDateTimeWITA, formatTimeWITA } from '@/lib/utils';

export default function ActivityDetailPage() {
  const params = useParams();
  const activityId = params.id as string;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [assignments, setAssignments] = useState<ActivityAssignment[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrFullscreen, setIsQrFullscreen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignType, setAssignType] = useState('attendance_required');
  const [assignDescription, setAssignDescription] = useState('');
  const [assigning, setAssigning] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (activityId) {
      loadData();
    }
  }, [activityId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Ambil detail kegiatan
      const { data: act } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();
      if (act) setActivity(act);

      // 2. Ambil sesi presensi
      const { data: sess } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });

      if (sess && sess.length > 0) {
        setSessions(sess);
        const openSess = sess.find(s => s.session_status === 'open') || sess[0];
        setActiveSession(openSess);
        generateQrCode(openSess.session_code);
      } else if (act) {
        // Fallback generate default code
        generateQrCode(`${act.activity_code}-MAIN`);
      }

      // 3. Ambil daftar penugasan dan presensi panitia
      const { data: assigns } = await supabase
        .from('activity_assignments')
        .select('*, member:profiles(*), attendance:attendances(*)')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });
      if (assigns) setAssignments(assigns as any);

      // 4. Ambil anggota yang belum ditugaskan untuk dropdown assign
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_status', 'active');

      if (allProfiles && assigns) {
        const assignedIds = new Set(assigns.map(a => a.member_id));
        setUnassignedMembers(allProfiles.filter(p => !assignedIds.has(p.id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateQrCode = async (code: string) => {
    try {
      const qrPayload = JSON.stringify({
        activityId,
        sessionCode: code,
        timestamp: Date.now(),
      });
      const url = await QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setAssigning(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Harap login');

      const { error } = await supabase.from('activity_assignments').insert({
        activity_id: activityId,
        member_id: selectedMemberId,
        assignment_type: assignType,
        assignment_description: assignDescription.trim() || null,
        assignment_status: 'active',
        assigned_by: user.id,
      });

      if (error) throw error;

      setIsAssignModalOpen(false);
      setSelectedMemberId('');
      setAssignDescription('');
      loadData();
    } catch (err: any) {
      alert('Gagal menugaskan anggota: ' + err.message);
    } finally {
      setAssigning(false);
    }
  };

  if (loading && !activity) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-genre-500 border-t-transparent rounded-full animate-spin" />
        <span>Memuat detail kegiatan dan sesi QR...</span>
      </div>
    );
  }

  if (!activity) {
    return (
      <Card className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white">Kegiatan Tidak Ditemukan</h3>
        <Link href="/dashboard/activities" className="mt-3 inline-block text-xs text-genre-400">
          ← Kembali ke Agenda
        </Link>
      </Card>
    );
  }

  const totalAssigned = assignments.length;
  const totalCheckedIn = assignments.filter(a => a.attendance?.check_in_at).length;
  const totalOnTime = assignments.filter(a => a.attendance?.check_in_status === 'on_time').length;
  const totalLate = assignments.filter(a => a.attendance?.check_in_status === 'late').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/activities"
            className="text-xs text-slate-400 hover:text-genre-300 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Daftar Agenda</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-genre-400 px-2 py-0.5 rounded bg-genre-500/10 border border-genre-500/20">
              {activity.activity_code}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{activity.activity_name}</h1>
            <Badge status={activity.activity_status} />
          </div>
        </div>

        <button
          onClick={() => setIsAssignModalOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-genre-600 hover:bg-genre-500 transition-colors shadow-lg shadow-genre-500/20 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tugaskan Panitia</span>
        </button>
      </div>

      {/* Main Grid: QR Card & Live Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: QR Code Station */}
        <Card
          title="Stasiun QR Code Presensi"
          subtitle="Tampilkan di layar proyektor atau tablet meja registrasi"
          className="lg:col-span-1 flex flex-col items-center text-center"
        >
          <div className="w-full flex justify-end mb-2">
            <button
              onClick={() => setIsQrFullscreen(true)}
              className="p-1.5 text-xs text-slate-400 hover:text-white rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-1"
              title="Layar Penuh"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Screen</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-white shadow-2xl inline-block border-4 border-teal-500/40">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code Presensi" className="w-60 h-60 object-contain" />
            ) : (
              <div className="w-60 h-60 flex items-center justify-center text-slate-500 text-xs">
                Membuat QR Code...
              </div>
            )}
          </div>

          <div className="mt-4 w-full text-left space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Kode Sesi:</span>
              <span className="font-mono font-bold text-genre-300">{activeSession?.session_code || `${activity.activity_code}-MAIN`}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Jendela On-Time:</span>
              <span className="font-medium text-slate-200">{formatTimeWITA(activity.check_in_opens_at)} - {formatTimeWITA(activity.check_in_closes_at)}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Live Attendance Monitor */}
        <Card
          title="Pemantau Presensi Panitia"
          subtitle={`${totalCheckedIn} dari ${totalAssigned} panitia telah check-in (${totalOnTime} Tepat Waktu, ${totalLate} Terlambat)`}
          className="lg:col-span-2"
        >
          {assignments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Belum ada panitia yang ditugaskan pada agenda ini. Klik tombol "Tugaskan Panitia" di atas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3">Panitia</th>
                    <th className="py-2.5 px-3">Peran Mandat</th>
                    <th className="py-2.5 px-3">Status Check-in</th>
                    <th className="py-2.5 px-3">Waktu Masuk</th>
                    <th className="py-2.5 px-3">Waktu Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {assignments.map((item) => {
                    const att = item.attendance;
                    return (
                      <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-white block">{item.member?.full_name}</span>
                          <span className="text-[11px] font-mono text-genre-400 block">{item.member?.member_code}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-300 capitalize">{item.assignment_type.replace(/_/g, ' ')}</span>
                          {item.assignment_description && (
                            <span className="text-[10px] text-slate-500 block truncate max-w-xs">{item.assignment_description}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {att?.check_in_at ? (
                            <Badge status={att.check_in_status} />
                          ) : (
                            <span className="text-amber-400 text-xs font-medium">Belum Check-in</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {att?.check_in_at ? formatTimeWITA(att.check_in_at) : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {att?.check_out_at ? formatTimeWITA(att.check_out_at) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Fullscreen QR Modal */}
      {isQrFullscreen && (
        <div className="fixed inset-0 z-50 bg-navy-950 flex flex-col items-center justify-center p-6 animate-fade-in">
          <button
            onClick={() => setIsQrFullscreen(false)}
            className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700"
          >
            Tutup Layar Penuh (ESC)
          </button>

          <div className="text-center mb-6">
            <span className="text-sm font-mono font-bold text-genre-400 uppercase tracking-widest">{activity.activity_code}</span>
            <h2 className="text-3xl font-extrabold text-white mt-1">{activity.activity_name}</h2>
            <p className="text-sm text-slate-400 mt-1">Pindai QR Code untuk Check-in Presensi Panitia</p>
          </div>

          <div className="p-8 rounded-3xl bg-white shadow-2xl border-8 border-genre-500">
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code Fullscreen" className="w-96 h-96 object-contain" />}
          </div>

          <div className="mt-6 flex items-center gap-6 text-xs text-slate-400 font-mono">
            <span>Toleransi On-Time: {formatTimeWITA(activity.check_in_closes_at)}</span>
            <span>•</span>
            <span>Zona Waktu: Asia/Makassar (WITA)</span>
          </div>
        </div>
      )}

      {/* Modal Tugaskan Panitia */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Tugaskan Panitia ke Kegiatan"
        description="Surat mandat penugasan ini menjadi dasar hak dan kewajiban presensi panitia."
      >
        <form onSubmit={handleAssignMember} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Pilih Panitia *</label>
            <select
              required
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              <option value="">-- Pilih Anggota Panitia --</option>
              {unassignedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.member_code}) - {m.organization_position}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tipe Mandat Penugasan *</label>
            <select
              value={assignType}
              onChange={(e) => setAssignType(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              <option value="attendance_required">Wajib Hadir (attendance_required)</option>
              <option value="work_assignment">Tugas Kerja Khusus (work_assignment)</option>
              <option value="coordinator_duty">Tugas Koordinator (coordinator_duty)</option>
              <option value="committee_support">Dukungan Operasional (committee_support)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Deskripsi / Peran Lapangan</label>
            <textarea
              rows={2}
              placeholder="Contoh: Timekeeper sesi materi dan pendamping juri workshop"
              value={assignDescription}
              onChange={(e) => setAssignDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={assigning || !selectedMemberId}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-genre-600 hover:bg-genre-500 disabled:opacity-50"
            >
              {assigning ? 'Menyimpan...' : 'Tugaskan Panitia'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
