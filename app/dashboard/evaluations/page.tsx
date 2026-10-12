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
  FileSpreadsheet
} from 'lucide-react';
import { Profile, FinalEvaluation, PerformanceReview, Field } from '@/lib/types';
import { getStatusBadgeClass } from '@/lib/utils';
import Link from 'next/link';

export default function EvaluationsPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [finalEvaluations, setFinalEvaluations] = useState<FinalEvaluation[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');

  // Modal Input Penilaian Koordinator
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [communicationScore, setCommunicationScore] = useState<number>(4.5);
  const [responsibilityScore, setResponsibilityScore] = useState<number>(4.5);
  const [teamworkScore, setTeamworkScore] = useState<number>(5.0);
  const [initiativeScore, setInitiativeScore] = useState<number>(4.0);
  const [professionalismScore, setProfessionalismScore] = useState<number>(5.0);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);

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
          .select('*, field:fields(*)')
          .eq('id', user.id)
          .single();
        if (p) {
          currentProf = p as any;
          setCurrentUser(currentProf);
        }
      }

      // 2. Final evaluations
      const { data: evalsData, error: evalsErr } = await supabase
        .from('final_evaluations')
        .select(`
          *,
          member:profiles(
            *,
            field:fields(*)
          )
        `)
        .order('final_score', { ascending: false });

      if (!evalsErr && evalsData && evalsData.length > 0) {
        setFinalEvaluations(evalsData as any);
      } else {
        setFinalEvaluations(getFallbackEvaluations());
      }

      // 3. Members list
      const { data: mData } = await supabase
        .from('profiles')
        .select('*, field:fields(*)')
        .eq('account_status', 'active')
        .order('full_name');
      if (mData) setMembers(mData as any);

      // 4. Fields list
      const { data: fData } = await supabase.from('fields').select('*').order('field_name');
      if (fData) setFields(fData);
    } catch (err) {
      console.error(err);
      setFinalEvaluations(getFallbackEvaluations());
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

  // Simpan Lembar Evaluasi Koordinator
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setSavingReview(true);
    try {
      // Dapatkan active period
      const { data: periodData } = await supabase
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .single();
      const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

      // Dapatkan policy
      const { data: policyData } = await supabase
        .from('evaluation_policies')
        .select('id')
        .eq('period_id', periodId)
        .single();
      const policyId = policyData?.id || '00000000-0000-0000-0000-000000000001';

      const totalWeighted = currentWeightedTotal;

      const { data: review, error: revErr } = await supabase
        .from('performance_reviews')
        .upsert(
          {
            period_id: periodId,
            member_id: selectedMember.id,
            reviewer_id: currentUser?.id || '00000000-0000-0000-0000-000000000001',
            policy_id: policyId,
            review_status: 'approved',
            communication_score: communicationScore,
            responsibility_score: responsibilityScore,
            teamwork_score: teamworkScore,
            initiative_score: initiativeScore,
            professionalism_score: professionalismScore,
            total_weighted_score: totalWeighted,
            evidence_note: evidenceNote || 'Penilaian kinerja berkala oleh koordinator bidang.',
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'period_id,member_id' }
        )
        .select()
        .single();

      if (revErr) throw revErr;

      // Jalankan hitung skor otomatis via API
      await fetch('/api/evaluations/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId,
          memberId: selectedMember.id,
        }),
      });

      alert(`Penilaian kinerja untuk ${selectedMember.full_name} berhasil disimpan! Skor: ${totalWeighted}/60.`);
      setIsRatingModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan evaluasi: ' + (err.message || 'Periksa koneksi Supabase.'));
    } finally {
      setSavingReview(false);
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

      alert(`Kalkulasi selesai! Berhasil memproses ${resJson.totalProcessed} anggota panitia.`);
      fetchData();
    } catch (err: any) {
      alert('Error saat kalkulasi: ' + err.message);
    } finally {
      setCalculating(false);
    }
  };

  const isCoordinatorOrAdmin = currentUser?.system_role === 'admin' || currentUser?.system_role === 'coordinator';

  // Member's own evaluation
  const myEvaluation = finalEvaluations.find(e => e.member_id === currentUser?.id);

  // Filter evaluations
  const filteredEvaluations = finalEvaluations.filter(e => {
    const memberName = e.member?.full_name?.toLowerCase() || '';
    const memberCode = e.member?.member_code?.toLowerCase() || '';
    const matchSearch = memberName.includes(searchQuery.toLowerCase()) || memberCode.includes(searchQuery.toLowerCase());
    const matchField = fieldFilter === 'all' || e.member?.field_id === fieldFilter;
    const matchEligibility = eligibilityFilter === 'all' || e.certificate_eligibility_status === eligibilityFilter;
    return matchSearch && matchField && matchEligibility;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-400" />
            Evaluasi Kinerja & Rekapitulasi Nilai Akhir
          </h1>
          <p className="text-sm text-slate-400">
            Penilaian terbobot: 40% Sistem Objektif (Presensi, Ketepatan Waktu, Tugas) + 60% Koordinator Bidang (5 Rubrik). Ambang kelulusan: 75.00.
          </p>
        </div>

        {isCoordinatorOrAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCalculateAll}
              disabled={calculating}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-sm disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              {calculating ? 'Menghitung...' : 'Kalkulasi Skor Massal'}
            </button>
          </div>
        )}
      </div>

      {/* MEMBER VIEW: Banner Nilai Pribadi */}
      {currentUser?.system_role === 'member' && myEvaluation && (
        <Card className="p-6 bg-gradient-to-br from-navy-900 via-navy-950 to-brand-950/40 border-brand-500/30">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider block mb-1">
                Transkrip Capaian Kinerja Anda
              </span>
              <h2 className="text-xl font-bold text-white mb-1">
                {currentUser.full_name} ({currentUser.member_code})
              </h2>
              <p className="text-xs text-slate-400">
                Divisi: {currentUser.field?.field_name || 'Umum'} • Posisi: {currentUser.organization_position}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Total Nilai Akhir</span>
                <span className="text-3xl font-extrabold text-white">
                  {myEvaluation.final_score} <span className="text-sm font-normal text-slate-400">/ 100</span>
                </span>
              </div>

              <div className={`px-4 py-3 rounded-2xl border flex flex-col items-center justify-center ${
                myEvaluation.certificate_eligibility_status === 'eligible'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                <Award className="h-6 w-6 mb-1" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {myEvaluation.certificate_eligibility_status === 'eligible' ? 'LAYAK SERTIFIKAT' : 'BELUM LAYAK'}
                </span>
              </div>
            </div>
          </div>

          {/* Rincian Poin */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            <div className="bg-navy-950/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Presensi Kegiatan (Max 20)</span>
              <span className="text-base font-bold text-brand-300">{myEvaluation.attendance_points} Poin</span>
            </div>
            <div className="bg-navy-950/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Ketepatan Waktu (Max 10)</span>
              <span className="text-base font-bold text-teal-300">{myEvaluation.punctuality_points} Poin</span>
            </div>
            <div className="bg-navy-950/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Tugas Selesai (Max 10)</span>
              <span className="text-base font-bold text-accent-300">{myEvaluation.task_completion_points} Poin</span>
            </div>
            <div className="bg-navy-950/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Skor Koordinator (Max 60)</span>
              <span className="text-base font-bold text-amber-300">{myEvaluation.coordinator_score} Poin</span>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Link 
              href="/dashboard/clarifications"
              className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Merasa ada kekeliruan? Ajukan Sanggahan Nilai
            </Link>
          </div>
        </Card>
      )}

      {/* FILTER & SEARCH */}
      <Card className="p-4 bg-navy-900/60 border-slate-800">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama anggota, nomor panitia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-navy-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              className="bg-navy-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">Semua Divisi</option>
              {fields.map(f => (
                <option key={f.id} value={f.id}>{f.field_name}</option>
              ))}
            </select>

            <select
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="bg-navy-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">Semua Kelayakan</option>
              <option value="eligible">Layak Sertifikat (≥ 75)</option>
              <option value="ineligible">Belum Layak (&lt; 75)</option>
              <option value="pending">Sedang Dihitung</option>
            </select>
          </div>
        </div>
      </Card>

      {/* TABEL REKAP EVALUASI */}
      <Card className="bg-navy-900/60 border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Daftar Evaluasi Akhir Panitia ({filteredEvaluations.length})
          </h2>
          <span className="text-xs text-slate-400">
            Ambang Batas Kelulusan: <strong className="text-emerald-400">75.00 Poin</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Panitia</th>
                <th className="px-4 py-3">Divisi / Posisi</th>
                <th className="px-4 py-3 text-center">Skor Sistem (40)</th>
                <th className="px-4 py-3 text-center">Skor Koord (60)</th>
                <th className="px-4 py-3 text-center">Nilai Akhir (100)</th>
                <th className="px-4 py-3 text-center">Status Kelayakan</th>
                {isCoordinatorOrAdmin && <th className="px-4 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
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
                filteredEvaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{ev.member?.full_name || 'Panitia'}</div>
                      <div className="text-[10px] text-slate-400">{ev.member?.member_code}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-300">{ev.member?.field?.field_name || 'Umum'}</div>
                      <div className="text-[10px] text-slate-400">{ev.member?.organization_position}</div>
                    </td>

                    <td className="px-4 py-3.5 text-center font-medium text-brand-300">
                      {ev.system_score}
                      <span className="block text-[9px] text-slate-500">
                        (H:{ev.attendance_points} W:{ev.punctuality_points} T:{ev.task_completion_points})
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center font-medium text-amber-300">
                      {ev.coordinator_score}
                    </td>

                    <td className="px-4 py-3.5 text-center font-bold text-sm text-white">
                      {ev.final_score}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        ev.certificate_eligibility_status === 'eligible'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : ev.certificate_eligibility_status === 'ineligible'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {ev.certificate_eligibility_status === 'eligible' ? 'Layak Sertifikat' :
                         ev.certificate_eligibility_status === 'ineligible' ? 'Belum Layak' : 'Proses'}
                      </span>
                    </td>

                    {isCoordinatorOrAdmin && (
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedMember(ev.member || null);
                            setIsRatingModalOpen(true);
                          }}
                          className="text-xs bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 px-3 py-1.5 rounded-lg border border-brand-500/30 font-medium transition-colors"
                        >
                          Beri Nilai
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: Form Penilaian Rubrik Koordinator (5 Kriteria) */}
      <Modal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        title={`Evaluasi Kinerja: ${selectedMember?.full_name || 'Panitia'}`}
        description="Beri penilaian pada 5 rubrik kompetensi koordinator (Skala 1.0 - 5.0). Total bobot koordinator maksimal 60 poin."
      >
        <form onSubmit={handleSaveEvaluation} className="space-y-4">
          {/* Summary Box */}
          <div className="p-3 bg-navy-950 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block">Total Poin Terbobot Koordinator</span>
              <span className="text-xl font-bold text-amber-400">{currentWeightedTotal} / 60.00</span>
            </div>
            <span className="text-xs text-slate-400 text-right">
              Divisi: {selectedMember?.field?.field_name || 'Umum'}
            </span>
          </div>

          {/* Kriteria 1: Komunikasi Efektif (Bobot 15) */}
          <div className="bg-navy-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-white">
                1. Komunikasi Efektif & Koordinasi (Bobot: 15 Poin)
              </label>
              <span className="text-xs font-bold text-brand-400">
                {communicationScore.toFixed(1)} / 5.0 ({((communicationScore / 5) * 15).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Kelancaran respons di grup WA, kemampuan koordinasi antar divisi, dan kejelasan menyampaikan kendala.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={communicationScore}
              onChange={(e) => setCommunicationScore(parseFloat(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>

          {/* Kriteria 2: Tanggung Jawab & Disiplin (Bobot 15) */}
          <div className="bg-navy-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-white">
                2. Tanggung Jawab & Disiplin Tugas (Bobot: 15 Poin)
              </label>
              <span className="text-xs font-bold text-brand-400">
                {responsibilityScore.toFixed(1)} / 5.0 ({((responsibilityScore / 5) * 15).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Komitmen menyelesaikan jobdesk tepat waktu tanpa harus ditegur berulang kali oleh koordinator.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={responsibilityScore}
              onChange={(e) => setResponsibilityScore(parseFloat(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>

          {/* Kriteria 3: Kerjasama Tim (Bobot 10) */}
          <div className="bg-navy-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-white">
                3. Kerjasama Tim & Solidaritas (Bobot: 10 Poin)
              </label>
              <span className="text-xs font-bold text-brand-400">
                {teamworkScore.toFixed(1)} / 5.0 ({((teamworkScore / 5) * 10).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Kemauan saling bantu sesama panitia lintas divisi di saat genting/persiapan teknis venue.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={teamworkScore}
              onChange={(e) => setTeamworkScore(parseFloat(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>

          {/* Kriteria 4: Inisiatif & Kreativitas (Bobot 10) */}
          <div className="bg-navy-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-white">
                4. Inisiatif & Pemecahan Masalah (Bobot: 10 Poin)
              </label>
              <span className="text-xs font-bold text-brand-400">
                {initiativeScore.toFixed(1)} / 5.0 ({((initiativeScore / 5) * 10).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Proaktif mencari solusi alternatif saat terjadi hambatan lapangan tanpa menunggu instruksi kaku.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={initiativeScore}
              onChange={(e) => setInitiativeScore(parseFloat(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>

          {/* Kriteria 5: Profesionalisme & Sikap (Bobot 10) */}
          <div className="bg-navy-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-white">
                5. Sikap, Etika & Nilai Budaya GenRe (Bobot: 10 Poin)
              </label>
              <span className="text-xs font-bold text-brand-400">
                {professionalismScore.toFixed(1)} / 5.0 ({((professionalismScore / 5) * 10).toFixed(1)} Pts)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Kesantunan berinteraksi dengan mitra, dewan juri, peserta duta, dan sesama panitia organisasi.
            </p>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={professionalismScore}
              onChange={(e) => setProfessionalismScore(parseFloat(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>

          {/* Catatan Pembuktian */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Catatan Pembuktian / Keterangan Kualitatif
            </label>
            <textarea
              rows={2}
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              placeholder="Contoh: Sangat aktif membantu persiapan venue gladi bersih, responsif dan sigap."
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsRatingModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingReview}
              className="px-4 py-2 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-xl disabled:opacity-50 transition-colors"
            >
              {savingReview ? 'Menyimpan...' : 'Simpan Nilai & Sinkronkan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Fallback Mock Data
function getFallbackEvaluations(): FinalEvaluation[] {
  return [
    {
      id: 'eval-1',
      period_id: 'p-1',
      member_id: 'mem-1',
      policy_id: 'pol-1',
      attendance_points: 20.00,
      punctuality_points: 10.00,
      task_completion_points: 10.00,
      system_score: 40.00,
      coordinator_score: 56.50,
      final_score: 96.50,
      evaluation_status: 'approved',
      certificate_eligibility_status: 'eligible',
      calculated_at: '2026-10-11T12:00:00+08:00',
      created_at: '',
      updated_at: '',
      member: {
        id: 'mem-1',
        member_code: 'GENRE-001',
        full_name: 'Gede Arya Swastika',
        email: 'ketua@genre.org',
        organization_position: 'Ketua Panitia',
        system_role: 'admin',
        account_status: 'active',
        joined_at: '',
        created_at: '',
        updated_at: '',
        field: {
          id: 'f-1',
          period_id: 'p-1',
          field_name: 'Badan Pengurus Harian (BPH)',
          field_code: 'BPH',
          field_status: 'active',
          created_at: '',
          updated_at: '',
        },
      },
    },
    {
      id: 'eval-2',
      period_id: 'p-1',
      member_id: 'mem-2',
      policy_id: 'pol-1',
      attendance_points: 18.00,
      punctuality_points: 8.50,
      task_completion_points: 10.00,
      system_score: 36.50,
      coordinator_score: 52.00,
      final_score: 88.50,
      evaluation_status: 'approved',
      certificate_eligibility_status: 'eligible',
      calculated_at: '2026-10-11T12:00:00+08:00',
      created_at: '',
      updated_at: '',
      member: {
        id: 'mem-2',
        member_code: 'GENRE-003',
        full_name: 'Ni Kadek Ayu Lestari',
        email: 'ayu.lestari@genre.org',
        organization_position: 'Koordinator Acara',
        system_role: 'coordinator',
        account_status: 'active',
        joined_at: '',
        created_at: '',
        updated_at: '',
        field: {
          id: 'f-2',
          period_id: 'p-1',
          field_name: 'Bidang Acara & Protokoler',
          field_code: 'ACARA',
          field_status: 'active',
          created_at: '',
          updated_at: '',
        },
      },
    },
    {
      id: 'eval-3',
      period_id: 'p-1',
      member_id: 'mem-3',
      policy_id: 'pol-1',
      attendance_points: 15.00,
      punctuality_points: 6.00,
      task_completion_points: 8.00,
      system_score: 29.00,
      coordinator_score: 48.00,
      final_score: 77.00,
      evaluation_status: 'approved',
      certificate_eligibility_status: 'eligible',
      calculated_at: '2026-10-11T12:00:00+08:00',
      created_at: '',
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
    {
      id: 'eval-4',
      period_id: 'p-1',
      member_id: 'mem-4',
      policy_id: 'pol-1',
      attendance_points: 10.00,
      punctuality_points: 4.00,
      task_completion_points: 6.00,
      system_score: 20.00,
      coordinator_score: 42.00,
      final_score: 62.00,
      evaluation_status: 'needs_revision',
      certificate_eligibility_status: 'ineligible',
      calculated_at: '2026-10-11T12:00:00+08:00',
      created_at: '',
      updated_at: '',
      member: {
        id: 'mem-4',
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
  ];
}
