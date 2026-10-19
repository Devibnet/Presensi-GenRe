'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Star,
  Award,
  Calculator,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  TrendingUp,
  Clock,
  CheckSquare,
  ShieldAlert,
  HelpCircle,
  FileSpreadsheet,
  Lock,
  Eye,
  Edit2,
  Trash2,
  Plus
} from 'lucide-react';
import { Profile, FinalEvaluation, PerformanceReview, Field } from '@/lib/types';
import { getStatusBadgeClass, formatTimeWITA } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';

export default function EvaluationsPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [finalEvaluations, setFinalEvaluations] = useState<FinalEvaluation[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');

  // Modal Input & Edit Penilaian Koordinator (CRUD: Create & Update)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [communicationScore, setCommunicationScore] = useState<number>(4.5);
  const [responsibilityScore, setResponsibilityScore] = useState<number>(4.5);
  const [teamworkScore, setTeamworkScore] = useState<number>(5.0);
  const [initiativeScore, setInitiativeScore] = useState<number>(4.0);
  const [professionalismScore, setProfessionalismScore] = useState<number>(5.0);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // Modal Rincian Evaluasi (CRUD: Read)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEvalForDetail, setSelectedEvalForDetail] = useState<FinalEvaluation | null>(null);
  const [detailAttendanceLogs, setDetailAttendanceLogs] = useState<any[]>([]);
  const [loadingDetailLogs, setLoadingDetailLogs] = useState(false);

  // Modal Hapus Penilaian (CRUD: Delete)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEvalForDelete, setSelectedEvalForDelete] = useState<FinalEvaluation | null>(null);
  const [deletingReview, setDeletingReview] = useState(false);

  // Calculation State
  const [calculating, setCalculating] = useState(false);

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

      // 2. Final evaluations via API (joins performance_reviews and profiles)
      let fetchedEvals = false;
      try {
        const res = await fetch('/api/evaluations');
        const json = await res.json();
        if (res.ok && json.data) {
          setFinalEvaluations(json.data);
          fetchedEvals = true;
        }
      } catch (apiErr) {
        console.warn('GET /api/evaluations failed, trying direct supabase:', apiErr);
      }

      if (!fetchedEvals) {
        const { data: evalsData, error: evalsErr } = await supabase
          .from('final_evaluations')
          .select(`
            *,
            member:profiles!final_evaluations_member_id_fkey(
              *,
              field:fields!profiles_field_id_fkey(*)
            )
          `)
          .order('final_score', { ascending: false });

        if (!evalsErr && evalsData) {
          setFinalEvaluations(evalsData as any);
        } else {
          setFinalEvaluations([]);
        }
      }

      // 3. Members list
      const { data: mData } = await supabase
        .from('profiles')
        .select('*, field:fields!profiles_field_id_fkey(*)')
        .eq('account_status', 'active')
        .order('full_name');
      if (mData) setMembers(mData as any);

      // 4. Fields list
      const { data: fData } = await supabase.from('fields').select('*').order('field_name');
      if (fData) setFields(fData);
    } catch (err) {
      console.error(err);
      setFinalEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  // Kalkulasi Skor Terbobot Koordinator (Maks 60 poin)
  const calcCoordTotal = (comm: number, resp: number, team: number, init: number, prof: number) => {
    const commPts = (comm / 5) * 15;
    const respPts = (resp / 5) * 15;
    const teamPts = (team / 5) * 10;
    const initPts = (init / 5) * 10;
    const profPts = (prof / 5) * 10;
    return Number((commPts + respPts + teamPts + initPts + profPts).toFixed(2));
  };

  const currentWeightedTotal = calcCoordTotal(
    communicationScore,
    responsibilityScore,
    teamworkScore,
    initiativeScore,
    professionalismScore
  );

  // Format Tanggal WITA
  const formatDateWITA = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('id-ID', {
        timeZone: 'Asia/Makassar',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WITA';
    } catch {
      return isoString;
    }
  };

  // CRUD Handlers
  const openCreateRatingModal = (member?: Profile | null) => {
    setIsEditMode(false);
    const target = member || (evaluatableMembers.length > 0 ? evaluatableMembers[0] : null);
    setSelectedMember(target);
    setCommunicationScore(4.5);
    setResponsibilityScore(4.5);
    setTeamworkScore(5.0);
    setInitiativeScore(4.0);
    setProfessionalismScore(5.0);
    setEvidenceNote('');
    setIsRatingModalOpen(true);
  };

  const openEditRatingModal = (ev: FinalEvaluation) => {
    setIsEditMode(true);
    if (!ev.member) return;
    setSelectedMember(ev.member);
    if (ev.review) {
      setCommunicationScore(Number(ev.review.communication_score) || 4.5);
      setResponsibilityScore(Number(ev.review.responsibility_score) || 4.5);
      setTeamworkScore(Number(ev.review.teamwork_score) || 4.5);
      setInitiativeScore(Number(ev.review.initiative_score) || 4.0);
      setProfessionalismScore(Number(ev.review.professionalism_score) || 4.5);
      setEvidenceNote(ev.review.evidence_note || '');
    } else {
      setCommunicationScore(4.5);
      setResponsibilityScore(4.5);
      setTeamworkScore(5.0);
      setInitiativeScore(4.0);
      setProfessionalismScore(5.0);
      setEvidenceNote('');
    }
    setIsRatingModalOpen(true);
  };

  const openDetailModal = async (ev: FinalEvaluation) => {
    setSelectedEvalForDetail(ev);
    setIsDetailModalOpen(true);
    setLoadingDetailLogs(true);
    try {
      const { data: asgs } = await supabase
        .from('activity_assignments')
        .select(`
          id,
          assignment_description,
          activity:activities(id, activity_code, activity_name, start_at, end_at, check_out_opens_at, check_out_closes_at),
          attendances(check_in_at, check_out_at, check_in_status, check_out_status, check_out_method, attendance_note, verification_status)
        `)
        .eq('member_id', ev.member_id)
        .eq('assignment_status', 'active');
      setDetailAttendanceLogs(asgs || []);
    } catch (err) {
      console.warn('Gagal memuat log presensi detail panitia:', err);
      setDetailAttendanceLogs([]);
    } finally {
      setLoadingDetailLogs(false);
    }
  };

  const openDeleteModal = (ev: FinalEvaluation) => {
    setSelectedEvalForDelete(ev);
    setIsDeleteModalOpen(true);
  };

  // Simpan / Perbarui Lembar Evaluasi Koordinator (CRUD: Create & Update)
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setSavingReview(true);
    try {
      const res = await fetch('/api/evaluations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          reviewerId: currentUser?.id,
          communicationScore,
          responsibilityScore,
          teamworkScore,
          initiativeScore,
          professionalismScore,
          evidenceNote,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal menyimpan penilaian');
      }

      toast.success(
        isEditMode ? 'Penilaian Kinerja Diperbarui' : 'Penilaian Kinerja Disimpan',
        `Skor untuk ${selectedMember.full_name} berhasil ${isEditMode ? 'diperbarui' : 'disimpan'} (${result.score ?? currentWeightedTotal}/60).`
      );

      // Kirim notifikasi in-app ke anggota yang dinilai
      sendInAppNotification({
        userId: selectedMember.id,
        title: isEditMode ? 'Evaluasi Kinerja Telah Diperbarui' : 'Evaluasi Kinerja Telah Diinput',
        message: `Koordinator telah ${isEditMode ? 'memperbarui' : 'menginput'} evaluasi kinerja Anda (Skor: ${result.score ?? currentWeightedTotal}/60).`,
        notificationType: 'evaluation',
        actionUrl: '/dashboard/evaluations',
      });

      setIsRatingModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Menyimpan Evaluasi', err.message || 'Periksa koneksi database.');
    } finally {
      setSavingReview(false);
    }
  };

  // Hapus Penilaian Koordinator (CRUD: Delete)
  const handleDeleteEvaluation = async () => {
    if (!selectedEvalForDelete) return;
    setDeletingReview(true);
    try {
      const res = await fetch(`/api/evaluations?memberId=${selectedEvalForDelete.member_id}`, {
        method: 'DELETE',
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Gagal menghapus penilaian');
      }
      toast.success(
        'Penilaian Dihapus',
        `Lembar penilaian koordinator untuk ${selectedEvalForDelete.member?.full_name || 'panitia'} berhasil dihapus dan skor koordinator direset ke 0.00.`
      );
      setIsDeleteModalOpen(false);
      if (isDetailModalOpen) setIsDetailModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Gagal Menghapus Penilaian', err.message);
    } finally {
      setDeletingReview(false);
    }
  };

  // Trigger Hitung Ulang Semua Anggota
  const handleCalculateAll = async () => {
    if (!confirm('Apakah Anda yakin ingin menghitung ulang nilai akhir dan kelayakan sertifikat untuk seluruh panitia?')) return;

    setCalculating(true);
    try {
      const { data: periodData } = await supabase
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .single();
      const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

      const res = await fetch('/api/evaluations/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Kalkulasi gagal');

      toast.success(
        'Kalkulasi Nilai Selesai',
        `Berhasil memproses evaluasi akhir untuk ${resJson.totalProcessed} anggota panitia.`
      );

      // Kirim broadcast in-app
      sendInAppNotification({
        title: 'Kalkulasi Nilai Akhir Diperbarui',
        message: `Akumulasi nilai kehadiran dan kinerja telah dihitung ulang untuk ${resJson.totalProcessed} panitia.`,
        notificationType: 'evaluation',
        actionUrl: '/dashboard/evaluations',
        broadcastToAll: true,
      });

      fetchData();
    } catch (err: any) {
      toast.error('Error Saat Kalkulasi', err.message);
    } finally {
      setCalculating(false);
    }
  };

  const isCoordinatorOrAdmin = Boolean(
    currentUser && (currentUser.system_role === 'admin' || currentUser.system_role === 'coordinator')
  );

  // Helper untuk memverifikasi hak akses penilai terhadap target anggota
  const canEvaluateMember = (
    evaluator: Profile | null,
    target: Profile | null | undefined,
    coordFieldIds: string[]
  ): { allowed: boolean; reason?: string } => {
    if (!evaluator || !target) return { allowed: false, reason: 'Data tidak lengkap' };

    // 1. Evaluator tidak bisa menilai akun sendiri
    if (evaluator.id === target.id) {
      return { allowed: false, reason: 'Tidak dapat menilai diri sendiri' };
    }

    // 2. Anggota biasa tidak memiliki hak menilai
    if (evaluator.system_role === 'member') {
      return { allowed: false, reason: 'Anggota tidak memiliki hak menilai' };
    }

    // 3. Akun Admin hanya dapat dinilai oleh akun Admin lain
    if (target.system_role === 'admin') {
      if (evaluator.system_role === 'admin') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Hanya akun admin lain yang dapat menilai admin' };
    }

    // 4. Koordinator hanya bisa dinilai oleh Admin
    if (target.system_role === 'coordinator') {
      if (evaluator.system_role === 'admin') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Koordinator hanya bisa dinilai oleh admin' };
    }

    // 5. Target adalah Anggota Biasa (member)
    if (evaluator.system_role === 'admin') {
      return { allowed: true };
    }

    if (evaluator.system_role === 'coordinator') {
      const isTargetInMySie = Boolean(
        target.field_id &&
        (target.field_id === evaluator.field_id || coordFieldIds.includes(target.field_id))
      );
      if (isTargetInMySie) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Koordinator hanya bisa menilai anggota sie nya' };
    }

    return { allowed: false, reason: 'Tidak memiliki kewenangan' };
  };

  // Divisi yang dikoordinir oleh pengguna saat ini
  const myCoordinatedFieldIds = fields
    .filter(f => f.coordinator_id === currentUser?.id || f.id === currentUser?.field_id)
    .map(f => f.id);

  // Daftar panitia yang sah dinilai oleh currentUser
  const evaluatableMembers = members.filter(
    m => canEvaluateMember(currentUser, m, myCoordinatedFieldIds).allowed
  );

  // Member's own evaluation
  const myEvaluation = finalEvaluations.find(e => e.member_id === currentUser?.id);

  // Helper penentuan status kelayakan sertifikat yang konsisten
  const getEligibilityStatus = (ev?: FinalEvaluation | null) => {
    if (!ev) {
      return {
        key: 'pending',
        label: 'Proses',
        modalLabel: 'Dalam Proses Penilaian',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
        modalBadgeClass: 'bg-amber-100 text-amber-800 border border-amber-300',
        bannerClass: 'bg-amber-50 border-amber-200 text-amber-800',
        bannerIconColor: 'text-amber-600',
      };
    }

    const hasReview = Boolean(ev.review || Number(ev.coordinator_score || 0) > 0);
    const score = Number(ev.final_score || 0);

    if (score >= 75 || ev.certificate_eligibility_status === 'eligible') {
      return {
        key: 'eligible',
        label: 'Layak Sertifikat',
        modalLabel: 'Layak Sertifikat (≥ 75.00)',
        badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        modalBadgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
        bannerClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        bannerIconColor: 'text-emerald-600',
      };
    }

    // Jika belum ada lembar penilaian koordinator / skor koord 0 / status pending -> "Proses"
    if (!hasReview || ev.certificate_eligibility_status === 'pending') {
      return {
        key: 'pending',
        label: 'Proses',
        modalLabel: 'Dalam Proses Penilaian',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
        modalBadgeClass: 'bg-amber-100 text-amber-800 border border-amber-300',
        bannerClass: 'bg-amber-50 border-amber-200 text-amber-800',
        bannerIconColor: 'text-amber-600',
      };
    }

    // Jika sudah dinilai koordinator dan total nilai < 75 -> "Belum Layak"
    return {
      key: 'ineligible',
      label: 'Belum Layak',
      modalLabel: 'Belum Layak (< 75.00)',
      badgeClass: 'bg-rose-50 text-rose-800 border border-rose-200',
      modalBadgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
      bannerClass: 'bg-rose-50 border-rose-200 text-rose-800',
      bannerIconColor: 'text-rose-600',
    };
  };

  // Filter evaluations
  const filteredEvaluations = finalEvaluations.filter(e => {
    const memberName = e.member?.full_name?.toLowerCase() || '';
    const memberCode = e.member?.member_code?.toLowerCase() || '';
    const matchSearch = memberName.includes(searchQuery.toLowerCase()) || memberCode.includes(searchQuery.toLowerCase());
    const matchField = fieldFilter === 'all' || e.member?.field_id === fieldFilter;

    const statusObj = getEligibilityStatus(e);
    const matchEligibility = eligibilityFilter === 'all' || statusObj.key === eligibilityFilter;

    return matchSearch && matchField && matchEligibility;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-50 text-purple-700 border border-purple-200">
              Evaluasi & Sertifikasi
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Buleleng 2026</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" />
            Penilaian Panitia & Rekapitulasi Kinerja
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Formula resmi: 40% Skor Kehadiran Sistem + 60% Skor Rubrik Koordinator Bidang (5 Rubrik). Ambang kelulusan sertifikat: 75.00 poin.
          </p>
        </div>
      </div>

      {/* Banner Panduan & Penegakan Aturan Penilaian */}
      {isCoordinatorOrAdmin && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${currentUser?.system_role === 'admin'
          ? 'bg-amber-50/80 border-amber-200/90 text-amber-900'
          : 'bg-purple-50/80 border-purple-200/90 text-purple-900'
          }`}>
          <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${currentUser?.system_role === 'admin' ? 'text-amber-600' : 'text-purple-600'}`} />
          <div>
            <span className="font-bold block mb-1">
              {currentUser?.system_role === 'admin'
                ? 'Kewenangan Penilaian Administrator (Admin):'
                : `Kewenangan Penilaian: Koordinator ${currentUser?.field?.field_name || 'Sie'}`}
            </span>
            {currentUser?.system_role === 'admin' ? (
              <span>
                Sebagai <strong>Admin</strong>, Anda memiliki kewenangan menilai seluruh anggota panitia dan koordinator sie.
                Sesuai aturan sistem, <strong>akun Admin tidak dapat menilai akun sendiri</strong> dan <strong>hanya akun Admin lain yang dapat menilai akun Anda</strong>.
              </span>
            ) : (
              <span>
                Sebagai <strong>Koordinator Sie</strong>, Anda <strong>hanya dapat menilai anggota sie Anda</strong> ({currentUser?.field?.field_name || 'Sie Anda'}).
                Anda <strong>tidak dapat menilai akun sendiri</strong>, <strong>tidak dapat menilai anggota sie lain</strong>, serta <strong>tidak dapat menilai sesama koordinator maupun admin</strong>.
                Seluruh koordinator sie dinilai secara eksklusif oleh Admin.
              </span>
            )}
          </div>
        </div>
      )}

      {/* MEMBER VIEW: Banner Nilai Pribadi */}
      {currentUser?.system_role === 'member' && myEvaluation && (
        <Card className="p-5 sm:p-6 bg-gradient-to-br from-teal-50/60 via-emerald-50/40 to-white border-teal-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
            <div>
              <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider block mb-1">
                Transkrip Capaian Kinerja Anda
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                {currentUser.full_name} ({currentUser.member_code})
              </h2>
              <p className="text-xs text-slate-600">
                Divisi: {currentUser.field?.field_name || 'Umum'} • Posisi: {currentUser.organization_position}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Nilai Akhir</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {myEvaluation.final_score} <span className="text-xs sm:text-sm font-normal text-slate-500">/ 100</span>
                </span>
              </div>

              {(() => {
                const stat = getEligibilityStatus(myEvaluation);
                return (
                  <div className={`px-4 py-3 rounded-2xl border flex flex-col items-center justify-center ${stat.bannerClass}`}>
                    <Award className={`h-6 w-6 mb-1 ${stat.bannerIconColor}`} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {stat.label.toUpperCase()}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Rincian Poin */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-5 pt-5 border-t border-teal-100">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block mb-1">Check-In (Max 20)</span>
              <span className="text-base font-bold text-teal-700">{myEvaluation.attendance_points} Poin</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Kehadiran agenda</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block mb-1">Ketepatan (Max 10)</span>
              <span className="text-base font-bold text-emerald-700">{myEvaluation.punctuality_points} Poin</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Tepat waktu (on-time)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block mb-1">Check-Out (Max 10)</span>
              <span className="text-base font-bold text-blue-700">{myEvaluation.task_completion_points} Poin</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sesi lengkap / dispensasi</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block mb-1">Koordinator (Max 60)</span>
              <span className="text-base font-bold text-purple-700">{myEvaluation.coordinator_score} Poin</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">5 rubrik evaluasi</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-teal-100/60">
            <button
              onClick={() => openDetailModal(myEvaluation)}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Rincian Lengkap Transkrip</span>
            </button>
            <Link
              href="/dashboard/clarifications"
              className="text-xs text-slate-500 hover:text-amber-700 flex items-center gap-1.5 transition-colors font-medium"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Merasa ada kekeliruan? Ajukan Sanggahan Nilai
            </Link>
          </div>
        </Card>
      )}

      {/* FILTER & SEARCH */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              suppressHydrationWarning
              type="text"
              placeholder="Cari nama anggota, nomor panitia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              suppressHydrationWarning
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="all">Semua Divisi</option>
              {fields.map(f => (
                <option key={f.id} value={f.id}>{f.field_name}</option>
              ))}
            </select>

            {currentUser?.field && (
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => setFieldFilter(fieldFilter === currentUser.field_id ? 'all' : (currentUser.field_id || 'all'))}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${fieldFilter === currentUser.field_id
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
              >
                {fieldFilter === currentUser.field_id ? 'Tampilkan Semua Divisi' : `Anggota Sie Saya (${currentUser.field.field_code})`}
              </button>
            )}

            <select
              suppressHydrationWarning
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="all">Semua Kelayakan</option>
              <option value="eligible">Layak Sertifikat (≥ 75)</option>
              <option value="ineligible">Belum Layak (&lt; 75)</option>
              <option value="pending">Sedang Dihitung</option>
            </select>
          </div>
        </div>
      </Card>

      {/* TABEL REKAP EVALUASI DENGAN FITUR CRUD LENGKAP */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Daftar Evaluasi Akhir Panitia ({filteredEvaluations.length})
          </h2>
          <span className="text-xs text-slate-500">
            Ambang Batas Kelulusan: <strong className="text-emerald-700">75.00 Poin</strong>
          </span>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Memuat data evaluasi kinerja...
            </div>
          ) : filteredEvaluations.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Tidak ada data evaluasi yang cocok dengan filter.
            </div>
          ) : (
            filteredEvaluations.map((ev) => {
              const evalCheck = canEvaluateMember(currentUser, ev.member, myCoordinatedFieldIds);
              const hasReview = Boolean(ev.review || Number(ev.coordinator_score) > 0);

              return (
                <div key={ev.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{ev.member?.full_name || 'Panitia'}</h3>
                      <p className="text-[11px] text-teal-700 font-mono font-medium">{ev.member?.member_code}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {ev.member?.field?.field_name || 'Umum'} &bull; {ev.member?.organization_position}
                      </p>
                    </div>
                    {(() => {
                      const stat = getEligibilityStatus(ev);
                      return (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${stat.badgeClass}`}>
                          {stat.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Score Summary Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Sistem (40)</span>
                      <span className="text-xs font-bold text-teal-700">{ev.system_score}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Koord (60)</span>
                      <span className="text-xs font-bold text-purple-700">
                        {hasReview ? ev.coordinator_score : <span className="text-slate-400 font-normal italic">-</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Akhir (100)</span>
                      <span className="text-xs font-extrabold text-slate-900">
                        {hasReview ? ev.final_score : <span className="text-slate-400 font-normal italic">-</span>}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Actions: CRUD buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {/* Read: Detail Button */}
                    <button
                      suppressHydrationWarning
                      onClick={() => openDetailModal(ev)}
                      className="flex-1 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>

                    {isCoordinatorOrAdmin && (
                      evalCheck.allowed ? (
                        hasReview ? (
                          <>
                            {/* Update: Edit Button */}
                            <button
                              suppressHydrationWarning
                              onClick={() => openEditRatingModal(ev)}
                              className="flex-1 py-2 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            {/* Delete: Trash Button */}
                            <button
                              suppressHydrationWarning
                              onClick={() => openDeleteModal(ev)}
                              className="px-3 py-2 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 font-semibold transition-colors flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          /* Create: Add Score Button */
                          <button
                            suppressHydrationWarning
                            onClick={() => openCreateRatingModal(ev.member || null)}
                            className="flex-1 py-2 text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl border border-teal-200 font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Nilai</span>
                          </button>
                        )
                      ) : (
                        <div className="flex-1 py-2 text-[11px] bg-slate-100 text-slate-500 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 font-medium">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{evalCheck.reason}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Panitia</th>
                <th className="px-4 py-3">Divisi / Posisi</th>
                <th className="px-4 py-3 text-center">Skor Sistem (40)</th>
                <th className="px-4 py-3 text-center">Skor Koord (60)</th>
                <th className="px-4 py-3 text-center">Nilai Akhir (100)</th>
                <th className="px-4 py-3 text-center">Status Kelayakan</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    Memuat data evaluasi kinerja...
                  </td>
                </tr>
              ) : filteredEvaluations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    Tidak ada data evaluasi yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredEvaluations.map((ev) => {
                  const evalCheck = canEvaluateMember(currentUser, ev.member, myCoordinatedFieldIds);
                  const hasReview = Boolean(ev.review || Number(ev.coordinator_score) > 0);

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{ev.member?.full_name || 'Panitia'}</div>
                        <div className="text-[10px] text-teal-700 font-mono">{ev.member?.member_code}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-slate-800">{ev.member?.field?.field_name || 'Umum'}</div>
                        <div className="text-[10px] text-slate-500">{ev.member?.organization_position}</div>
                      </td>

                      <td className="px-4 py-3.5 text-center font-semibold text-teal-700">
                        {ev.system_score}
                        <span className="block text-[9px] text-slate-500 font-normal">
                          (In:{ev.attendance_points} Tepat:{ev.punctuality_points} Out:{ev.task_completion_points})
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center font-semibold text-purple-700">
                        {hasReview ? ev.coordinator_score : <span className="text-slate-400 font-normal italic">-</span>}
                      </td>

                      <td className="px-4 py-3.5 text-center font-extrabold text-sm text-slate-900">
                        {hasReview ? ev.final_score : <span className="text-slate-400 font-normal text-xs italic">Menunggu Nilai</span>}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {(() => {
                          const stat = getEligibilityStatus(ev);
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${stat.badgeClass}`}>
                              {stat.label}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Read: Detail Button */}
                          <button
                            suppressHydrationWarning
                            title="Lihat Rincian Lengkap"
                            onClick={() => openDetailModal(ev)}
                            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isCoordinatorOrAdmin && (
                            evalCheck.allowed ? (
                              hasReview ? (
                                <>
                                  {/* Update: Edit Button */}
                                  <button
                                    suppressHydrationWarning
                                    title="Edit Penilaian"
                                    onClick={() => openEditRatingModal(ev)}
                                    className="inline-flex items-center gap-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-lg border border-indigo-200 font-semibold transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                  {/* Delete: Trash Button */}
                                  <button
                                    suppressHydrationWarning
                                    title="Hapus Penilaian"
                                    onClick={() => openDeleteModal(ev)}
                                    className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                /* Create: Add Score Button */
                                <button
                                  suppressHydrationWarning
                                  title="Beri Nilai Panitia"
                                  onClick={() => openCreateRatingModal(ev.member || null)}
                                  className="inline-flex items-center gap-1 text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 px-2.5 py-1.5 rounded-lg border border-teal-200 font-semibold transition-colors cursor-pointer shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Nilai</span>
                                </button>
                              )
                            ) : (
                              <span
                                title={evalCheck.reason}
                                className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200 cursor-not-allowed font-medium whitespace-nowrap"
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                {evalCheck.reason === 'Tidak dapat menilai diri sendiri' ? 'Diri Sendiri' :
                                  evalCheck.reason === 'Hanya akun admin lain yang dapat menilai admin' ? 'Admin Lain' :
                                    evalCheck.reason === 'Koordinator hanya bisa dinilai oleh admin' ? 'Khusus Admin' :
                                      evalCheck.reason === 'Koordinator hanya bisa menilai anggota sie nya' ? 'Sie Lain' : 'Terkunci'}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL 1: Form Input / Edit Penilaian Rubrik Koordinator (CRUD: Create & Update) */}
      <Modal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        title={isEditMode ? `Edit Penilaian: ${selectedMember?.full_name || 'Panitia'}` : `Input Penilaian Baru: ${selectedMember?.full_name || 'Panitia'}`}
        description="Beri penilaian pada 5 rubrik kompetensi koordinator (Skala 1.0 - 5.0). Total bobot koordinator maksimal 60 poin."
      >
        <form onSubmit={handleSaveEvaluation} className="space-y-4">
          {/* Pemilihan Anggota yang Dinilai */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Panitia yang Dinilai:
            </label>
            {isEditMode ? (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">{selectedMember?.full_name}</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedMember?.member_code} &bull; {selectedMember?.field?.field_name || 'Umum'} ({selectedMember?.organization_position})
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                  Mode Edit
                </span>
              </div>
            ) : evaluatableMembers.length === 0 ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Tidak ada panitia yang memenuhi syarat hak akses untuk Anda nilai saat ini.</span>
              </div>
            ) : (
              <select
                value={selectedMember?.id || ''}
                onChange={(e) => {
                  const found = evaluatableMembers.find((m) => m.id === e.target.value);
                  if (found) setSelectedMember(found);
                }}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-purple-500 cursor-pointer shadow-sm"
              >
                {evaluatableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.member_code}) &bull; {m.field?.field_name || 'Umum'} ({m.organization_position})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Summary Box */}
          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-800 font-medium block">Total Poin Terbobot Koordinator</span>
              <span className="text-xl font-bold text-amber-900">{currentWeightedTotal} / 60.00</span>
            </div>
            <span className="text-xs text-amber-800 text-right font-medium">
              Divisi: {selectedMember?.field?.field_name || 'Umum'}
            </span>
          </div>

          {/* Kriteria 1: Komunikasi Efektif (Bobot 15) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-800">
                1. Komunikasi Efektif & Koordinasi (Bobot: 15 Poin)
              </label>
              <span className="text-xs font-bold text-teal-800">
                {communicationScore.toFixed(1)} / 5.0 ({((communicationScore / 5) * 15).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mb-2">
              Kelancaran respons di grup WA, kemampuan koordinasi antar divisi, dan kejelasan menyampaikan kendala.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={communicationScore}
              onChange={(e) => setCommunicationScore(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          {/* Kriteria 2: Tanggung Jawab & Disiplin (Bobot 15) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-800">
                2. Tanggung Jawab & Disiplin Tugas (Bobot: 15 Poin)
              </label>
              <span className="text-xs font-bold text-teal-800">
                {responsibilityScore.toFixed(1)} / 5.0 ({((responsibilityScore / 5) * 15).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mb-2">
              Komitmen menyelesaikan jobdesk tepat waktu tanpa harus ditegur berulang kali oleh koordinator.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={responsibilityScore}
              onChange={(e) => setResponsibilityScore(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          {/* Kriteria 3: Kerjasama Tim (Bobot 10) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-800">
                3. Kerjasama Tim & Solidaritas (Bobot: 10 Poin)
              </label>
              <span className="text-xs font-bold text-teal-800">
                {teamworkScore.toFixed(1)} / 5.0 ({((teamworkScore / 5) * 10).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mb-2">
              Kemauan saling bantu sesama panitia lintas divisi di saat genting/persiapan teknis venue.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={teamworkScore}
              onChange={(e) => setTeamworkScore(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          {/* Kriteria 4: Inisiatif & Kreativitas (Bobot 10) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-800">
                4. Inisiatif & Pemecahan Masalah (Bobot: 10 Poin)
              </label>
              <span className="text-xs font-bold text-teal-800">
                {initiativeScore.toFixed(1)} / 5.0 ({((initiativeScore / 5) * 10).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mb-2">
              Proaktif mencari solusi alternatif saat terjadi hambatan lapangan tanpa menunggu instruksi kaku.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={initiativeScore}
              onChange={(e) => setInitiativeScore(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          {/* Kriteria 5: Sikap, Etika & Nilai Budaya GenRe (Bobot 10) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-800">
                5. Sikap, Etika & Nilai Budaya GenRe (Bobot: 10 Poin)
              </label>
              <span className="text-xs font-bold text-teal-800">
                {professionalismScore.toFixed(1)} / 5.0 ({((professionalismScore / 5) * 10).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mb-2">
              Kesantunan berinteraksi dengan mitra, dewan juri, peserta duta, dan sesama panitia organisasi.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={professionalismScore}
              onChange={(e) => setProfessionalismScore(parseFloat(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
          </div>

          {/* Catatan Pembuktian */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Pembuktian / Keterangan Kualitatif
            </label>
            <textarea
              rows={2}
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              placeholder="Contoh: Sangat aktif membantu persiapan venue gladi bersih, responsif dan sigap."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setIsRatingModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              suppressHydrationWarning
              type="submit"
              disabled={savingReview}
              className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl disabled:opacity-50 transition-colors shadow-sm shadow-teal-600/20 cursor-pointer"
            >
              {savingReview ? (isEditMode ? 'Memperbarui...' : 'Menyimpan...') : (isEditMode ? 'Simpan Perubahan Nilai' : 'Simpan Nilai & Sinkronkan')}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Rincian Lengkap Transkrip Nilai (CRUD: Read) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        maxWidth="max-w-2xl"
        title="Rincian Transkrip Evaluasi Panitia"
        description={`Rincian capaian nilai kinerja dan akumulasi kehadiran ${selectedEvalForDetail?.member?.full_name || 'Panitia'}.`}
      >
        {selectedEvalForDetail && (
          <div className="space-y-4">
            {/* Profil Singkat & Status */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedEvalForDetail.member?.full_name || 'Panitia'}
                </h3>
                <p className="text-xs text-teal-700 font-mono font-medium">
                  {selectedEvalForDetail.member?.member_code}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Divisi: <strong>{selectedEvalForDetail.member?.field?.field_name || 'Umum'}</strong> &bull; Posisi: <strong>{selectedEvalForDetail.member?.organization_position || 'Anggota'}</strong>
                </p>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-2">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Nilai Akhir</span>
                  <span className="text-2xl font-black text-slate-900">
                    {selectedEvalForDetail.final_score} <span className="text-xs font-normal text-slate-400">/ 100</span>
                  </span>
                </div>
                {(() => {
                  const stat = getEligibilityStatus(selectedEvalForDetail);
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stat.modalBadgeClass}`}>
                      {stat.modalLabel || stat.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Komponen 1: Sistem (40 Poin) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                    40%
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Akumulasi Presensi Sistem (Check-In & Check-Out)
                  </h4>
                </div>
                <span className="text-sm font-black text-teal-700">
                  {selectedEvalForDetail.system_score} <span className="text-[11px] font-normal text-slate-400">/ 40.00</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Presensi Check-In (Max 20)</span>
                  <span className="text-sm font-bold text-teal-800">{selectedEvalForDetail.attendance_points} Poin</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Kehadiran agenda</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Ketepatan Waktu (Max 10)</span>
                  <span className="text-sm font-bold text-emerald-800">{selectedEvalForDetail.punctuality_points} Poin</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Tepat waktu (on-time)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Presensi Check-Out (Max 10)</span>
                  <span className="text-sm font-bold text-blue-800">{selectedEvalForDetail.task_completion_points} Poin</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Sesi lengkap / dispensasi</span>
                </div>
              </div>

              {/* Log Rincian Presensi & Status Kepulangan per Agenda */}
              <div className="pt-2.5 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Audit Log Presensi & Status Kepulangan per Agenda:
                </span>
                {loadingDetailLogs ? (
                  <div className="py-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    <span>Memuat rincian agenda panitia...</span>
                  </div>
                ) : detailAttendanceLogs.length === 0 ? (
                  <div className="py-2.5 px-3 text-center text-[11px] text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Belum ada riwayat penugasan agenda aktif untuk panitia ini.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {detailAttendanceLogs.map((item) => {
                      const act = item.activity;
                      const att = Array.isArray(item.attendances) ? item.attendances[0] : item.attendances;
                      const isCheckedIn = Boolean(att?.check_in_at);
                      const isCheckedOut = Boolean(att?.check_out_at);
                      const checkOutDeadline = act?.check_out_closes_at || act?.end_at;
                      const isPastDeadline = Boolean(checkOutDeadline && new Date() > new Date(checkOutDeadline));
                      const isDispensasi = att?.check_out_method === 'manual' || (att?.attendance_note && att.attendance_note.toLowerCase().includes('disetujui'));

                      return (
                        <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-slate-900">{act?.activity_name || 'Agenda'}</span>
                            <span className="font-mono text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                              {act?.activity_code}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-600 flex-wrap">
                            <span>
                              Masuk:{' '}
                              {isCheckedIn ? (
                                <strong className={att.check_in_status === 'on_time' ? 'text-emerald-700' : 'text-amber-700'}>
                                  {formatTimeWITA(att.check_in_at)} ({att.check_in_status === 'on_time' ? 'Tepat Waktu' : 'Terlambat'})
                                </strong>
                              ) : (
                                <span className="text-amber-700 font-medium">Belum Check-in</span>
                              )}
                            </span>
                            <span>&bull;</span>
                            <span>
                              Pulang:{' '}
                              {isCheckedOut ? (
                                <strong className={att.check_out_status === 'early_departure' && !isDispensasi ? 'text-amber-700' : 'text-emerald-700'}>
                                  {formatTimeWITA(att.check_out_at)}{' '}
                                  {isDispensasi ? (
                                    <span className="text-teal-700 font-bold bg-teal-50 border border-teal-200 px-1 py-0.5 rounded text-[10px]">
                                      Disetujui Dispensasi
                                    </span>
                                  ) : att.check_out_status === 'early_departure' ? (
                                    <span className="text-amber-800 font-bold bg-amber-50 border border-amber-300 px-1 py-0.5 rounded text-[10px]">
                                      Mendahului
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded text-[10px]">
                                      Sesuai Jadwal
                                    </span>
                                  )}
                                </strong>
                              ) : isCheckedIn && isPastDeadline ? (
                                <span className="text-rose-700 font-bold bg-rose-50 border border-rose-200 px-1 py-0.5 rounded text-[10px]">
                                  Tidak Check-out (Melewati Batas)
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </span>
                          </div>
                          {att?.attendance_note && (
                            <p className="text-[10px] text-slate-500 italic mt-1 bg-white/70 p-1 rounded border border-slate-200/60">
                              Catatan: {att.attendance_note}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Komponen 2: Koordinator Rubrik (60 Poin) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                    60%
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Evaluasi Rubrik Kinerja Koordinator
                  </h4>
                </div>
                <span className="text-sm font-black text-purple-700">
                  {selectedEvalForDetail.coordinator_score} <span className="text-[11px] font-normal text-slate-400">/ 60.00</span>
                </span>
              </div>

              {selectedEvalForDetail.review ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 bg-purple-50/60 p-2.5 rounded-xl border border-purple-100">
                    <span>
                      Penilai: <strong>{selectedEvalForDetail.review.reviewer?.full_name || 'Koordinator'}</strong> ({selectedEvalForDetail.review.reviewer?.system_role || 'Staff'})
                    </span>
                    <span>
                      {formatDateWITA(selectedEvalForDetail.review.updated_at || selectedEvalForDetail.review.created_at)}
                    </span>
                  </div>

                  {/* 5 Kriteria */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-700 font-medium">1. Komunikasi Efektif & Koordinasi</span>
                      <span className="font-bold text-slate-900">
                        {selectedEvalForDetail.review.communication_score} / 5.0
                        <span className="text-teal-700 ml-1">({((Number(selectedEvalForDetail.review.communication_score) / 5) * 15).toFixed(1)} Pts)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-700 font-medium">2. Tanggung Jawab & Disiplin</span>
                      <span className="font-bold text-slate-900">
                        {selectedEvalForDetail.review.responsibility_score} / 5.0
                        <span className="text-teal-700 ml-1">({((Number(selectedEvalForDetail.review.responsibility_score) / 5) * 15).toFixed(1)} Pts)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-700 font-medium">3. Kerjasama Tim & Solidaritas</span>
                      <span className="font-bold text-slate-900">
                        {selectedEvalForDetail.review.teamwork_score} / 5.0
                        <span className="text-teal-700 ml-1">({((Number(selectedEvalForDetail.review.teamwork_score) / 5) * 10).toFixed(1)} Pts)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-700 font-medium">4. Inisiatif & Pemecahan Masalah</span>
                      <span className="font-bold text-slate-900">
                        {selectedEvalForDetail.review.initiative_score} / 5.0
                        <span className="text-teal-700 ml-1">({((Number(selectedEvalForDetail.review.initiative_score) / 5) * 10).toFixed(1)} Pts)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-700 font-medium">5. Sikap, Etika & Nilai Budaya GenRe</span>
                      <span className="font-bold text-slate-900">
                        {selectedEvalForDetail.review.professionalism_score} / 5.0
                        <span className="text-teal-700 ml-1">({((Number(selectedEvalForDetail.review.professionalism_score) / 5) * 10).toFixed(1)} Pts)</span>
                      </span>
                    </div>
                  </div>

                  {/* Bukti Kinerja / Catatan */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Catatan Kualitatif / Bukti Kinerja
                    </span>
                    <p className="text-xs text-slate-700 italic">
                      "{selectedEvalForDetail.review.evidence_note || 'Tidak ada catatan pembuktian khusus.'}"
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                  <p className="font-medium text-slate-700 mb-1">Belum Ada Lembar Penilaian Koordinator</p>
                  <p className="text-[11px] text-slate-400">
                    Panitia ini belum diinput penilaian kinerjanya. Poin koordinator saat ini adalah 0.00.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
              <div>
                {isCoordinatorOrAdmin && canEvaluateMember(currentUser, selectedEvalForDetail.member, myCoordinatedFieldIds).allowed && (
                  selectedEvalForDetail.review || Number(selectedEvalForDetail.coordinator_score) > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        openDeleteModal(selectedEvalForDetail);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus Penilaian
                    </button>
                  ) : null
                )}
              </div>

              <div className="flex items-center gap-2">
                {isCoordinatorOrAdmin && canEvaluateMember(currentUser, selectedEvalForDetail.member, myCoordinatedFieldIds).allowed && (
                  selectedEvalForDetail.review || Number(selectedEvalForDetail.coordinator_score) > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        openEditRatingModal(selectedEvalForDetail);
                      }}
                      className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3.5 py-2 rounded-xl border border-indigo-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit Nilai
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        openCreateRatingModal(selectedEvalForDetail.member);
                      }}
                      className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Input Nilai Sekarang
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: Konfirmasi Hapus Penilaian Koordinator (CRUD: Delete) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Konfirmasi Hapus Penilaian Koordinator"
        description="Tindakan ini akan mereset skor rubrik koordinator panitia ini kembali ke 0.00."
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 leading-relaxed">
              <p className="font-bold mb-1">
                Hapus evaluasi kinerja untuk {selectedEvalForDelete?.member?.full_name}?
              </p>
              <p>
                Data lembar penilaian rubrik (5 kriteria) dan catatan bukti kinerja akan dihapus permanen.
                Skor koordinator akan direset menjadi <strong>0.00</strong> dan nilai akhir panitia akan dihitung ulang secara otomatis dari skor sistem kehadiran (<strong>{selectedEvalForDelete?.system_score} poin</strong>).
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              suppressHydrationWarning
              type="button"
              disabled={deletingReview}
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              suppressHydrationWarning
              type="button"
              disabled={deletingReview}
              onClick={handleDeleteEvaluation}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-50 transition-colors shadow-sm shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deletingReview ? 'Menghapus...' : 'Ya, Hapus Penilaian'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
