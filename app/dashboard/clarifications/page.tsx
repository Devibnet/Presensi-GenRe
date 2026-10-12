'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  HelpCircle, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  User, 
  Send, 
  ShieldCheck, 
  MessageSquare,
  Building,
  Check,
  X
} from 'lucide-react';
import { ClarificationRequest, Profile, Activity, ClarificationRequestType, ClarificationStatus } from '@/lib/types';
import { formatDateTimeWITA, getStatusBadgeClass } from '@/lib/utils';

export default function ClarificationsPage() {
  const [clarifications, setClarifications] = useState<ClarificationRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal Ajukan Sanggahan (Member)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<ClarificationRequestType>('attendance_dispute');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal Tanggapi / Resolusi (Admin/Coordinator)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [activeClarification, setActiveClarification] = useState<ClarificationRequest | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Current user
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
        }
      }

      // 2. Fetch Clarifications
      let query = supabase
        .from('clarification_requests')
        .select(`
          *,
          member:profiles(
            *,
            field:fields(*)
          )
        `)
        .order('created_at', { ascending: false });

      // Jika anggota biasa, hanya tampilkan sanggahan miliknya
      if (currentProf && currentProf.system_role === 'member') {
        query = query.eq('member_id', currentProf.id);
      }

      const { data: clarData, error: clarErr } = await query;

      if (!clarErr && clarData && clarData.length > 0) {
        setClarifications(clarData as any);
      } else {
        setClarifications(getFallbackClarifications(currentProf?.id || ''));
      }

      // 3. Fetch Activities for dropdown
      const { data: actData } = await supabase.from('activities').select('*').order('start_at', { ascending: false });
      if (actData) setActivities(actData);
    } catch (err) {
      console.error(err);
      setClarifications(getFallbackClarifications(''));
    } finally {
      setLoading(false);
    }
  };

  // Submit Sanggahan Baru
  const handleSubmitClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      // Dapatkan active period
      const { data: periodData } = await supabase
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .single();
      const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

      const { error } = await supabase.from('clarification_requests').insert({
        period_id: periodId,
        member_id: currentUser?.id || '00000000-0000-0000-0000-000000000001',
        request_type: requestType,
        related_activity_id: selectedActivityId || null,
        request_description: description,
        request_status: 'submitted',
      });

      if (error) throw error;

      alert('Sanggahan berhasil diajukan! Koordinator dan BPH akan meninjau dalam 1x24 jam.');
      setIsSubmitModalOpen(false);
      setDescription('');
      setSelectedActivityId('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengajukan sanggahan: ' + (err.message || 'Periksa koneksi Supabase.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Resolusi Sanggahan (Admin/Coordinator)
  const handleResolveClarification = async (status: 'resolved' | 'rejected') => {
    if (!activeClarification) return;
    if (!resolutionNote.trim()) {
      alert('Mohon cantumkan catatan penjelasan atau putusan atas sanggahan ini.');
      return;
    }

    setResolving(true);
    try {
      const { error } = await supabase
        .from('clarification_requests')
        .update({
          request_status: status,
          resolution_note: resolutionNote,
          resolved_by: currentUser?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', activeClarification.id);

      if (error) throw error;

      alert(status === 'resolved' ? 'Sanggahan diterima dan diselesaikan!' : 'Sanggahan ditolak dengan penjelasan resmi.');
      setIsResolveModalOpen(false);
      setResolutionNote('');
      fetchData();
    } catch (err: any) {
      alert('Gagal menyelesaikan sanggahan: ' + err.message);
    } finally {
      setResolving(false);
    }
  };

  const isCoordinatorOrAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'coordinator';

  // Label permohonan
  const getTypeLabel = (t: ClarificationRequestType) => {
    switch (t) {
      case 'attendance_dispute': return 'Sanggahan Presensi';
      case 'task_dispute': return 'Sanggahan Tugas';
      case 'evaluation_dispute': return 'Sanggahan Nilai Evaluasi';
      default: return 'Pertanyaan Umum';
    }
  };

  const getTypeBadgeClass = (t: ClarificationRequestType) => {
    switch (t) {
      case 'attendance_dispute': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'task_dispute': return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
      case 'evaluation_dispute': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
    }
  };

  // Filter
  const filteredClarifications = clarifications.filter(c => {
    const memberName = c.member?.full_name?.toLowerCase() || '';
    const desc = c.request_description.toLowerCase();
    const matchSearch = memberName.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.request_status === statusFilter;
    const matchType = typeFilter === 'all' || c.request_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-brand-400" />
            Layanan Sanggahan & Klarifikasi Panitia
          </h1>
          <p className="text-sm text-slate-400">
            Kanal transparansi resmi untuk menyanggah status kehadiran, kendala presensi QR, penugasan, atau permohonan peninjauan nilai evaluasi.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-brand-500/20 transition-all text-sm"
        >
          <Plus className="h-4 w-4" />
          Ajukan Sanggahan Baru
        </button>
      </div>

      {/* FILTER & SEARCH */}
      <Card className="p-4 bg-navy-900/60 border-slate-800">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari isi sanggahan, nama panitia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-navy-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-navy-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">Semua Jenis</option>
              <option value="attendance_dispute">Sanggahan Presensi</option>
              <option value="task_dispute">Sanggahan Tugas</option>
              <option value="evaluation_dispute">Sanggahan Nilai Evaluasi</option>
              <option value="general_inquiry">Pertanyaan Umum</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-navy-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">Semua Status</option>
              <option value="submitted">Menunggu Review</option>
              <option value="under_review">Sedang Ditinjau</option>
              <option value="resolved">Diterima / Selesai</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>
      </Card>

      {/* LIST SANGGAHAN */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-32 bg-slate-900/40 rounded-2xl border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredClarifications.length === 0 ? (
        <Card className="p-12 text-center bg-navy-900/40 border-slate-800">
          <ShieldCheck className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Belum Ada Sanggahan Aktif</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Seluruh data presensi dan evaluasi panitia berjalan lancar tanpa ada sengketa data.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredClarifications.map((item) => (
            <Card 
              key={item.id} 
              className="p-5 bg-navy-900/60 border-slate-800/80 hover:border-slate-700 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Top Bar Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${getTypeBadgeClass(item.request_type)}`}>
                      {getTypeLabel(item.request_type)}
                    </span>

                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getStatusBadgeClass(item.request_status)}`}>
                      {item.request_status === 'resolved' ? 'Selesai / Diterima' :
                       item.request_status === 'rejected' ? 'Ditolak' :
                       item.request_status === 'under_review' ? 'Sedang Ditinjau' : 'Menunggu Review'}
                    </span>

                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      Diajukan: {formatDateTimeWITA(item.created_at)}
                    </span>
                  </div>

                  {/* Pengaju */}
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <User className="h-3.5 w-3.5 text-brand-400" />
                    <span className="font-semibold text-white">{item.member?.full_name || 'Anggota Panitia'}</span>
                    <span className="text-slate-400">({item.member?.member_code} • {item.member?.field?.field_name || 'Umum'})</span>
                  </div>

                  {/* Isi Sanggahan */}
                  <p className="text-xs text-slate-200 leading-relaxed bg-navy-950/60 p-3 rounded-xl border border-slate-800/60">
                    {item.request_description}
                  </p>

                  {/* Resolusi / Catatan Peninjau jika sudah direspons */}
                  {item.resolution_note && (
                    <div className="mt-2 text-xs bg-slate-800/40 border border-slate-700/60 p-3 rounded-xl">
                      <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        Putusan & Catatan Resmi Tim Peninjau:
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {item.resolution_note}
                      </p>
                      {item.resolved_at && (
                        <span className="text-[10px] text-slate-400 block mt-1.5">
                          Diselesaikan pada {formatDateTimeWITA(item.resolved_at)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Button untuk Coordinator / Admin */}
                {isCoordinatorOrAdmin && item.request_status !== 'resolved' && (
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setActiveClarification(item);
                        setResolutionNote(item.resolution_note || '');
                        setIsResolveModalOpen(true);
                      }}
                      className="text-xs bg-brand-600 hover:bg-brand-500 text-white font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
                    >
                      Tanggapi Sanggahan
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL: Ajukan Sanggahan Baru (Member) */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Form Pengajuan Sanggahan & Klarifikasi"
        description="Sampaikan kendala presensi teknis atau keberatan atas rekapitulasi poin kegiatan dengan bukti valid."
      >
        <form onSubmit={handleSubmitClarification} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Jenis Klarifikasi / Sanggahan <span className="text-rose-400">*</span>
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as ClarificationRequestType)}
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="attendance_dispute">Sanggahan Presensi (Kendala scan QR / Status Alpa)</option>
              <option value="task_dispute">Sanggahan Tugas (Hasil kerja belum dinilai)</option>
              <option value="evaluation_dispute">Sanggahan Nilai Evaluasi Koordinator</option>
              <option value="general_inquiry">Pertanyaan & Konsultasi Umum Organisasi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Agenda Kegiatan Terkait (Opsional)
            </label>
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">Tidak Terkait Agenda Tertentu</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>{a.activity_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Rincian Alasan, Kronologi, & Tautan Bukti <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan secara lengkap kendala yang dialami. Sertakan tautan foto/dokumen pendukung (misal Google Drive)..."
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-xl disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Mengirim...' : 'Kirimkan Sanggahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Tanggapi Sanggahan (Admin/Coordinator) */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Tinjau & Tanggapi Sanggahan Panitia"
        description={`Pengaju: ${activeClarification?.member?.full_name} (${activeClarification?.member?.member_code})`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-navy-950 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 block mb-1 font-medium">Uraian Sanggahan Anggota:</span>
            <p className="text-slate-200 leading-relaxed">
              {activeClarification?.request_description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Catatan Putusan / Tanggapan Resmi <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Tuliskan putusan hasil investigasi dan arahan perbaikan data..."
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolveClarification('rejected')}
              className="px-4 py-2 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl transition-colors"
            >
              Tolak Sanggahan
            </button>
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolveClarification('resolved')}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
            >
              {resolving ? 'Menyimpan...' : 'Terima & Selesaikan Sanggahan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Fallback Mock Data
function getFallbackClarifications(currentUserId: string): ClarificationRequest[] {
  return [
    {
      id: 'clar-1',
      period_id: 'p-1',
      member_id: currentUserId || 'mem-4',
      request_type: 'attendance_dispute',
      request_description: 'Saat Gladi Bersih tanggal 17 Oktober, kamera HP saya blank saat scan QR di pintu masuk. Saya sudah melapor ke panitia meja dan hadir penuh hingga selesai pukul 21:00 WITA. Mohon status alpa dapat dikoreksi menjadi hadir.',
      request_status: 'submitted',
      created_at: '2026-10-18T08:30:00+08:00',
      updated_at: '',
      member: {
        id: currentUserId || 'mem-4',
        member_code: 'GENRE-007',
        full_name: 'Ketut Agus Mahendra',
        email: 'agus.mahendra@genre.org',
        organization_position: 'Staff Keamanan',
        system_role: 'member',
        account_status: 'active',
        joined_at: '',
        created_at: '',
        updated_at: '',
        field: {
          id: 'f-4',
          period_id: 'p-1',
          field_name: 'Bidang Keamanan & Ketertiban',
          field_code: 'SECURITY',
          field_status: 'active',
          created_at: '',
          updated_at: '',
        },
      },
    },
    {
      id: 'clar-2',
      period_id: 'p-1',
      member_id: 'mem-3',
      request_type: 'task_dispute',
      request_description: 'Berkas master materi presentasi dewan juri sudah saya serahkan via Google Drive tanggal 16 Oktober, namun status tugas masih belum tercentang selesai.',
      request_status: 'resolved',
      resolution_note: 'Sudah dicek dan diverifikasi oleh Koordinator Bidang Acara. Status tugas telah diubah menjadi Tuntas 100%.',
      resolved_at: '2026-10-17T11:00:00+08:00',
      created_at: '2026-10-16T19:00:00+08:00',
      updated_at: '',
      member: {
        id: 'mem-3',
        member_code: 'GENRE-004',
        full_name: 'Wayan Eka Putra',
        email: 'wayan.eka@genre.org',
        organization_position: 'Staff Perlengkapan',
        system_role: 'member',
        account_status: 'active',
        joined_at: '',
        created_at: '',
        updated_at: '',
        field: {
          id: 'f-3',
          period_id: 'p-1',
          field_name: 'Bidang Perlengkapan & Logistik',
          field_code: 'LOGISTIK',
          field_status: 'active',
          created_at: '',
          updated_at: '',
        },
      },
    },
  ];
}
