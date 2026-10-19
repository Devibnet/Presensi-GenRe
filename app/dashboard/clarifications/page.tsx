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
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { ClarificationRequest, Profile, Activity, ClarificationRequestType, ClarificationStatus } from '@/lib/types';
import { formatDateTimeWITA, getStatusBadgeClass } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';

export default function ClarificationsPage() {
  const { toast } = useToast();
  const [clarifications, setClarifications] = useState<ClarificationRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'my'>('all');

  // Modal Ajukan Sanggahan (Member)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<ClarificationRequestType>('attendance_dispute');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal Edit Sanggahan (Author / Admin / Coordinator)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<ClarificationRequest | null>(null);
  const [editRequestType, setEditRequestType] = useState<ClarificationRequestType>('attendance_dispute');
  const [editActivityId, setEditActivityId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editing, setEditing] = useState(false);

  // Modal Hapus Sanggahan (Author / Admin / Coordinator)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ClarificationRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

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
          .select('*, field:fields!profiles_field_id_fkey(*)')
          .eq('id', user.id)
          .single();
        if (p) {
          currentProf = p as any;
          setCurrentUser(currentProf);
        }
      }

      // 2. Fetch Clarifications
      // Prioritaskan API route /api/clarifications untuk akses data yang konsisten dan terintegrasi
      let loaded = false;
      try {
        const res = await fetch('/api/clarifications');
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            setClarifications(json.data);
            loaded = true;
          }
        }
      } catch (apiErr) {
        console.warn('API /api/clarifications error, falling back to direct client query:', apiErr);
      }

      // Fallback jika API route tidak merespons: direct Supabase query dengan foreign key relasi eksplisit
      if (!loaded) {
        const query = supabase
          .from('clarification_requests')
          .select(`
            *,
            member:profiles!clarification_requests_member_id_fkey(
              *,
              field:fields!profiles_field_id_fkey(*)
            ),
            related_activity:activities(*)
          `)
          .order('created_at', { ascending: false });

        const { data: clarData, error: clarErr } = await query;
        if (!clarErr && clarData) {
          setClarifications(clarData as any);
        } else {
          console.error('Direct clarification query error:', clarErr);
          setClarifications([]);
        }
      }

      // 3. Fetch Activities untuk pilihan dropdown formulir
      const { data: actData } = await supabase
        .from('activities')
        .select('*')
        .order('start_at', { ascending: false });
      if (actData) setActivities(actData);
    } catch (err) {
      console.error('Error fetching clarifications data:', err);
      setClarifications([]);
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

      let memberId = currentUser?.id;
      if (!memberId) {
        const { data: defaultMember } = await supabase
          .from('profiles')
          .select('id')
          .eq('account_status', 'active')
          .limit(1)
          .maybeSingle();
        memberId = defaultMember?.id || '11111111-0000-0000-0000-000000000007';
      }

      let success = false;
      try {
        const res = await fetch('/api/clarifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodId,
            memberId,
            requestType,
            relatedActivityId: selectedActivityId || null,
            description: description.trim(),
          }),
        });
        const result = await res.json();
        if (res.ok && result.success) {
          success = true;
        } else if (!res.ok) {
          throw new Error(result.error || 'Gagal menyimpan sanggahan ke server.');
        }
      } catch (apiErr: any) {
        console.warn('POST /api/clarifications failed, trying direct supabase insert:', apiErr);
      }

      if (!success) {
        const { error } = await supabase.from('clarification_requests').insert({
          period_id: periodId,
          member_id: memberId,
          request_type: requestType,
          related_activity_id: selectedActivityId || null,
          request_description: description.trim(),
          request_status: 'submitted',
        });
        if (error) throw error;
      }

      toast.success(
        'Sanggahan Berhasil Diajukan',
        'Koordinator dan Pimpinan Panitia akan meninjau pengajuan ini dalam 1x24 jam.'
      );
      
      // Kirim notifikasi in-app
      sendInAppNotification({
        title: 'Sanggahan Baru Diajukan',
        message: `${currentUser?.full_name || 'Panitia'} mengajukan sanggahan: "${description.trim().slice(0, 50)}..."`,
        notificationType: 'clarification',
        actionUrl: '/dashboard/clarifications',
        broadcastToAll: true,
      });

      setIsSubmitModalOpen(false);
      setDescription('');
      setSelectedActivityId('');
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Mengajukan Sanggahan', err.message || 'Periksa koneksi database.');
    } finally {
      setSubmitting(false);
    }
  };

  // Resolusi Sanggahan (Admin/Coordinator)
  const handleResolveClarification = async (status: 'resolved' | 'rejected') => {
    if (!activeClarification) return;
    if (!resolutionNote.trim()) {
      toast.warning('Catatan Wajib Diisi', 'Mohon cantumkan catatan penjelasan atau putusan atas sanggahan ini.');
      return;
    }

    setResolving(true);
    try {
      let resolverId = currentUser?.id;
      if (!resolverId) {
        const { data: defaultAdmin } = await supabase
          .from('profiles')
          .select('id')
          .in('system_role', ['admin', 'coordinator'])
          .limit(1)
          .maybeSingle();
        resolverId = defaultAdmin?.id || '11111111-0000-0000-0000-000000000001';
      }

      let success = false;
      try {
        const res = await fetch('/api/clarifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clarificationId: activeClarification.id,
            status,
            resolutionNote: resolutionNote.trim(),
          }),
        });
        const result = await res.json();
        if (res.ok && result.success) {
          success = true;
        } else if (!res.ok) {
          throw new Error(result.error || 'Gagal memperbarui status sanggahan di server.');
        }
      } catch (apiErr: any) {
        console.warn('PUT /api/clarifications failed, trying direct supabase update:', apiErr);
      }

      if (!success) {
        const { error } = await supabase
          .from('clarification_requests')
          .update({
            request_status: status,
            resolution_note: resolutionNote.trim(),
            resolved_by: resolverId,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', activeClarification.id);

        if (error) throw error;
      }

      if (status === 'resolved') {
        toast.success(
          'Sanggahan Diterima & Diselesaikan',
          'Status sanggahan telah ditandai selesai dan sinkronisasi presensi telah diproses.'
        );
      } else {
        toast.info(
          'Sanggahan Ditolak',
          'Sanggahan ditolak dengan penjelasan resmi yang tersimpan dalam sistem.'
        );
      }

      // Kirim notifikasi in-app kepada anggota pembuat sanggahan
      if (activeClarification.member_id) {
        sendInAppNotification({
          userId: activeClarification.member_id,
          title: status === 'resolved' ? 'Sanggahan Anda Diterima' : 'Sanggahan Anda Ditolak',
          message: `Catatan Putusan: "${resolutionNote.trim().slice(0, 70)}..."`,
          notificationType: 'clarification',
          actionUrl: '/dashboard/clarifications',
        });
      }

      setIsResolveModalOpen(false);
      setResolutionNote('');
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Menyelesaikan Sanggahan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setResolving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // EDIT SANGGAHAN (Pembuat / Admin / Koordinator)
  // ---------------------------------------------------------------------------
  const openEditModal = (item: ClarificationRequest) => {
    setSelectedForEdit(item);
    setEditRequestType(item.request_type);
    setEditActivityId(item.related_activity_id || '');
    setEditDescription(item.request_description);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForEdit || !editDescription.trim()) return;

    setEditing(true);
    try {
      const res = await fetch('/api/clarifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clarificationId: selectedForEdit.id,
          requestType: editRequestType,
          relatedActivityId: editActivityId || null,
          description: editDescription.trim(),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal memperbarui sanggahan.');

      toast.success('Sanggahan Berhasil Diperbarui', 'Perubahan isi sanggahan telah disimpan.');
      setIsEditModalOpen(false);
      setSelectedForEdit(null);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Mengedit Sanggahan', err.message);
    } finally {
      setEditing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HAPUS SANGGAHAN (Pembuat / Admin / Koordinator)
  // ---------------------------------------------------------------------------
  const openDeleteModal = (item: ClarificationRequest) => {
    setSelectedForDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedForDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/clarifications?id=${selectedForDelete.id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menghapus sanggahan.');

      toast.success('Sanggahan Dihapus', 'Sanggahan telah berhasil dihapus dari sistem.');
      setIsDeleteModalOpen(false);
      setSelectedForDelete(null);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Menghapus Sanggahan', err.message);
    } finally {
      setDeleting(false);
    }
  };

  const isCoordinatorOrAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'coordinator';

  // Otorisasi: Pembuat yang post bisa edit/hapus selama belum diputus, Admin/Koordinator selalu bisa
  const canEditOrDelete = (item: ClarificationRequest) => {
    if (isCoordinatorOrAdmin) return true;
    const isAuthor = currentUser?.id === item.member_id;
    if (isAuthor && (item.request_status === 'submitted' || item.request_status === 'under_review')) {
      return true;
    }
    return false;
  };

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
      case 'attendance_dispute': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'task_dispute': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'evaluation_dispute': return 'bg-amber-50 text-amber-700 border border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  // Filter
  const filteredClarifications = clarifications.filter(c => {
    const memberName = c.member?.full_name?.toLowerCase() || '';
    const desc = c.request_description.toLowerCase();
    const matchSearch = memberName.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.request_status === statusFilter;
    const matchType = typeFilter === 'all' || c.request_type === typeFilter;
    const matchOwner = ownerFilter === 'all' || (currentUser && c.member_id === currentUser.id);
    return matchSearch && matchStatus && matchType && matchOwner;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-teal-600" />
            Layanan Sanggahan & Klarifikasi Panitia
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kanal transparansi resmi untuk menyanggah status kehadiran, kendala presensi QR, penugasan, atau permohonan peninjauan nilai evaluasi.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-teal-600/20 transition-all text-xs self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Ajukan Sanggahan Baru
        </button>
      </div>

      {/* FILTER & SEARCH */}
      <Card className="p-3.5 sm:p-4 space-y-3">
        {/* Tab Toggle: Semua Sanggahan vs Sanggahan Saya */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setOwnerFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                ownerFilter === 'all'
                  ? 'bg-white text-teal-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Sanggahan ({clarifications.length})
            </button>
            <button
              type="button"
              onClick={() => setOwnerFilter('my')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                ownerFilter === 'my'
                  ? 'bg-white text-teal-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sanggahan Saya ({clarifications.filter(c => currentUser && c.member_id === currentUser.id).length})
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            Menampilkan <strong className="text-slate-800">{filteredClarifications.length}</strong> data transparan
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari isi sanggahan, nama panitia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-teal-500"
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
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-teal-500"
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
            <div key={n} className="h-32 bg-slate-100 rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filteredClarifications.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">Belum Ada Sanggahan Aktif</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Seluruh data presensi dan evaluasi panitia berjalan lancar tanpa ada sengketa data.
          </p>
        </Card>
      ) : (
        <div className="space-y-3.5 sm:space-y-4">
          {filteredClarifications.map((item) => (
            <Card 
              key={item.id} 
              className="p-4 sm:p-5 hover:border-slate-300 transition-all"
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

                    <span className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Diajukan: {formatDateTimeWITA(item.created_at)}
                    </span>

                    {/* Role & Submitter Badges */}
                    {item.member?.system_role === 'admin' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Diposting Admin / Pimpinan
                      </span>
                    ) : item.member?.system_role === 'coordinator' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Diposting Koordinator
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Diposting Anggota
                      </span>
                    )}

                    {currentUser && item.member_id === currentUser.id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-800 border border-teal-200">
                        Postingan Anda
                      </span>
                    )}
                  </div>

                  {/* Pengaju */}
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <User className="h-3.5 w-3.5 text-teal-600" />
                    <span className="font-semibold text-slate-900">{item.member?.full_name || 'Anggota Panitia'}</span>
                    <span className="text-slate-500">({item.member?.member_code || '-'} • {item.member?.field?.field_name || 'Umum'})</span>
                  </div>

                  {item.related_activity && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 w-fit">
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">Agenda: {item.related_activity.activity_name}</span>
                    </div>
                  )}

                  {/* Isi Sanggahan */}
                  <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {item.request_description}
                  </p>

                  {/* Resolusi / Catatan Peninjau jika sudah direspons */}
                  {item.resolution_note && (
                    <div className="mt-2 text-xs bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl">
                      <div className="font-semibold text-emerald-900 flex items-center gap-1.5 mb-1">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        Putusan & Catatan Resmi Tim Peninjau:
                      </div>
                      <p className="text-emerald-800 leading-relaxed">
                        {item.resolution_note}
                      </p>
                      {item.resolved_at && (
                        <span className="text-[10px] text-emerald-700 block mt-1.5">
                          Diselesaikan pada {formatDateTimeWITA(item.resolved_at)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons: Edit, Hapus, dan Tanggapi */}
                <div className="flex flex-wrap items-center md:items-end justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {canEditOrDelete(item) && (
                    <>
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                        title="Edit Sanggahan"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                        title="Hapus Sanggahan"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        <span>Hapus</span>
                      </button>
                    </>
                  )}

                  {isCoordinatorOrAdmin && item.request_status !== 'resolved' && (
                    <button
                      onClick={() => {
                        setActiveClarification(item);
                        setResolutionNote(item.resolution_note || '');
                        setIsResolveModalOpen(true);
                      }}
                      className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-3.5 py-1.5 rounded-xl transition-colors shadow-xs"
                    >
                      Tanggapi Sanggahan
                    </button>
                  )}
                </div>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jenis Klarifikasi / Sanggahan <span className="text-rose-500">*</span>
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as ClarificationRequestType)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            >
              <option value="attendance_dispute">Sanggahan Presensi (Kendala scan QR / Status Alpa)</option>
              <option value="task_dispute">Sanggahan Tugas (Hasil kerja belum dinilai)</option>
              <option value="evaluation_dispute">Sanggahan Nilai Evaluasi Koordinator</option>
              <option value="general_inquiry">Pertanyaan & Konsultasi Umum Organisasi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agenda Kegiatan Terkait (Opsional)
            </label>
            <select
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            >
              <option value="">Tidak Terkait Agenda Tertentu</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>{a.activity_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rincian Alasan, Kronologi, & Tautan Bukti <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan secara lengkap kendala yang dialami. Sertakan tautan foto/dokumen pendukung (misal Google Drive)..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:opacity-50 transition-colors shadow-sm shadow-teal-600/20"
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
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 block mb-1 font-semibold">Uraian Sanggahan Anggota:</span>
            <p className="text-slate-800 leading-relaxed">
              {activeClarification?.request_description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Putusan / Tanggapan Resmi <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Tuliskan putusan hasil investigasi dan arahan perbaikan data..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolveClarification('rejected')}
              className="px-4 py-2 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-colors"
            >
              Tolak Sanggahan
            </button>
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolveClarification('resolved')}
              className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors shadow-sm shadow-teal-600/20"
            >
              {resolving ? 'Menyimpan...' : 'Terima & Selesaikan Sanggahan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Edit Sanggahan (Pembuat / Admin / Koordinator) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Permohonan Sanggahan"
        description="Perbarui isi sanggahan, jenis sengketa, atau agenda terkait."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jenis Klarifikasi / Sanggahan <span className="text-rose-500">*</span>
            </label>
            <select
              value={editRequestType}
              onChange={(e) => setEditRequestType(e.target.value as ClarificationRequestType)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            >
              <option value="attendance_dispute">Sanggahan Presensi (Kendala scan QR / Status Alpa)</option>
              <option value="task_dispute">Sanggahan Tugas (Hasil kerja belum dinilai)</option>
              <option value="evaluation_dispute">Sanggahan Nilai Evaluasi Koordinator</option>
              <option value="general_inquiry">Pertanyaan & Konsultasi Umum Organisasi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agenda Kegiatan Terkait (Opsional)
            </label>
            <select
              value={editActivityId}
              onChange={(e) => setEditActivityId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            >
              <option value="">Tidak Terkait Agenda Tertentu</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>{a.activity_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rincian Alasan, Kronologi, & Bukti <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Perbarui rincian kendala yang dialami..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={editing}
              className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors shadow-sm shadow-teal-600/20"
            >
              {editing ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Konfirmasi Hapus Sanggahan */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Sanggahan"
        description="Apakah Anda yakin ingin menghapus sanggahan ini? Tindakan ini tidak dapat dibatalkan."
      >
        <div className="space-y-4">
          {selectedForDelete && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <span className="font-semibold block">Sanggahan yang akan dihapus:</span>
              <p className="line-clamp-2 italic">"{selectedForDelete.request_description}"</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteSubmit}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm shadow-rose-600/20"
            >
              {deleting ? 'Menghapus...' : 'Ya, Hapus Sanggahan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
