'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  Users,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Key,
  FileCheck2,
  FileX,
  FileMinus,
  Sparkles,
  Layers,
  Info,
  Check,
  ChevronRight,
} from 'lucide-react';
import { SystemRole } from '@/lib/types';

interface CsvRow {
  member_code: string;
  full_name: string;
  email: string;
  password?: string;
  phone_number?: string;
  field_code?: string;
  system_role?: string;
  organization_position?: string;
  // Computed client-side validation
  _status?: 'valid' | 'duplicate_email' | 'duplicate_code' | 'invalid';
  _statusMessage?: string;
  _resolvedFieldName?: string;
}

interface ImportResults {
  total: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  created: Array<{
    member_code: string;
    full_name: string;
    email: string;
    field_code?: string;
    field_name?: string;
    organization_position?: string;
  }>;
  skipped: Array<{
    member_code: string;
    full_name: string;
    email: string;
    reason?: string;
  }>;
  failed: Array<{
    member_code: string;
    full_name: string;
    email: string;
    reason?: string;
  }>;
}

export default function ImportMembersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  // State Pengguna & Autentikasi
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);

  // State Data Divisi & Anggota Eksisting untuk Pra-Validasi
  const [fields, setFields] = useState<Array<{ id: string; field_code: string; field_name: string }>>([]);
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());

  // State Berkas & Data Parsed
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPresetLoading, setIsPresetLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');
  const [fieldFilter, setFieldFilter] = useState('all');

  // State Proses & Konfirmasi
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [activeTab, setActiveTab] = useState<'created' | 'skipped' | 'failed'>('created');

  // 1. Periksa Otorisasi Admin & Muat Data Master
  useEffect(() => {
    checkAdminAuthAndLoadMaster();
  }, []);

  const checkAdminAuthAndLoadMaster = async () => {
    setAuthLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      setCurrentUserEmail(user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('system_role, account_status')
        .eq('id', user.id)
        .maybeSingle();

      const hasAdminAccess = Boolean(
        profile && profile.system_role === 'admin' && profile.account_status === 'active'
      );
      setIsAdmin(hasAdminAccess);

      if (hasAdminAccess) {
        // Muat daftar divisi
        const { data: fieldsData } = await supabase
          .from('fields')
          .select('id, field_code, field_name')
          .order('field_name', { ascending: true });

        if (fieldsData) setFields(fieldsData);

        // Muat data anggota eksisting untuk pra-validasi instan di browser
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('member_code, email');

        if (profilesData) {
          setExistingEmails(new Set(profilesData.map((p) => (p.email || '').toLowerCase().trim())));
          setExistingCodes(new Set(profilesData.map((p) => (p.member_code || '').toUpperCase().trim())));
        }
      }
    } catch (err: any) {
      toast.error('Kesalahan Memuat Data', err.message || 'Gagal memverifikasi akun admin');
      setIsAdmin(false);
    } finally {
      setAuthLoading(false);
    }
  };

  // Helper pemetaan nama divisi
  const getFieldNameByCode = (code?: string): string => {
    if (!code) return 'Panitia Inti';
    const cleanCode = code.toUpperCase().trim();
    const match = fields.find((f) => f.field_code.toUpperCase() === cleanCode);
    if (match) return match.field_name;

    // Fallback alias resmi Pemilihan Duta GenRe Buleleng 2026
    const aliasNames: Record<string, string> = {
      PNJ: 'Penanggung Jawab',
      KPT: 'Pimpinan Panitia',
      BEN: 'Bendahara Panitia',
      SEK: 'Sekretaris Panitia',
      ACR: 'Sie Acara',
      HMS: 'Sie Kesekretariatan dan Humas',
      KON: 'Sie Konsumsi dan Rohani',
      PER: 'Sie Perlengkapan, Tempat dan Keamanan',
      PUB: 'Sie Publikasi dan Dokumentasi',
      DAN: 'Sie Penggalian Dana',
      ILM: 'Sie Ilmiah dan Lomba',
      OFF: 'Sie Official Duta',
    };
    return aliasNames[cleanCode] || cleanCode;
  };

  // 2. Fungsi Validasi Baris Data
  const validateRows = (
    rawRows: any[],
    emailsDb: Set<string> = existingEmails,
    codesDb: Set<string> = existingCodes
  ): CsvRow[] => {
    const seenBatchEmails = new Set<string>();
    const seenBatchCodes = new Set<string>();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return rawRows.map((row) => {
      const email = (row.email || '').trim().toLowerCase();
      const code = (row.member_code || '').trim().toUpperCase();
      const fullName = (row.full_name || '').trim();
      const password = (row.password || '').toString().trim();
      const fieldCode = (row.field_code || '').trim().toUpperCase();
      const position = (row.organization_position || '').trim();

      const resolvedFieldName = getFieldNameByCode(fieldCode);

      // Cek Invalid Format
      if (!email || !emailRegex.test(email)) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'invalid',
          _statusMessage: 'Format email tidak valid atau kosong',
          _resolvedFieldName: resolvedFieldName,
        };
      }

      if (!fullName || fullName.length < 2) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'invalid',
          _statusMessage: 'Nama lengkap minimal 2 karakter',
          _resolvedFieldName: resolvedFieldName,
        };
      }

      if (!code) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'invalid',
          _statusMessage: 'Kode anggota kosong',
          _resolvedFieldName: resolvedFieldName,
        };
      }

      if (!password || password.length < 6) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'invalid',
          _statusMessage: 'Password minimal 6 karakter',
          _resolvedFieldName: resolvedFieldName,
        };
      }

      // Cek Duplikat dalam file itu sendiri
      if (seenBatchEmails.has(email)) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'duplicate_email',
          _statusMessage: 'Email duplikat di dalam berkas CSV',
          _resolvedFieldName: resolvedFieldName,
        };
      }
      seenBatchEmails.add(email);

      if (seenBatchCodes.has(code)) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'duplicate_code',
          _statusMessage: 'Kode anggota duplikat di dalam berkas CSV',
          _resolvedFieldName: resolvedFieldName,
        };
      }
      seenBatchCodes.add(code);

      // Cek terhadap Database
      if (emailsDb.has(email)) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'duplicate_email',
          _statusMessage: 'Sudah terdaftar di database (akan dilewati demi idempotensi)',
          _resolvedFieldName: resolvedFieldName,
        };
      }

      if (codesDb.has(code)) {
        return {
          ...row,
          member_code: code,
          full_name: fullName,
          email,
          _status: 'duplicate_code',
          _statusMessage: `Kode anggota ${code} sudah terpakai di database`,
          _resolvedFieldName: resolvedFieldName,
        };
      }

      // Penetapan role berdasarkan jabatan resmi
      let computedRole: 'admin' | 'coordinator' | 'member' = 'member';
      const posLower = position.toLowerCase();
      const emailLower = email.toLowerCase();
      if (
        emailLower === 'angga@genrebuleleng.org' ||
        posLower === 'penanggung jawab' ||
        emailLower === 'sukkun@genrebuleleng.org' ||
        (posLower.includes('ketua panitia') && !posLower.includes('wakil'))
      ) {
        computedRole = 'admin';
      } else if (posLower.startsWith('koordinator') || posLower.includes('koordinator sie')) {
        computedRole = 'coordinator';
      } else {
        computedRole = 'member';
      }

      return {
        ...row,
        member_code: code,
        full_name: fullName,
        email,
        system_role: computedRole,
        _status: 'valid',
        _statusMessage: 'Siap dibuat sebagai akun panitia baru',
        _resolvedFieldName: resolvedFieldName,
      };
    });
  };

  // 3. Muat Berkas Preset: akun_panitia_genre_buleleng_2026.csv
  const loadPresetFile = async () => {
    setIsPresetLoading(true);
    setImportResults(null);
    try {
      const res = await fetch('/api/auth/members/import-csv/preset');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat berkas preset CSV');
      }

      if (Array.isArray(data.data)) {
        const validated = validateRows(data.data);
        setParsedRows(validated);
        setSelectedFile(null); // Menandakan menggunakan preset resmi
        toast.success(
          'Berkas Panitia GenRe 2026 Berhasil Dimuat',
          `${validated.length} data panitia siap diperiksa dan diimpor.`
        );
      }
    } catch (err: any) {
      toast.error('Gagal Memuat Preset', err.message);
    } finally {
      setIsPresetLoading(false);
    }
  };

  // 4. Penanganan Unggah Berkas Manual (CSV & Excel)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResults(null);

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
          const validated = validateRows(json);
          setParsedRows(validated);
          toast.success('File Excel Berhasil Dibaca', `${validated.length} baris data ditemukan.`);
        } catch (err: any) {
          toast.error('Gagal Membaca File Excel', err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const validated = validateRows(results.data);
          setParsedRows(validated);
          toast.success('File CSV Berhasil Dibaca', `${validated.length} baris data ditemukan.`);
        },
        error: (err) => {
          toast.error('Gagal Membaca Berkas CSV', err.message);
        },
      });
    }
  };

  // 5. Eksekusi Impor Akun ke Supabase Auth & Profiles
  const executeImport = async () => {
    if (parsedRows.length === 0) return;
    setIsConfirmModalOpen(false);
    setIsImporting(true);
    setImportResults(null);

    try {
      // Kirim seluruh baris ke endpoint backend aman
      const payload = {
        members: parsedRows.map((r) => ({
          member_code: r.member_code,
          full_name: r.full_name,
          email: r.email,
          password: r.password,
          phone_number: r.phone_number,
          field_code: r.field_code,
          system_role: 'member', // Sesuai Ketentuan 8
          organization_position: r.organization_position,
        })),
      };

      const response = await fetch('/api/auth/members/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses impor di server.');
      }

      setImportResults(data.results);

      // Refresh data database agar pra-validasi terupdate
      checkAdminAuthAndLoadMaster();

      toast.success(
        'Proses Impor Selesai',
        `Berhasil membuat ${data.results?.successCount || 0} akun panitia baru. ${
          data.results?.skippedCount || 0
        } dilewati, ${data.results?.failedCount || 0} gagal.`
      );
    } catch (err: any) {
      toast.error('Gagal Menjalankan Impor', err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // 6. Template Downloaders
  const downloadTemplateCsv = () => {
    const headers =
      'member_code,full_name,email,password,phone_number,field_code,system_role,organization_position\n';
    const sample =
      'GENRE-023,Ida Bagus Angga Prabaswara,angga@genrebuleleng.org,angga2026,,PNJ,member,Penanggung Jawab\n' +
      'GENRE-024,Sukkun Siregar,sukkun@genrebuleleng.org,sukkun2026,,KPT,member,Ketua Panitia\n' +
      'GENRE-028,Elena Gloria Velerie,elena@genrebuleleng.org,elena2026,,ACR,member,Koordinator Sie Acara\n';
    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_akun_panitia_genre.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 7. Unduh Laporan Rekapitulasi Hasil Impor
  const downloadResultsCsv = () => {
    if (!importResults) return;
    const lines: string[] = ['Kategori,Kode Anggota,Nama Lengkap,Email,Divisi/Jabatan,Keterangan'];

    importResults.created.forEach((c) => {
      lines.push(
        `Berhasil,${c.member_code},"${c.full_name}",${c.email},"${c.field_name || ''} - ${
          c.organization_position || ''
        }",Akun berhasil dibuat dan profil tersimpan`
      );
    });

    importResults.skipped.forEach((s) => {
      lines.push(
        `Dilewati,${s.member_code},"${s.full_name}",${s.email},"-","${s.reason || 'Sudah terdaftar'}"`
      );
    });

    importResults.failed.forEach((f) => {
      lines.push(
        `Gagal,${f.member_code},"${f.full_name}",${f.email},"-","${f.reason || 'Error validasi'}"`
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_impor_panitia_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filtered Rows untuk Tabel Pratinjau
  const filteredRows = parsedRows.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.full_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.member_code.toLowerCase().includes(q) ||
      (r.organization_position || '').toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'valid') matchesStatus = r._status === 'valid';
    else if (statusFilter === 'duplicate')
      matchesStatus = r._status === 'duplicate_email' || r._status === 'duplicate_code';
    else if (statusFilter === 'invalid') matchesStatus = r._status === 'invalid';

    let matchesField = true;
    if (fieldFilter !== 'all') {
      matchesField = (r.field_code || '').toUpperCase() === fieldFilter.toUpperCase();
    }

    return matchesSearch && matchesStatus && matchesField;
  });

  const validCount = parsedRows.filter((r) => r._status === 'valid').length;
  const duplicateCount = parsedRows.filter(
    (r) => r._status === 'duplicate_email' || r._status === 'duplicate_code'
  ).length;
  const invalidCount = parsedRows.filter((r) => r._status === 'invalid').length;

  // Jika memuat status otentikasi
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Memverifikasi hak akses administratif...</p>
      </div>
    );
  }

  // Jika bukan admin
  if (isAdmin === false) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="text-center p-8 border-rose-200 bg-rose-50/40">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Akses Terbatas: Hanya Admin</h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Halaman impor massal dan pembuatan akun Supabase Auth panitia hanya dapat diakses oleh akun
            dengan peran <strong>Admin</strong> aktif. Akun Anda saat ini ({currentUserEmail || 'Tamu'})
            tidak memiliki izin untuk menjalankan operasi administratif ini.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dashboard/members"
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
            >
              Kembali ke Daftar Panitia
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ============================================================================== */}
      {/* 1. HEADER & BREADCRUMBS */}
      {/* ============================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 font-medium">
            <Link href="/dashboard" className="hover:text-teal-600 transition-colors">
              Ikhtisar
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <Link href="/dashboard/members" className="hover:text-teal-600 transition-colors">
              Panitia & Divisi
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-teal-700 font-semibold">Impor & Pembuatan Akun Otomatis</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Impor Akun Panitia GenRe 2026</span>
            <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold tracking-wide">
              Admin Supabase Auth
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pendaftaran massal akun panitia resmi Pemilihan Duta GenRe Kabupaten Buleleng Tahun 2026/2027
            langsung ke Supabase Authentication dan tabel profil.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/members"
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Kembali ke Panitia</span>
          </Link>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 2. SECURITY & COMPLIANCE NOTICE BANNER */}
      {/* ============================================================================== */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-bold text-sm tracking-tight text-white">
                Sistem Otentikasi Terproteksi & Idempoten
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Setiap baris CSV diproses secara administratif melalui backend Supabase Service Role. Seluruh
              akun panitia otomatis menerima peran <code className="text-emerald-300 bg-white/10 px-1 py-0.5 rounded font-mono">member</code>, password diamankan via enkripsi Supabase Auth (tidak disimpan dalam teks terbuka), dan akun yang sudah terdaftar akan dilewati secara aman tanpa duplikasi.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={downloadTemplateCsv}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-white/80" />
              <span>Template CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 3. SUMBER DATA: PRESET RESMI ATAU UNGGAH MANUAL */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Tombol Cepat Berkas Resmi 2026 (Preset File) */}
        <Card className="lg:col-span-1 border-teal-300/80 bg-gradient-to-b from-teal-50/60 to-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Berkas Panitia Resmi 2026</h3>
                <span className="text-[10px] text-teal-700 font-medium">Tersedia di Server Sistem</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Gunakan langsung berkas <strong className="font-mono text-slate-800">akun_panitia_genre_buleleng_2026.csv</strong> yang telah disiapkan untuk kepanitiaan tahun 2026/2027 (42 panitia lengkap).
            </p>
          </div>

          <button
            onClick={loadPresetFile}
            disabled={isPresetLoading || isImporting}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-700 active:scale-98 disabled:opacity-50 text-white flex items-center justify-center gap-2 shadow-sm shadow-teal-600/30 transition-all cursor-pointer"
          >
            {isPresetLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memuat Berkas Resmi...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-4 h-4" />
                <span>Gunakan Berkas Resmi 2026</span>
              </>
            )}
          </button>
        </Card>

        {/* Card 2: Unggah Berkas Kustom (Drag & Drop / Input File) */}
        <Card className="lg:col-span-2 border-slate-200">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Unggah Berkas CSV / Excel Kustom</h3>
              <p className="text-[11px] text-slate-500">Mendukung berkas berekstensi .csv, .xlsx, dan .xls</p>
            </div>
            {selectedFile && (
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono text-[11px] font-semibold flex items-center gap-1 border border-emerald-200">
                <Check className="w-3 h-3" />
                {selectedFile.name}
              </span>
            )}
          </div>

          <div className="relative border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-teal-50/30 transition-colors">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-teal-700 hover:underline">Klik untuk pilih berkas</span>
                <span className="text-slate-500"> atau seret berkas CSV/Excel ke sini</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Kolom wajib: member_code, full_name, email, password, field_code, organization_position
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ============================================================================== */}
      {/* 4. STATISTIK PRA-VALIDASI (JIKA ADA DATA TERPILIH) */}
      {/* ============================================================================== */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Baris Data
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{parsedRows.length}</span>
                <span className="text-[11px] text-slate-400 font-medium">calon panitia</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Siap Dibuat (Baru)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-700">{validCount}</span>
                <span className="text-[11px] text-emerald-600 font-medium">akun baru</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block flex items-center gap-1.5">
                <FileMinus className="w-3.5 h-3.5 text-amber-600" />
                Dilewati (Eksisting)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-amber-700">{duplicateCount}</span>
                <span className="text-[11px] text-amber-600 font-medium">sudah ada di DB</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block flex items-center gap-1.5">
                <FileX className="w-3.5 h-3.5 text-rose-600" />
                Konflik / Format Tidak Valid
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-rose-700">{invalidCount}</span>
                <span className="text-[11px] text-rose-600 font-medium">butuh perbaikan</span>
              </div>
            </div>
          </div>

          {/* ============================================================================== */}
          {/* 5. TABEL PRATINJAU DATA & PENCARIAN */}
          {/* ============================================================================== */}
          <Card className="p-0 overflow-hidden border-slate-200">
            {/* Toolbar Filter Tabel */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan nama, email, kode, atau jabatan..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">Semua Status Validasi ({parsedRows.length})</option>
                  <option value="valid">Hanya Siap Dibuat ({validCount})</option>
                  <option value="duplicate">Hanya Dilewati ({duplicateCount})</option>
                  <option value="invalid">Hanya Tidak Valid ({invalidCount})</option>
                </select>

                {/* Divisi Filter */}
                <select
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">Semua Divisi / Seksi</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.field_code}>
                      {f.field_code} - {f.field_name}
                    </option>
                  ))}
                </select>

                {/* Tombol Eksekusi Impor */}
                <button
                  type="button"
                  disabled={validCount === 0 || isImporting}
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-teal-600/30 transition-all cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Jalankan Impor ({validCount} Akun Siap)</span>
                </button>
              </div>
            </div>

            {/* Tabel Baris Pratinjau */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 sticky top-0 z-10 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">No</th>
                    <th className="p-3">Kode Anggota</th>
                    <th className="p-3">Nama Lengkap</th>
                    <th className="p-3">Email Akun</th>
                    <th className="p-3">Password Awal</th>
                    <th className="p-3">Divisi / Seksi</th>
                    <th className="p-3">Jabatan Panitia</th>
                    <th className="p-3">Role Sistem</th>
                    <th className="p-3">Status Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Tidak ada baris panitia yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          row._status === 'valid'
                            ? ''
                            : row._status === 'duplicate_email' || row._status === 'duplicate_code'
                            ? 'bg-amber-50/30'
                            : 'bg-rose-50/30'
                        }`}
                      >
                        <td className="p-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-teal-800">{row.member_code}</td>
                        <td className="p-3 font-medium text-slate-900">{row.full_name}</td>
                        <td className="p-3 font-mono text-slate-600 text-[11px]">{row.email}</td>
                        <td className="p-3">
                          <span className="font-mono text-[11px] text-slate-400 tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                            ••••••••
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {row._resolvedFieldName || row.field_code}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">{row.organization_position || '-'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.system_role === 'admin'
                                ? 'bg-rose-100 text-rose-800'
                                : row.system_role === 'coordinator'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {row.system_role || 'member'}
                          </span>
                        </td>
                        <td className="p-3">
                          {row._status === 'valid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Siap Dibuat
                            </span>
                          )}
                          {(row._status === 'duplicate_email' || row._status === 'duplicate_code') && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"
                              title={row._statusMessage}
                            >
                              <FileMinus className="w-3 h-3" />
                              Dilewati ({row._status === 'duplicate_email' ? 'Email Ada' : 'Kode Ada'})
                            </span>
                          )}
                          {row._status === 'invalid' && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800"
                              title={row._statusMessage}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Error: {row._statusMessage}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex justify-between items-center">
              <span>Menampilkan {filteredRows.length} dari {parsedRows.length} data panitia</span>
              <span className="italic">
                * Password awal diproses langsung di Supabase Auth dan disembunyikan demi keamanan (Ketentuan 9).
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 6. MODAL KONFIRMASI SEBELUM EKSEKUSI IMPOR */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Konfirmasi Pembuatan Akun Panitia Otomatis"
        description="Harap verifikasi ringkasan aksi sebelum membuat akun autentikasi di Supabase Auth."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 space-y-2">
            <span className="font-bold text-xs text-teal-900 block">Ringkasan Eksekusi:</span>
            <ul className="text-xs text-teal-800 space-y-1">
              <li className="flex items-center justify-between">
                <span>Total Data yang Akan Diproses:</span>
                <strong className="font-mono">{parsedRows.length} panitia</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Akun Baru yang Akan Dibuat:</span>
                <strong className="font-mono text-emerald-700">{validCount} akun</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Akun Eksisting yang Akan Dilewati:</span>
                <strong className="font-mono text-amber-700">{duplicateCount} akun</strong>
              </li>
              {invalidCount > 0 && (
                <li className="flex items-center justify-between text-rose-700">
                  <span>Baris dengan Format Tidak Valid (Akan Gagal):</span>
                  <strong className="font-mono">{invalidCount} baris</strong>
                </li>
              )}
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] space-y-1.5">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <strong>Ketentuan Keamanan & Hak Akses:</strong>
                <p className="mt-0.5">
                  Seluruh akun panitia yang diimpor akan mendapatkan role sistem <strong>member</strong>. Hak
                  akses Admin eksisting tidak akan terpengaruh. Setiap akun dilengkapi bendera pergantian
                  password saat masuk pertama kali.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={executeImport}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-sm shadow-teal-600/30 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Ya, Jalankan Impor Akun Sekarang</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ============================================================================== */}
      {/* 7. HASIL AKHIR & REKAPITULASI IMPOR */}
      {/* ============================================================================== */}
      {importResults && (
        <Card className="border-emerald-300 bg-emerald-50/20 p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-200/80">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Hasil Akhir Impor Akun Panitia</h3>
                <p className="text-xs text-slate-600">
                  Operasi administratif Supabase Auth dan sinkronisasi database profiles selesai dilaksanakan.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadResultsCsv}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Unduh Laporan Rekap (.csv)</span>
              </button>
              <Link
                href="/dashboard/members"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm shadow-teal-600/25 flex items-center gap-1.5 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Buka Daftar Panitia</span>
              </Link>
            </div>
          </div>

          {/* Stat Cards Hasil */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs">
              <span className="text-xs font-bold text-emerald-800 uppercase block">Akun Berhasil Dibuat</span>
              <span className="text-3xl font-black text-emerald-700 mt-1 block">
                {importResults.successCount}
              </span>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">
                Tersimpan di Supabase Auth & Profil
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs">
              <span className="text-xs font-bold text-amber-800 uppercase block">Dilewati (Idempoten)</span>
              <span className="text-3xl font-black text-amber-700 mt-1 block">
                {importResults.skippedCount}
              </span>
              <span className="text-[11px] text-amber-600 mt-0.5 block">
                Sudah terdaftar / dicegah dari duplikasi
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-rose-200 shadow-xs">
              <span className="text-xs font-bold text-rose-800 uppercase block">Gagal / Ditolak</span>
              <span className="text-3xl font-black text-rose-700 mt-1 block">
                {importResults.failedCount}
              </span>
              <span className="text-[11px] text-rose-600 mt-0.5 block">
                Format atau constraint tidak valid
              </span>
            </div>
          </div>

          {/* Tab Navigasi Rincian Hasil */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('created')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'created'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Berhasil Dibuat ({importResults.created.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('skipped')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'skipped'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Dilewati ({importResults.skipped.length})
              </button>
              {importResults.failed.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('failed')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'failed'
                      ? 'border-rose-600 text-rose-700'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Gagal ({importResults.failed.length})
                </button>
              )}
            </div>

            {/* Konten Tab: Berhasil Dibuat */}
            {activeTab === 'created' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="p-2.5">Kode</th>
                      <th className="p-2.5">Nama Lengkap</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Divisi</th>
                      <th className="p-2.5">Jabatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importResults.created.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          Tidak ada akun baru yang dibuat pada proses ini.
                        </td>
                      </tr>
                    ) : (
                      importResults.created.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-teal-700">{c.member_code}</td>
                          <td className="p-2.5 font-medium text-slate-900">{c.full_name}</td>
                          <td className="p-2.5 font-mono text-slate-600 text-[11px]">{c.email}</td>
                          <td className="p-2.5 text-slate-600">{c.field_name || '-'}</td>
                          <td className="p-2.5 text-slate-600">{c.organization_position || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Konten Tab: Dilewati */}
            {activeTab === 'skipped' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="p-2.5">Kode</th>
                      <th className="p-2.5">Nama Lengkap</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Alasan Dilewati</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importResults.skipped.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">
                          Tidak ada akun yang dilewati.
                        </td>
                      </tr>
                    ) : (
                      importResults.skipped.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-500">{s.member_code}</td>
                          <td className="p-2.5 font-medium text-slate-900">{s.full_name}</td>
                          <td className="p-2.5 font-mono text-slate-600 text-[11px]">{s.email}</td>
                          <td className="p-2.5 text-amber-700 font-medium">{s.reason || 'Akun sudah terdaftar'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Konten Tab: Gagal */}
            {activeTab === 'failed' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="p-2.5">Kode</th>
                      <th className="p-2.5">Nama Lengkap</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Penyebab Kegagalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importResults.failed.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-rose-700">{f.member_code}</td>
                        <td className="p-2.5 font-medium text-slate-900">{f.full_name}</td>
                        <td className="p-2.5 font-mono text-slate-600 text-[11px]">{f.email}</td>
                        <td className="p-2.5 text-rose-700 font-semibold">{f.reason || 'Kesalahan sistem'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
