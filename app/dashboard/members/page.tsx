'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  Users, 
  UploadCloud, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  Mail,
  Phone,
  Building
} from 'lucide-react';
import Papa from 'papaparse';
import { Profile, Field } from '@/lib/types';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/utils';

export default function MembersPage() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedField, setSelectedField] = useState('all');
  const [userRole, setUserRole] = useState<'admin' | 'coordinator' | 'member'>('member');

  // Modal CSV State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Ambil Peran Pengguna Saat Ini
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('system_role')
          .eq('id', user.id)
          .single();
        if (currentProfile) {
          setUserRole(currentProfile.system_role);
        }
      }

      // 2. Ambil Daftar Bidang
      const { data: fieldsData } = await supabase
        .from('fields')
        .select('*')
        .order('field_name', { ascending: true });
      if (fieldsData) setFields(fieldsData);

      // 3. Ambil Daftar Panitia
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*, field:fields(*)')
        .order('full_name', { ascending: true });
      if (profilesData) setMembers(profilesData as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV File Selection & Parse
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedRows(results.data);
      },
      error: (error) => {
        alert('Gagal membaca berkas CSV: ' + error.message);
      },
    });
  };

  // Submit CSV ke Trusted Backend Route
  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    setImportLoading(true);
    setImportResult(null);

    try {
      const response = await fetch('/api/auth/members/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: parsedRows }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memproses impor CSV');
      }

      setImportResult(data);
      fetchData(); // Refresh list
    } catch (err: any) {
      alert('Error impor CSV: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const headers = 'member_code,full_name,email,password,phone_number,field_code,system_role,organization_position\n';
    const sample = 'GENRE-021,I Putu Bayu Pratama,bayu.panitia@genre-buleleng.org,GenRe2026!Buleleng,081234567899,ACR,member,Anggota Divisi Acara\nGENRE-022,Ni Komang Sukma Dewi,sukma.panitia@genre-buleleng.org,GenRe2026!Buleleng,081234567888,HMS,member,Anggota Divisi Humas';
    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_panitia_genre.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered members
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.member_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesField = selectedField === 'all' || m.field_id === selectedField;
    return matchesSearch && matchesField;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Manajemen Panitia & Divisi</h1>
          <p className="text-xs text-slate-400 mt-1">
            Direktori panitia Pemilihan Duta GenRe Kabupaten Buleleng 2026
          </p>
        </div>

        {userRole === 'admin' && (
          <button
            onClick={() => {
              setIsCsvModalOpen(true);
              setCsvFile(null);
              setParsedRows([]);
              setImportResult(null);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-genre-600 hover:bg-genre-500 transition-colors shadow-lg shadow-genre-500/20 flex items-center gap-2 self-start sm:self-auto"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Impor Akun Panitia (CSV)</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, kode anggota, atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-genre-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:ring-1 focus:ring-genre-400"
            >
              <option value="all">Semua Divisi</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.field_name} ({f.field_code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Members Table */}
      <Card title={`Daftar Panitia (${filteredMembers.length} Anggota)`}>
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-genre-500 border-t-transparent rounded-full animate-spin" />
            <span>Memuat direktori panitia...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Tidak ada panitia yang sesuai dengan kriteria pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Panitia</th>
                  <th className="py-3 px-4">Kontak</th>
                  <th className="py-3 px-4">Divisi & Posisi</th>
                  <th className="py-3 px-4">Hak Akses</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-genre-300">
                          {m.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{m.full_name}</span>
                          <span className="text-[11px] font-mono text-genre-400 block">{m.member_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{m.email}</span>
                        </div>
                        {m.phone_number && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{m.phone_number}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-white block">
                          {(m.field as any)?.field_name || 'Badan Pengurus Harian'}
                        </span>
                        <span className="text-[11px] text-slate-400 block">{m.organization_position}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getRoleBadgeClass(m.system_role)}`}>
                        {getRoleLabel(m.system_role)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge status={m.account_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Impor Akun Panitia Massal via CSV"
        description="Akun Supabase Auth dan profil akan dibuat secara aman melalui backend tepercaya."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-white block">Unduh Format CSV Resmi</span>
              <span className="text-slate-400 block text-[11px]">Gunakan kolom: member_code, full_name, email, password, field_code, system_role</span>
            </div>
            <button
              type="button"
              onClick={downloadCsvTemplate}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-genre-300 font-semibold border border-slate-700 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Pilih File CSV:</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-genre-600 file:text-white hover:file:bg-genre-500 file:cursor-pointer cursor-pointer border border-slate-800 rounded-xl p-2 bg-slate-900/60"
            />
          </div>

          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Pratinjau Data ({parsedRows.length} Calon Panitia):</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/80 p-2">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="p-1.5">Kode</th>
                      <th className="p-1.5">Nama</th>
                      <th className="p-1.5">Email</th>
                      <th className="p-1.5">Divisi</th>
                      <th className="p-1.5">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td className="p-1.5 font-mono">{row.member_code}</td>
                        <td className="p-1.5">{row.full_name}</td>
                        <td className="p-1.5">{row.email}</td>
                        <td className="p-1.5">{row.field_code || '-'}</td>
                        <td className="p-1.5">{row.system_role || 'member'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 5 && (
                  <p className="text-[10px] text-slate-500 text-center mt-2">
                    ...dan {parsedRows.length - 5} baris lainnya
                  </p>
                )}
              </div>
            </div>
          )}

          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <div className="flex items-center gap-2 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{importResult.message}</span>
              </div>
              {importResult.results?.errors?.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-rose-300 text-[11px] space-y-0.5">
                  {importResult.results.errors.map((e: any, i: number) => (
                    <li key={i}>{e.email}: {e.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0 || importLoading}
              onClick={handleImportSubmit}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-genre-600 hover:bg-genre-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses Impor...</span>
                </>
              ) : (
                <span>Mulai Impor Akun</span>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
