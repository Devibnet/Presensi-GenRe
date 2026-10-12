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

export default function CertificatesPage() {
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
          .select('*, field:fields(*)')
          .eq('id', user.id)
          .single();
        if (p) {
          currentProf = p as any;
          setCurrentUser(currentProf);
        }
      }

      // 2. Fetch Final Evaluations that are eligible or have certificates
      const { data: evalsData, error: evalsErr } = await supabase
        .from('final_evaluations')
        .select(`
          *,
          member:profiles(
            *,
            field:fields(*)
          ),
          certificate:certificates(*)
        `)
        .order('final_score', { ascending: false });

      if (!evalsErr && evalsData && evalsData.length > 0) {
        setEvaluations(evalsData as any);
      } else {
        setEvaluations(getFallbackEvaluations());
      }
    } catch (err) {
      console.error(err);
      setEvaluations(getFallbackEvaluations());
    } finally {
      setLoading(false);
    }
  };

  // Terbitkan Sertifikat Resmi (Admin)
  const handleIssueCertificate = async (evaluation: FinalEvaluation) => {
    if (!evaluation.member) return;

    setIssuing(true);
    try {
      // Generate nomor sertifikat unik
      const certSeq = Math.floor(100 + Math.random() * 900);
      const certNumber = `018/GENRE-BL/SERT/X/2026/${certSeq}`;

      const { data: newCert, error } = await supabase
        .from('certificates')
        .insert({
          final_evaluation_id: evaluation.id,
          certificate_number: certNumber,
          certificate_status: 'issued',
          issued_at: new Date().toISOString(),
          issued_by: currentUser?.id,
        })
        .select()
        .single();

      if (error) throw error;

      alert(`Sertifikat resmi berhasil diterbitkan untuk ${evaluation.member.full_name} dengan nomor: ${certNumber}!`);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Gagal menerbitkan sertifikat: ' + (err.message || 'Periksa koneksi Supabase.'));
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
    const isEligible = e.certificate_eligibility_status === 'eligible';

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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            Sertifikat Kelulusan Panitia GenRe
          </h1>
          <p className="text-sm text-slate-400">
            Penetapan kelayakan dan penerbitan sertifikat digital resmi Pemilihan Duta GenRe Kabupaten Buleleng 2026.
          </p>
        </div>
      </div>

      {/* MEMBER VIEW: Banner Sertifikat Pribadi */}
      {currentUser?.system_role === 'member' && myEval && (
        <Card className="p-6 bg-gradient-to-br from-navy-900 via-navy-950 to-brand-950/40 border-amber-500/30">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                Status Sertifikasi Kepanitiaan
              </span>
              <h2 className="text-xl font-bold text-white mb-1">
                {currentUser.full_name} ({currentUser.member_code})
              </h2>
              <p className="text-xs text-slate-400">
                Nilai Akhir: <strong className="text-white">{myEval.final_score} / 100</strong> • Status: {' '}
                <strong className={myEval.certificate_eligibility_status === 'eligible' ? 'text-emerald-400' : 'text-rose-400'}>
                  {myEval.certificate_eligibility_status === 'eligible' ? 'MEMENUHI SYARAT (LAYAK)' : 'BELUM MEMENUHI AMBANG BATAS'}
                </strong>
              </p>
            </div>

            <div>
              {myEval.certificate ? (
                <button
                  onClick={() => handleOpenCertificate(myEval)}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all text-sm"
                >
                  <Award className="h-4 w-4" />
                  Lihat & Unduh Sertifikat Resmi
                </button>
              ) : myEval.certificate_eligibility_status === 'eligible' ? (
                <div className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl">
                  Sertifikat Anda sedang dalam proses pengesahan tanda tangan BPH.
                </div>
              ) : (
                <div className="text-xs bg-rose-500/10 text-rose-300 border border-rose-500/30 px-3 py-2 rounded-xl">
                  Nilai akumulasi Anda di bawah 75.00. Hubungi koordinator untuk klarifikasi.
                </div>
              )}
            </div>
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
              placeholder="Cari nama panitia, nomor sertifikat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-navy-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-navy-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
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
      <Card className="bg-navy-900/60 border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Kelayakan & Penerbitan Sertifikat ({filteredEvaluations.length})
          </h2>
          <span className="text-xs text-slate-400">
            Syarat Kelulusan: Nilai Akhir ≥ 75.00
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Panitia</th>
                <th className="px-4 py-3">Divisi / Jabatan</th>
                <th className="px-4 py-3 text-center">Nilai Akhir</th>
                <th className="px-4 py-3 text-center">Status Kelayakan</th>
                <th className="px-4 py-3">Nomor Registrasi Sertifikat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
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
                  const isEligible = ev.certificate_eligibility_status === 'eligible';

                  return (
                    <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white">{ev.member?.full_name || 'Panitia'}</div>
                        <div className="text-[10px] text-slate-400">{ev.member?.member_code}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-slate-300">{ev.member?.field?.field_name || 'BPH'}</div>
                        <div className="text-[10px] text-slate-400">{ev.member?.organization_position}</div>
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-sm text-white">
                        {ev.final_score}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          isEligible
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isEligible ? 'Layak Sertifikat' : 'Tidak Memenuhi Syarat'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                        {hasCert ? (
                          <span className="text-amber-400 font-medium">{ev.certificate?.certificate_number}</span>
                        ) : (
                          <span className="text-slate-500 italic">Belum Diterbitkan</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasCert ? (
                            <button
                              onClick={() => handleOpenCertificate(ev)}
                              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Award className="h-3.5 w-3.5" />
                              Lihat Sertifikat
                            </button>
                          ) : isEligible && isAdmin ? (
                            <button
                              onClick={() => handleIssueCertificate(ev)}
                              disabled={issuing}
                              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            >
                              Sahkan & Terbitkan
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">-</span>
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
            className="relative bg-gradient-to-b from-slate-950 via-navy-950 to-slate-950 border-4 border-amber-500/40 rounded-2xl p-8 text-center shadow-2xl text-slate-100 overflow-hidden"
          >
            {/* Elegant Background Accents */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Ornaments */}
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>

            <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest mb-1">
              FORUM GENERASI BERENCANA (GENRE) KABUPATEN BULELENG
            </p>
            <h2 className="text-2xl font-serif font-black tracking-wide text-white uppercase mb-1">
              SERTIFIKAT PENGHARGAAN
            </h2>
            <p className="text-xs font-mono text-slate-400 mb-6">
              Nomor Registrasi: {activeCertNumber}
            </p>

            <p className="text-xs text-slate-300 italic mb-2">
              Diberikan dengan penuh hormat dan apresiasi setinggi-tingginya kepada:
            </p>

            <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mb-2">
              {activeCertEval?.member?.full_name || 'Panitia GenRe'}
            </h3>

            <p className="text-xs text-slate-300 mb-6 max-w-md mx-auto leading-relaxed">
              Atas dedikasi, kedisiplinan, dan integritas tinggi sebagai{' '}
              <strong className="text-white">{activeCertEval?.member?.organization_position || 'Panitia Pelaksana'}</strong>{' '}
              dalam menyukseskan agenda <strong className="text-brand-300">Pemilihan Duta GenRe Kabupaten Buleleng Tahun 2026</strong>.
            </p>

            {/* Predikat & Nilai Akhir */}
            <div className="inline-block bg-slate-900/80 border border-amber-500/30 rounded-xl px-5 py-2.5 mb-8">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Predikat Kinerja Organisasi
              </span>
              <span className="text-lg font-bold text-emerald-400">
                {activeCertEval && activeCertEval.final_score >= 90 ? 'Sangat Memuaskan (A)' : 'Memuaskan (B)'}
              </span>
              <span className="text-xs text-slate-400 block font-mono">
                Akumulasi Nilai: {activeCertEval?.final_score} / 100.00
              </span>
            </div>

            {/* Tanda Tangan & QR Code */}
            <div className="grid grid-cols-3 items-end gap-4 pt-4 border-t border-slate-800/80 text-xs">
              <div>
                <p className="text-[10px] text-slate-400 mb-10">Ketua Panitia Pelaksana,</p>
                <p className="font-bold text-white underline decoration-amber-500/60">Gede Arya Swastika</p>
                <p className="text-[9px] text-slate-400">Duta GenRe Buleleng</p>
              </div>

              <div className="flex flex-col items-center">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Validasi Sertifikat" className="w-16 h-16 rounded-lg border border-slate-800" />
                )}
                <span className="text-[8px] font-mono text-slate-500 mt-1">E-Verification Valid</span>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 mb-10">Pembina Forum GenRe Buleleng,</p>
                <p className="font-bold text-white underline decoration-amber-500/60">Dinas PPKBPPPA Buleleng</p>
                <p className="text-[9px] text-slate-400">Pemerintah Kab. Buleleng</p>
              </div>
            </div>
          </div>

          {/* Action Print & Download */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsViewerOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
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
      certificate: {
        id: 'cert-1',
        final_evaluation_id: 'eval-1',
        certificate_number: '018/GENRE-BL/SERT/X/2026/001',
        certificate_status: 'issued',
        issued_at: '2026-10-11T14:00:00+08:00',
        created_at: '',
        updated_at: '',
      },
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
      certificate: {
        id: 'cert-2',
        final_evaluation_id: 'eval-2',
        certificate_number: '018/GENRE-BL/SERT/X/2026/002',
        certificate_status: 'issued',
        issued_at: '2026-10-11T14:00:00+08:00',
        created_at: '',
        updated_at: '',
      },
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
      certificate: null,
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
