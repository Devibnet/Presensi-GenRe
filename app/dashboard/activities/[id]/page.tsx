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
  AlertCircle,
  Building,
  CheckSquare,
  Square,
  Search,
  Filter,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react';
import QRCode from 'qrcode';
import { Activity, ActivityAssignment, Profile, AttendanceSession, Field } from '@/lib/types';
import { formatDateTimeWITA, formatTimeWITA, getStatusBadgeClass } from '@/lib/utils';

export default function ActivityDetailPage() {
  const params = useParams();
  const activityId = params.id as string;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [assignments, setAssignments] = useState<ActivityAssignment[]>([]);
  const [allActiveMembers, setAllActiveMembers] = useState<Profile[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // QR Code State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrFullscreen, setIsQrFullscreen] = useState(false);

  // Filter Table State
  const [tableFieldFilter, setTableFieldFilter] = useState<string>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  // Modal Assign State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalFieldFilter, setAssignModalFieldFilter] = useState<string>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
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
      // 1. Ambil user saat ini & profilnya
      const { data: { user } } = await supabase.auth.getUser();
      let currentProf: Profile | null = null;
      if (user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*, field:fields(*)')
          .eq('id', user.id)
          .single();
        if (p) {
          currentProf = p as any;
          setCurrentUser(currentProf);
          // Jika koordinator, default filter ke divisinya sendiri
          if (currentProf?.system_role === 'coordinator' && currentProf.field_id) {
            setTableFieldFilter(currentProf.field_id);
            setAssignModalFieldFilter(currentProf.field_id);
          }
        }
      }

      // 2. Ambil detail kegiatan
      const { data: act } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .single();
      if (act) setActivity(act);

      // 3. Ambil sesi presensi
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
        generateQrCode(`${act.activity_code}-MAIN`);
      }

      // 4. Ambil daftar bidang/divisi
      const { data: fData } = await supabase.from('fields').select('*').order('field_name');
      if (fData) setFields(fData);

      // 5. Ambil daftar penugasan dan presensi panitia
      const { data: assigns } = await supabase
        .from('activity_assignments')
        .select(`
          *,
          member:profiles(
            *,
            field:fields(*)
          ),
          attendance:attendances(*)
        `)
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });
      if (assigns) setAssignments(assigns as any);

      // 6. Ambil seluruh anggota panitia aktif
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*, field:fields(*)')
        .eq('account_status', 'active')
        .order('full_name');
      if (allProfiles) setAllActiveMembers(allProfiles as any);
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

  // Anggota yang belum ditugaskan pada agenda ini
  const assignedMemberIdSet = new Set(assignments.map(a => a.member_id));
  const unassignedMembers = allActiveMembers.filter(m => !assignedMemberIdSet.has(m.id));

  // Anggota unassigned yang sesuai filter di modal
  const isCoordinator = currentUser?.system_role === 'coordinator';
  const effectiveModalFieldId = isCoordinator && currentUser?.field_id ? currentUser.field_id : assignModalFieldFilter;

  const filteredUnassignedMembers = unassignedMembers.filter(m => {
    if (effectiveModalFieldId === 'all') return true;
    return m.field_id === effectiveModalFieldId;
  });

  // Toggle checklist anggota
  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  // Pilih Semua Anggota yang Tampil
  const handleSelectAllVisible = () => {
    const visibleIds = filteredUnassignedMembers.map(m => m.id);
    const allSelected = visibleIds.every(id => selectedMemberIds.includes(id));
    if (allSelected) {
      // Unselect visible
      setSelectedMemberIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Select all visible
      const newSelected = Array.from(new Set([...selectedMemberIds, ...visibleIds]));
      setSelectedMemberIds(newSelected);
    }
  };

  // Eksekusi Penugasan Massal
  const handleBatchAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) {
      alert('Pilih setidaknya 1 anggota panitia untuk ditugaskan.');
      return;
    }

    setAssigning(true);
    try {
      const batchRows = selectedMemberIds.map(mId => ({
        activity_id: activityId,
        member_id: mId,
        assignment_type: assignType,
        assignment_description: assignDescription.trim() || null,
        assignment_status: 'active',
        assigned_by: currentUser?.id || '00000000-0000-0000-0000-000000000001',
      }));

      const { error } = await supabase
        .from('activity_assignments')
        .upsert(batchRows, { onConflict: 'activity_id,member_id' });

      if (error) throw error;

      alert(`Berhasil menugaskan ${selectedMemberIds.length} anggota panitia ke agenda ini!`);
      setIsAssignModalOpen(false);
      setSelectedMemberIds([]);
      setAssignDescription('');
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Gagal menugaskan panitia: ' + (err.message || 'Periksa koneksi Supabase.'));
    } finally {
      setAssigning(false);
    }
  };

  // Hapus Penugasan
  const handleRemoveAssignment = async (assignmentId: string, memberName: string) => {
    if (!confirm(`Batalkan penugasan untuk ${memberName}?`)) return;

    try {
      const { error } = await supabase
        .from('activity_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert('Gagal menghapus penugasan: ' + err.message);
    }
  };

  if (loading && !activity) {
    return (
      <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span>Memuat detail kegiatan dan stasiun presensi QR...</span>
      </div>
    );
  }

  if (!activity) {
    return (
      <Card className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white">Kegiatan Tidak Ditemukan</h3>
        <Link href="/dashboard/activities" className="mt-3 inline-block text-xs text-brand-400">
          ← Kembali ke Agenda Kegiatan
        </Link>
      </Card>
    );
  }

  // Filter tabel penugasan yang tampil
  const filteredAssignments = assignments.filter(a => {
    const matchField = tableFieldFilter === 'all' || a.member?.field_id === tableFieldFilter;
    const name = a.member?.full_name?.toLowerCase() || '';
    const code = a.member?.member_code?.toLowerCase() || '';
    const matchSearch = name.includes(tableSearchQuery.toLowerCase()) || code.includes(tableSearchQuery.toLowerCase());
    return matchField && matchSearch;
  });

  const totalAssigned = assignments.length;
  const totalCheckedIn = assignments.filter(a => a.attendance?.check_in_at).length;
  const totalOnTime = assignments.filter(a => a.attendance?.check_in_status === 'on_time').length;
  const totalLate = assignments.filter(a => a.attendance?.check_in_status === 'late').length;

  const myField = currentUser?.field;
  const canManage = currentUser?.system_role === 'admin' || currentUser?.system_role === 'coordinator';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/activities"
            className="text-xs text-slate-400 hover:text-brand-300 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Daftar Agenda</span>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono font-bold text-brand-400 px-2.5 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
              {activity.activity_code}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{activity.activity_name}</h1>
            <Badge status={activity.activity_status} />
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            {activity.activity_location} • Waktu: {formatDateTimeWITA(activity.start_at)}
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              // Reset selection & buka modal
              setSelectedMemberIds([]);
              setIsAssignModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tugaskan Panitia Kegiatan</span>
          </button>
        )}
      </div>

      {/* Main Grid: QR Card & Live Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: QR Code Station */}
        <Card
          title="Stasiun QR Code Presensi"
          subtitle="Tampilkan di layar proyektor atau tablet meja registrasi"
          className="lg:col-span-1 flex flex-col items-center text-center p-5 bg-navy-900/60 border-slate-800"
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

          <div className="p-4 rounded-2xl bg-white shadow-2xl inline-block border-4 border-brand-500/40">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code Presensi" className="w-56 h-56 object-contain" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-500 text-xs">
                Membuat QR Code...
              </div>
            )}
          </div>

          <div className="mt-4 w-full text-left space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-navy-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Kode Sesi:</span>
              <span className="font-mono font-bold text-brand-300">{activeSession?.session_code || `${activity.activity_code}-MAIN`}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-navy-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Jendela On-Time:</span>
              <span className="font-medium text-slate-200">{formatTimeWITA(activity.check_in_opens_at)} - {formatTimeWITA(activity.check_in_closes_at)}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Live Attendance Monitor */}
        <Card
          title="Pemantau Presensi Panitia"
          subtitle={`${totalCheckedIn} dari ${totalAssigned} panitia telah hadir (${totalOnTime} Tepat Waktu, ${totalLate} Terlambat)`}
          className="lg:col-span-2 bg-navy-900/60 border-slate-800"
        >
          {/* Filter Bar Tabel */}
          <div className="flex flex-col sm:flex-row gap-2.5 mb-4 pb-4 border-b border-slate-800/80">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau nomor anggota..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={tableFieldFilter}
                onChange={(e) => setTableFieldFilter(e.target.value)}
                className="bg-navy-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">Semua Divisi / Sie ({assignments.length})</option>
                {fields.map(f => {
                  const countInField = assignments.filter(a => a.member?.field_id === f.id).length;
                  return (
                    <option key={f.id} value={f.id}>
                      {f.field_name} ({countInField})
                    </option>
                  );
                })}
              </select>

              {isCoordinator && myField && (
                <button
                  type="button"
                  onClick={() => setTableFieldFilter(myField.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    tableFieldFilter === myField.id 
                      ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' 
                      : 'bg-navy-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Divisi Saya Saja
                </button>
              )}
            </div>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              {assignments.length === 0 ? (
                <>Belum ada panitia yang ditugaskan pada agenda ini. Klik tombol <strong>"Tugaskan Panitia Kegiatan"</strong> di atas.</>
              ) : (
                <>Tidak ada panitia yang cocok dengan filter divisi atau pencarian.</>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3">Panitia</th>
                    <th className="py-2.5 px-3">Divisi / Posisi</th>
                    <th className="py-2.5 px-3">Status Hadir</th>
                    <th className="py-2.5 px-3">Masuk</th>
                    <th className="py-2.5 px-3">Pulang</th>
                    {canManage && <th className="py-2.5 px-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredAssignments.map((item) => {
                    const att = item.attendance;
                    return (
                      <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-white block">{item.member?.full_name}</span>
                          <span className="text-[10px] font-mono text-brand-400 block">{item.member?.member_code}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-slate-200 block">{item.member?.field?.field_name || 'Umum'}</span>
                          <span className="text-[10px] text-slate-400 block">{item.member?.organization_position}</span>
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
                        {canManage && (
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleRemoveAssignment(item.id, item.member?.full_name || 'Panitia')}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                              title="Batalkan Penugasan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
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
            <span className="text-sm font-mono font-bold text-brand-400 uppercase tracking-widest">{activity.activity_code}</span>
            <h2 className="text-3xl font-extrabold text-white mt-1">{activity.activity_name}</h2>
            <p className="text-sm text-slate-400 mt-1">Pindai QR Code untuk Check-in Presensi Panitia</p>
          </div>

          <div className="p-8 rounded-3xl bg-white shadow-2xl border-8 border-brand-500">
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code Fullscreen" className="w-96 h-96 object-contain" />}
          </div>

          <div className="mt-6 flex items-center gap-6 text-xs text-slate-400 font-mono">
            <span>Toleransi On-Time: {formatTimeWITA(activity.check_in_closes_at)}</span>
            <span>•</span>
            <span>Zona Waktu: Asia/Makassar (WITA)</span>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: TUGASKAN PANITIA (DENGAN FILTER SIE & FITUR PILIH SEMUA) */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Tugaskan Panitia ke Kegiatan"
        description="Pilih anggota yang diwajibkan hadir pada agenda ini. Mendukung pemilihan per sie atau pilih semua sekaligus."
      >
        <form onSubmit={handleBatchAssign} className="space-y-4 text-xs">
          {/* Notice Khusus Koordinator */}
          {isCoordinator && myField ? (
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-brand-400" />
              <span>
                <strong>Mode Koordinator:</strong> Anda ditugaskan mengelola <strong>{myField.field_name}</strong>. Menampilkan anggota divisi Anda agar tidak tertukar.
              </span>
            </div>
          ) : (
            /* Filter Divisi untuk Admin */
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Filter Divisi / Sie Panitia</label>
              <select
                value={assignModalFieldFilter}
                onChange={(e) => setAssignModalFieldFilter(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
              >
                <option value="all">Semua Divisi (Seluruh Panitia Organisasi)</option>
                {fields.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.field_name} ({f.field_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Checklist Anggota dengan Tombol Pilih Semua */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-300">
                Daftar Anggota yang Dapat Ditugaskan ({filteredUnassignedMembers.length} Tersedia, {selectedMemberIds.length} Dipilih)
              </label>

              {filteredUnassignedMembers.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {filteredUnassignedMembers.every(m => selectedMemberIds.includes(m.id))
                    ? 'Batal Pilih Semua'
                    : isCoordinator
                    ? `Pilih Semua Anggota ${myField?.field_code || 'Sie'}`
                    : 'Pilih Semua Anggota'}
                </button>
              )}
            </div>

            {filteredUnassignedMembers.length === 0 ? (
              <div className="p-6 bg-navy-950 border border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                {isCoordinator ? (
                  <>Seluruh anggota divisi Anda ({myField?.field_name}) sudah ditugaskan pada agenda ini.</>
                ) : (
                  <>Seluruh anggota panitia di kategori ini sudah ditugaskan pada agenda ini.</>
                )}
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 bg-navy-950 border border-slate-800 rounded-xl">
                {filteredUnassignedMembers.map((m) => {
                  const isChecked = selectedMemberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isChecked 
                          ? 'bg-brand-500/15 border border-brand-500/30 text-white' 
                          : 'hover:bg-slate-800/50 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberSelection(m.id)}
                          className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <div>
                          <span className="font-semibold block">{m.full_name}</span>
                          <span className="text-[10px] text-slate-400">
                            {m.member_code} • {m.organization_position}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {m.field?.field_code || 'UMUM'}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tipe Penugasan */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tipe Mandat Penugasan *</label>
            <select
              value={assignType}
              onChange={(e) => setAssignType(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
            >
              <option value="attendance_required">Wajib Hadir (attendance_required) - Menjadi Syarat Nilai</option>
              <option value="work_assignment">Tugas Kerja Khusus (work_assignment)</option>
              <option value="coordinator_duty">Tugas Koordinator (coordinator_duty)</option>
              <option value="committee_support">Dukungan Operasional (committee_support)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Deskripsi / Peran Lapangan (Opsional)</label>
            <textarea
              rows={2}
              placeholder="Contoh: Bertugas menjaga pintu masuk VIP dan mendampingi juri"
              value={assignDescription}
              onChange={(e) => setAssignDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-navy-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={assigning || selectedMemberIds.length === 0}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 disabled:opacity-50 transition-all shadow-md"
            >
              {assigning ? 'Menyimpan...' : `Tugaskan ${selectedMemberIds.length} Panitia`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
