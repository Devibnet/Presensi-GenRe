'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  Award, 
  CheckCircle2, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  ShieldCheck, 
  AlertCircle, 
  Calendar, 
  ExternalLink,
  Sparkles,
  QrCode
} from 'lucide-react';
import { Certificate, FinalEvaluation, Profile } from '@/lib/types';
import { formatDateWITA, getStatusBadgeClass } from '@/lib/utils';
import QRCode from 'qrcode';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';

export default function CertificatesPage() {
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<FinalEvaluation[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal Certificate Viewer
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeCertEval, setActiveCertEval] = useState<FinalEvaluation | null>(null);
  const [activeCertNumber, setActiveCertNumber] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Issuing state
  const [issuing, setIssuing] = useState(false);

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

      // 2. Fetch Final Evaluations that are eligible or have certificates
      let fetched = false;
      try {
        const res = await fetch('/api/certificates');
        const json = await res.json();
        if (res.ok && json.data) {
          setEvaluations(json.data);
          fetched = true;
        }
      } catch (apiErr) {
        console.warn('GET /api/certificates failed, trying direct supabase:', apiErr);
      }

      if (!fetched) {
        const { data: evalsData, error: evalsErr } = await supabase
          .from('final_evaluations')
          .select(`
            *,
            member:profiles!final_evaluations_member_id_fkey(
              *,
              field:fields!profiles_field_id_fkey(*)
            ),
            certificate:certificates(*)
          `)
          .order('final_score', { ascending: false });

        if (!evalsErr && evalsData) {
          setEvaluations(evalsData as any);
        } else {
          console.error('Error fetching direct final_evaluations:', evalsErr);
          setEvaluations([]);
        }
      }
    } catch (err) {
      console.error('fetchData error:', err);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  // Terbitkan Sertifikat Resmi (Admin)
  const handleIssueCertificate = async (evaluation: FinalEvaluation) => {
    if (!evaluation.member) return;

    setIssuing(true);
    try {
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationId: evaluation.id,
          memberId: evaluation.member.id,
          memberCode: evaluation.member.member_code,
          email: evaluation.member.email,
          issuerId: currentUser?.id,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal menerbitkan sertifikat');
      }

      toast.success(
        'Sertifikat Berhasil Diterbitkan',
        `Nomor Sertifikat: ${result.certificateNumber} untuk ${evaluation.member.full_name}.`
      );

      // Kirim notifikasi in-app langsung ke penerima sertifikat
      sendInAppNotification({
        userId: evaluation.member.id,
        title: 'Sertifikat Kepanitiaan Resmi Diterbitkan!',
        message: `Selamat! Sertifikat resmi Anda telah diterbitkan dengan nomor: ${result.certificateNumber}. Silakan buka halaman Sertifikat untuk melihat dan mengunduh.`,
        notificationType: 'certificate',
        actionUrl: '/dashboard/certificates',
      });

      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Menerbitkan Sertifikat', err.message || 'Periksa koneksi database.');
    } finally {
      setIssuing(false);
    }
  };

  // Buka Modal Sertifikat Digital
  const handleOpenCertificate = async (evaluation: FinalEvaluation) => {
    setActiveCertEval(evaluation);
    const certNum = evaluation.certificate?.certificate_number || `018/GENRE-BL/SERT/X/2026/${Math.floor(100 + Math.random() * 900)}`;
    setActiveCertNumber(certNum);

    // Generate QR verification
    try {
      const verifyUrl = `https://genre-attendance.vercel.app/verify/cert/${encodeURIComponent(certNum)}`;
      const qrUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 140,
        color: { dark: '#0284c7', light: '#ffffff' }
      });
      setQrDataUrl(qrUrl);
    } catch (e) {
      console.error(e);
    }

    setIsViewerOpen(true);
  };

  // Cetak Sertifikat
  const handlePrint = () => {
    window.print();
  };

  const isAdmin = currentUser?.system_role === 'admin';
  const myEval = evaluations.find(e => e.member_id === currentUser?.id);

  // Filter
  const filteredEvaluations = evaluations.filter(e => {
    const name = e.member?.full_name?.toLowerCase() || '';
    const code = e.member?.member_code?.toLowerCase() || '';
    const certNum = e.certificate?.certificate_number?.toLowerCase() || '';
    const matchSearch = name.includes(searchQuery.toLowerCase()) || 
      code.includes(searchQuery.toLowerCase()) || 
      certNum.includes(searchQuery.toLowerCase());

    const isIssued = !!e.certificate;
    const finalScoreNum = Number(e.final_score || 0);
    const isScoreEligible = finalScoreNum >= 75;
    const isEligible = e.certificate_eligibility_status === 'eligible' || isScoreEligible;

    if (statusFilter === 'issued') return matchSearch && isIssued;
    if (statusFilter === 'eligible_unissued') return matchSearch && isEligible && !isIssued;
    if (statusFilter === 'ineligible') return matchSearch && !isEligible;
    return matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-500" />
            Sertifikat Kelulusan Panitia GenRe
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Penetapan kelayakan dan penerbitan sertifikat digital resmi Pemilihan Duta GenRe Kabupaten Buleleng 2026.
          </p>
        </div>
      </div>

      {/* MEMBER VIEW: Banner Sertifikat Pribadi */}
      {currentUser?.system_role === 'member' && myEval && (
        <Card className="p-5 sm:p-6 bg-gradient-to-br from-amber-50/60 via-teal-50/30 to-white border-amber-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
            <div>
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block mb-1">
                Status Sertifikasi Kepanitiaan
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                {currentUser.full_name} ({currentUser.member_code})
              </h2>
              <p className="text-xs text-slate-600">
                Nilai Akhir: <strong className="text-slate-900">{myEval.final_score} / 100</strong> • Status: {' '}
                <strong className={Number(myEval.final_score) >= 75 ? 'text-emerald-700' : 'text-rose-700'}>
                  {Number(myEval.final_score) >= 75 ? 'MEMENUHI SYARAT (LAYAK)' : 'BELUM MEMENUHI AMBANG BATAS'}
                </strong>
              </p>
            </div>

            <div>
              {myEval.certificate ? (
                <button
                  onClick={() => handleOpenCertificate(myEval)}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm shadow-amber-600/20 transition-all text-xs sm:text-sm"
                >
                  <Award className="h-4 w-4" />
                  Lihat & Unduh Sertifikat Resmi
                </button>
              ) : (Number(myEval.final_score) >= 75 || myEval.certificate_eligibility_status === 'eligible') ? (
                <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl font-medium">
                  Sertifikat Anda telah memenuhi syarat kelulusan dan siap diterbitkan oleh Pimpinan Panitia / Admin.
                </div>
              ) : (
                <div className="text-xs bg-rose-50 text-rose-800 border border-rose-200 px-3 py-2 rounded-xl font-medium">
                  Nilai akumulasi Anda di bawah 75.00. Hubungi koordinator untuk klarifikasi.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* FILTER & SEARCH */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama panitia, nomor sertifikat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="all">Semua Status</option>
              <option value="issued">Telah Diterbitkan</option>
              <option value="eligible_unissued">Layak (Belum Diterbitkan)</option>
              <option value="ineligible">Belum Memenuhi Syarat</option>
            </select>
          </div>
        </div>
      </Card>

      {/* DAFTAR KELAYAKAN SERTIFIKAT */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Kelayakan & Penerbitan Sertifikat ({filteredEvaluations.length})
          </h2>
          <span className="text-xs text-slate-500">
            Syarat Kelulusan: Nilai Akhir ≥ 75.00
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Panitia</th>
                <th className="px-4 py-3">Divisi / Jabatan</th>
                <th className="px-4 py-3 text-center">Nilai Akhir</th>
                <th className="px-4 py-3 text-center">Status Kelayakan</th>
                <th className="px-4 py-3">Nomor Registrasi Sertifikat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Memuat data sertifikat...
                  </td>
                </tr>
              ) : filteredEvaluations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Tidak ada data yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredEvaluations.map((ev) => {
                  const hasCert = !!ev.certificate;
                  const finalScoreNum = Number(ev.final_score || 0);
                  const isScorePassing = finalScoreNum >= 75;
                  const isEligible = ev.certificate_eligibility_status === 'eligible' || isScorePassing;
                  const isPending = !isScorePassing && (
                    ev.certificate_eligibility_status === 'pending' || 
                    ev.evaluation_status === 'calculating' || 
                    ev.evaluation_status === 'clarification_open'
                  );

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{ev.member?.full_name || 'Panitia'}</div>
                        <div className="text-[10px] text-teal-700 font-mono">{ev.member?.member_code}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-slate-800">{ev.member?.field?.field_name || '-'}</div>
                        <div className="text-[10px] text-slate-500">{ev.member?.organization_position}</div>
                      </td>

                      <td className="px-4 py-3.5 text-center font-extrabold text-sm text-slate-900">
                        {ev.final_score}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {isEligible ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Layak Sertifikat
                          </span>
                        ) : isPending ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Dalam Penilaian
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            Tidak Memenuhi Syarat
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-xs text-slate-700">
                        {hasCert ? (
                          <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{ev.certificate?.certificate_number}</span>
                        ) : (
                          <span className="text-slate-400 italic">Belum Diterbitkan</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasCert ? (
                            <button
                              onClick={() => handleOpenCertificate(ev)}
                              className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Award className="h-3.5 w-3.5" />
                              Lihat Sertifikat
                            </button>
                          ) : isEligible && isAdmin ? (
                            <button
                              onClick={() => handleIssueCertificate(ev)}
                              disabled={issuing}
                              className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                              Sahkan & Terbitkan
                            </button>
                          ) : isEligible ? (
                            <span className="text-[11px] text-emerald-700 font-medium">Siap Diterbitkan</span>
                          ) : isPending ? (
                            <span className="text-[11px] text-amber-700 font-medium">Menunggu Nilai</span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">-</span>
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

      {/* MODAL: INTERACTIVE OFFICIAL DIGITAL CERTIFICATE */}
      <Modal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        title="Dokumen Sertifikat Penghargaan Resmi"
        description="Format standar Forum Generasi Berencana (GenRe) Kabupaten Buleleng Tahun 2026."
      >
        <div className="space-y-4">
          {/* Certificate Container with Print Styles */}
          <div 
            id="certificate-print-area"
            className="relative bg-gradient-to-b from-amber-50/40 via-white to-amber-50/30 border-4 border-amber-500/60 rounded-2xl p-6 sm:p-8 text-center shadow-lg text-slate-900 overflow-hidden"
          >
            {/* Elegant Background Accents */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header Ornaments */}
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-white border border-amber-200/80 p-2 flex items-center justify-center shadow-xs">
                <img
                  src="/logo-genre.png"
                  alt="Logo GenRe Kabupaten Buleleng"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-widest mb-1">
              FORUM GENERASI BERENCANA (GENRE) KABUPATEN BULELENG
            </p>
            <h2 className="text-2xl font-serif font-black tracking-wide text-slate-900 uppercase mb-1">
              SERTIFIKAT PENGHARGAAN
            </h2>
            <p className="text-xs font-mono text-slate-500 mb-6">
              Nomor Registrasi: {activeCertNumber}
            </p>

            <p className="text-xs text-slate-600 italic mb-2">
              Diberikan dengan penuh hormat dan apresiasi setinggi-tingginya kepada:
            </p>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-800 mb-2">
              {activeCertEval?.member?.full_name || 'Panitia GenRe'}
            </h3>

            <p className="text-xs text-slate-700 mb-6 max-w-md mx-auto leading-relaxed">
              Atas dedikasi, kedisiplinan, dan integritas tinggi sebagai{' '}
              <strong className="text-slate-900 font-semibold">{activeCertEval?.member?.organization_position || 'Panitia Pelaksana'}</strong>{' '}
              dalam menyukseskan agenda <strong className="text-teal-800 font-semibold">Pemilihan Duta GenRe Kabupaten Buleleng Tahun 2026</strong>.
            </p>

            {/* Predikat & Nilai Akhir */}
            <div className="inline-block bg-white border border-amber-300 rounded-xl px-5 py-2.5 mb-8 shadow-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                Predikat Kinerja Organisasi
              </span>
              <span className="text-lg font-bold text-emerald-700">
                {activeCertEval && activeCertEval.final_score >= 90 ? 'Sangat Memuaskan (A)' : 'Memuaskan (B)'}
              </span>
              <span className="text-xs text-slate-600 block font-mono">
                Akumulasi Nilai: {activeCertEval?.final_score} / 100.00
              </span>
            </div>

            {/* Tanda Tangan & QR Code */}
            <div className="grid grid-cols-3 items-end gap-4 pt-4 border-t border-slate-200 text-xs">
              <div>
                <p className="text-[10px] text-slate-500 mb-10">Ketua Panitia Pelaksana,</p>
                <p className="font-bold text-slate-900 underline decoration-amber-500/60">Gede Arya Swastika</p>
                <p className="text-[9px] text-slate-500">Duta GenRe Buleleng</p>
              </div>

              <div className="flex flex-col items-center">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Validasi Sertifikat" className="w-16 h-16 rounded-lg border border-slate-200" />
                )}
                <span className="text-[8px] font-mono text-slate-500 mt-1">E-Verification Valid</span>
              </div>

              <div>
                <p className="text-[10px] text-slate-500 mb-10">Pembina Forum GenRe Buleleng,</p>
                <p className="font-bold text-slate-900 underline decoration-amber-500/60">Dinas PPKBPPPA Buleleng</p>
                <p className="text-[9px] text-slate-500">Pemerintah Kab. Buleleng</p>
              </div>
            </div>
          </div>

          {/* Action Print & Download */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsViewerOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors font-semibold"
            >
              <Printer className="h-4 w-4" />
              Cetak / Simpan PDF
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

