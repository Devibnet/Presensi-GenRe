'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';
import { 
  Users, 
  UploadCloud, 
  FileSpreadsheet,
  UserPlus,
  Edit3,
  Trash2,
  Eye,
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Download,
  Mail,
  Phone,
  Building,
  Star,
  ExternalLink,
  Key,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Profile, Field, SystemRole } from '@/lib/types';
import { getRoleBadgeClass, getRoleLabel, formatDateWITA } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';

export default function MembersPage() {
  const { toast } = useToast();
  const [members, setMembers] = useState<Profile[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedField, setSelectedField] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [userRole, setUserRole] = useState<SystemRole>('member');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Modal State: Tambah Anggota (Create)
  // ---------------------------------------------------------------------------
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    memberCode: '',
    email: '',
    password: '',
    phoneNumber: '',
    fieldId: '',
    systemRole: 'member' as SystemRole,
    organizationPosition: 'Anggota',
    accountStatus: 'active' as 'active' | 'inactive',
  });

  // ---------------------------------------------------------------------------
  // Modal State: Edit Anggota (Update)
  // ---------------------------------------------------------------------------
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    id: '',
    fullName: '',
    memberCode: '',
    email: '',
    password: '',
    phoneNumber: '',
    fieldId: '',
    systemRole: 'member' as SystemRole,
    organizationPosition: 'Anggota',
    accountStatus: 'active' as 'active' | 'inactive' | 'suspended',
  });

  // ---------------------------------------------------------------------------
  // Modal State: Detail Anggota (Read)
  // ---------------------------------------------------------------------------
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<Profile | null>(null);

  // ---------------------------------------------------------------------------
  // Modal State: Hapus Anggota (Delete)
  // ---------------------------------------------------------------------------
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Profile | null>(null);

  // ---------------------------------------------------------------------------
  // Modal State: CSV Import
  // ---------------------------------------------------------------------------
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
        setCurrentUserId(user.id);
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('system_role')
          .eq('id', user.id)
          .single();
        if (currentProfile) {
          setUserRole(currentProfile.system_role as SystemRole);
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
        .select('*, field:fields!profiles_field_id_fkey(*)')
        .order('full_name', { ascending: true });
      if (profilesData) setMembers(profilesData as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reset Create Form
  const resetCreateForm = () => {
    const randomCode = `GENRE-${Math.floor(100 + Math.random() * 900)}`;
    setCreateForm({
      fullName: '',
      memberCode: randomCode,
      email: '',
      password: 'GenRe2026!Buleleng',
      phoneNumber: '',
      fieldId: fields[0]?.id || '',
      systemRole: 'member',
      organizationPosition: 'Anggota Divisi',
      accountStatus: 'active',
    });
  };

  // ---------------------------------------------------------------------------
  // Action: Tambah Anggota Baru (POST)
  // ---------------------------------------------------------------------------
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim() || !createForm.email.trim()) {
      toast.warning('Data Belum Lengkap', 'Nama Lengkap dan Email wajib diisi.');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/auth/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_code: createForm.memberCode,
          full_name: createForm.fullName,
          email: createForm.email,
          password: createForm.password || 'GenRe2026!Buleleng',
          phone_number: createForm.phoneNumber,
          field_id: createForm.fieldId || null,
          system_role: createForm.systemRole,
          organization_position: createForm.organizationPosition,
          account_status: createForm.accountStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menambahkan anggota');
      }

      toast.success(
        'Anggota Baru Berhasil Ditambahkan',
        `Akun untuk ${createForm.fullName} (${createForm.email}) telah aktif.`
      );

      // Kirim notifikasi in-app
      sendInAppNotification({
        title: 'Anggota Panitia Baru Bergabung',
        message: `${createForm.fullName} telah ditambahkan ke sistem kepanitiaan sebagai ${createForm.organizationPosition || 'Anggota'}.`,
        notificationType: 'general',
        actionUrl: '/dashboard/members',
        broadcastToAll: true,
      });

      setIsCreateModalOpen(false);
      resetCreateForm();
      fetchData();
    } catch (err: any) {
      toast.error('Gagal Menambah Anggota', err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Buka & Submit Edit Anggota (PUT)
  // ---------------------------------------------------------------------------
  const handleOpenEdit = (m: Profile) => {
    setSelectedMemberForEdit(m);
    setEditForm({
      id: m.id,
      fullName: m.full_name,
      memberCode: m.member_code,
      email: m.email,
      password: '',
      phoneNumber: m.phone_number || '',
      fieldId: m.field_id || '',
      systemRole: m.system_role,
      organizationPosition: m.organization_position || 'Anggota',
      accountStatus: m.account_status,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id || !editForm.fullName.trim() || !editForm.email.trim()) {
      toast.warning('Data Belum Lengkap', 'Nama Lengkap dan Email wajib diisi.');
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch('/api/auth/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editForm.id,
          member_code: editForm.memberCode,
          full_name: editForm.fullName,
          email: editForm.email,
          password: editForm.password ? editForm.password.trim() : undefined,
          phone_number: editForm.phoneNumber,
          field_id: editForm.fieldId || null,
          system_role: editForm.systemRole,
          organization_position: editForm.organizationPosition,
          account_status: editForm.accountStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui data anggota');
      }

      toast.success(
        'Data Anggota Berhasil Diperbarui',
        `Informasi profil ${editForm.fullName} telah disimpan.`
      );
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Gagal Mengedit Anggota', err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Buka & Submit Hapus Anggota (DELETE)
  // ---------------------------------------------------------------------------
  const handleOpenDelete = (m: Profile) => {
    setMemberToDelete(m);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;

    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberToDelete.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus anggota');
      }

      toast.success(
        'Anggota Berhasil Dihapus',
        `${memberToDelete.full_name} telah dihapus dari sistem.`
      );
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
      fetchData();
    } catch (err: any) {
      toast.error('Gagal Menghapus Anggota', err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Excel & CSV File Handling
  // ---------------------------------------------------------------------------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
        setParsedRows(rows);
      } catch (err: any) {
        toast.error('Gagal Membaca File Excel', err.message || 'Format file Excel tidak dapat dibaca.');
      }
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setParsedRows(results.data);
        },
        error: (error) => {
          toast.error('Gagal Membaca CSV', error.message);
        },
      });
    }
  };

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
        throw new Error(data.error || 'Gagal memproses impor berkas panitia');
      }

      toast.success(
        'Impor Data Panitia Berhasil',
        `Berhasil memproses ${data.results?.successCount || 0} akun panitia.`
      );
      setImportResult(data);
      fetchData();
    } catch (err: any) {
      toast.error('Gagal Impor Panitia', err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      {
        member_code: 'GENRE-021',
        full_name: 'I Putu Bayu Pratama',
        email: 'bayu.panitia@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        phone_number: '081234567899',
        field_code: 'ACR',
        system_role: 'member',
        organization_position: 'Anggota Divisi Acara',
      },
      {
        member_code: 'GENRE-022',
        full_name: 'Ni Komang Sukma Dewi',
        email: 'sukma.panitia@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        phone_number: '081234567888',
        field_code: 'HMS',
        system_role: 'member',
        organization_position: 'Anggota Divisi Humas',
      },
      {
        member_code: 'GENRE-013',
        full_name: 'I Gede Hendra Wijaya',
        email: 'hendra.panitia@genre-buleleng.org',
        password: 'GenRe2026!Buleleng',
        phone_number: '081234567877',
        field_code: 'LOG',
        system_role: 'coordinator',
        organization_position: 'Koordinator Divisi Logistik',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData, {
      header: [
        'member_code',
        'full_name',
        'email',
        'password',
        'phone_number',
        'field_code',
        'system_role',
        'organization_position',
      ],
    });

    ws['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 34 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 15 },
      { wch: 28 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Panitia');
    XLSX.writeFile(wb, 'template_panitia_genre.xlsx');
  };

  const downloadCsvTemplate = () => {
    const headers = 'member_code,full_name,email,password,phone_number,field_code,system_role,organization_position\n';
    const sample = 'GENRE-021,I Putu Bayu Pratama,bayu.panitia@genre-buleleng.org,GenRe2026!Buleleng,081234567899,ACR,member,Anggota Divisi Acara\nGENRE-022,Ni Komang Sukma Dewi,sukma.panitia@genre-buleleng.org,GenRe2026!Buleleng,081234567888,HMS,member,Anggota Divisi Humas\nGENRE-013,I Gede Hendra Wijaya,hendra.panitia@genre-buleleng.org,GenRe2026!Buleleng,081234567877,LOG,coordinator,Koordinator Divisi Logistik';
    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_panitia_genre.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered members list
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.member_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesField = selectedField === 'all' || m.field_id === selectedField;
    const matchesRole = roleFilter === 'all' || m.system_role === roleFilter;
    return matchesSearch && matchesField && matchesRole;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-50 text-teal-700 border border-teal-200">
              Direktori Kepanitiaan
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Buleleng 2026</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            Manajemen Panitia & Divisi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kelola data panitia, hak akses peran (Admin, Koordinator, Anggota), penempatan divisi, dan akun resmi.
          </p>
        </div>

        {/* Action Buttons (Khusus Admin) */}
        {userRole === 'admin' && (
          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            <button
              onClick={() => {
                resetCreateForm();
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tambah Anggota</span>
            </button>

            <Link
              href="/dashboard/members/import"
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-teal-600/20 active:scale-95"
            >
              <UploadCloud className="w-4 h-4 text-white" />
              <span>Impor Akun Panitia (CSV)</span>
            </Link>

            <button
              onClick={() => {
                setIsCsvModalOpen(true);
                setCsvFile(null);
                setParsedRows([]);
                setImportResult(null);
              }}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Impor Cepat</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, kode anggota, atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            
            {/* Filter Divisi */}
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full sm:w-44 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs focus:outline-none focus:border-teal-500 font-medium cursor-pointer"
            >
              <option value="all">Semua Divisi ({members.length})</option>
              {fields.map((f) => {
                const count = members.filter(m => m.field_id === f.id).length;
                return (
                  <option key={f.id} value={f.id}>
                    {f.field_name} ({count})
                  </option>
                );
              })}
            </select>

            {/* Filter 3 Role Resmi */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-36 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs focus:outline-none focus:border-teal-500 font-medium cursor-pointer"
            >
              <option value="all">Semua Role</option>
              <option value="admin">Admin ({members.filter(m => m.system_role === 'admin').length})</option>
              <option value="coordinator">Koordinator ({members.filter(m => m.system_role === 'coordinator').length})</option>
              <option value="member">Anggota ({members.filter(m => m.system_role === 'member').length})</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Members Table */}
      <Card title={`Daftar Panitia (${filteredMembers.length} Anggota)`}>
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Memuat direktori panitia...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Tidak ada panitia yang sesuai dengan kriteria pencarian atau filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Panitia</th>
                  <th className="py-3 px-4">Kontak</th>
                  <th className="py-3 px-4">Divisi & Posisi</th>
                  <th className="py-3 px-4">Hak Akses</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Kelola & Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-50 to-emerald-50 border border-teal-200 flex items-center justify-center font-bold text-teal-800 text-xs shrink-0">
                          {m.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMemberForDetail(m);
                              setIsDetailModalOpen(true);
                            }}
                            className="font-bold text-slate-900 hover:text-teal-700 text-left transition-colors cursor-pointer"
                          >
                            {m.full_name}
                          </button>
                          <span className="text-[11px] font-mono text-teal-700 block">{m.member_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{m.email}</span>
                        </div>
                        {m.phone_number && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{m.phone_number}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {(m.field as any)?.field_name || 'Khusus / Belum Ada Divisi'}
                        </span>
                        <span className="text-[11px] text-slate-500 block">{m.organization_position}</span>
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
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Tombol Lihat Detail (Read) */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMemberForDetail(m);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                          title="Lihat Profil Lengkap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Tombol Edit (Update - Khusus Admin) */}
                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Edit Data Panitia"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Tombol Hapus (Delete - Khusus Admin) */}
                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(m)}
                            disabled={currentUserId === m.id}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              currentUserId === m.id 
                                ? 'text-slate-300 cursor-not-allowed' 
                                : 'text-slate-500 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                            title={currentUserId === m.id ? 'Tidak dapat menghapus akun Anda sendiri' : 'Hapus Anggota'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Tombol Beri Nilai Evaluasi (Koordinator & Admin) */}
                        {(userRole === 'admin' || userRole === 'coordinator') && (
                          <Link
                            href="/dashboard/evaluations"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition-colors shadow-2xs ml-1"
                            title="Beri Nilai Kinerja"
                          >
                            <Star className="w-3 h-3 text-purple-600" />
                            <span className="hidden sm:inline">Nilai</span>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* MODAL 1: TAMBAH ANGGOTA BARU (CREATE) */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tambah Anggota Panitia Baru"
        description="Daftarkan anggota panitia baru ke sistem. Akun autentikasi dan data profil akan dibuat secara otomatis."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Nama Lengkap */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                Nama Lengkap *
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: I Putu Bayu Pratama"
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Kode Anggota */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Kode Anggota Panitia *
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: GENRE-025"
                value={createForm.memberCode}
                onChange={(e) => setCreateForm({ ...createForm, memberCode: e.target.value.toUpperCase() })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-semibold focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Email Akun */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Alamat Email Resmi *
              </label>
              <input
                type="email"
                required
                placeholder="nama.panitia@genre-buleleng.org"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Kata Sandi Awal */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Kata Sandi Awal Akun *
              </label>
              <input
                type="text"
                placeholder="Minimal 6 karakter"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-teal-500 text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: GenRe2026!Buleleng</span>
            </div>

            {/* Nomor Telepon / WA */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                placeholder="081234567890"
                value={createForm.phoneNumber}
                onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Divisi / Sie */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Divisi / Sie Kepanitiaan *
              </label>
              <select
                value={createForm.fieldId}
                onChange={(e) => setCreateForm({ ...createForm, fieldId: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs cursor-pointer font-medium"
              >
                <option value="">Pilih Divisi / Sie...</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name} ({f.field_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Role Sistem (3 Role Resmi: Admin, Koordinator, Anggota) */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Peran Sistem (Role) *
              </label>
              <select
                value={createForm.systemRole}
                onChange={(e) => setCreateForm({ ...createForm, systemRole: e.target.value as SystemRole })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-teal-500 text-xs cursor-pointer"
              >
                <option value="member">Anggota (Panitia Pelaksana)</option>
                <option value="coordinator">Koordinator (Koordinator Sie / Divisi)</option>
                <option value="admin">Admin (Pimpinan Panitia / Administrator)</option>
              </select>
            </div>

            {/* Posisi / Jabatan Organisasi */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Jabatan Organisasi *
              </label>
              <input
                type="text"
                placeholder="Contoh: Anggota Divisi Acara"
                value={createForm.organizationPosition}
                onChange={(e) => setCreateForm({ ...createForm, organizationPosition: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Status Akun */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Status Akun *
              </label>
              <select
                value={createForm.accountStatus}
                onChange={(e) => setCreateForm({ ...createForm, accountStatus: e.target.value as any })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs cursor-pointer font-medium"
              >
                <option value="active">Aktif (Dapat Login & Presensi)</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md shadow-teal-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              {createLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan & Buat Akun</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL 2: EDIT DATA ANGGOTA (UPDATE) */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Data Anggota: ${selectedMemberForEdit?.full_name || ''}`}
        description="Perbarui identitas, divisi, hak akses peran (role), jabatan, atau atur ulang kata sandi pengguna."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Nama Lengkap */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                Nama Lengkap *
              </label>
              <input
                type="text"
                required
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Kode Anggota */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Kode Anggota Panitia *
              </label>
              <input
                type="text"
                required
                value={editForm.memberCode}
                onChange={(e) => setEditForm({ ...editForm, memberCode: e.target.value.toUpperCase() })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-semibold focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Email Akun */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Alamat Email Resmi *
              </label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Atur Ulang Kata Sandi (Opsional) */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Atur Ulang Kata Sandi (Opsional)
              </label>
              <input
                type="text"
                placeholder="Kosongkan jika tidak diubah"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-teal-500 text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Minimal 6 karakter baru</span>
            </div>

            {/* Nomor Telepon / WA */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Divisi / Sie */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Divisi / Sie Kepanitiaan
              </label>
              <select
                value={editForm.fieldId}
                onChange={(e) => setEditForm({ ...editForm, fieldId: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs cursor-pointer font-medium"
              >
                <option value="">Khusus / Tanpa Divisi</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name} ({f.field_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Peran Sistem (Role: Admin, Koordinator, Anggota) */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Peran Sistem (Role) *
              </label>
              <select
                value={editForm.systemRole}
                onChange={(e) => setEditForm({ ...editForm, systemRole: e.target.value as SystemRole })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-teal-500 text-xs cursor-pointer"
              >
                <option value="member">Anggota (Panitia Pelaksana)</option>
                <option value="coordinator">Koordinator (Koordinator Sie / Divisi)</option>
                <option value="admin">Admin (Pimpinan Panitia / Administrator)</option>
              </select>
            </div>

            {/* Posisi / Jabatan Organisasi */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Jabatan Organisasi *
              </label>
              <input
                type="text"
                value={editForm.organizationPosition}
                onChange={(e) => setEditForm({ ...editForm, organizationPosition: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs"
              />
            </div>

            {/* Status Akun */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Status Akun *
              </label>
              <select
                value={editForm.accountStatus}
                onChange={(e) => setEditForm({ ...editForm, accountStatus: e.target.value as any })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500 text-xs cursor-pointer font-medium"
              >
                <option value="active">Aktif (active)</option>
                <option value="inactive">Nonaktif (inactive)</option>
                <option value="suspended">Ditangguhkan (suspended)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md shadow-teal-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              {editLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL 3: DETAIL ANGGOTA (READ) */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Informasi Lengkap Panitia"
        description="Rincian identitas akun, hak akses peran, divisi tugas, dan kontak resmi."
        maxWidth="max-w-lg"
      >
        {selectedMemberForDetail && (
          <div className="space-y-4 text-xs">
            {/* Header Profil */}
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-teal-50/70 to-emerald-50/50 border border-teal-200/80 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 font-extrabold text-white text-base flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
                {selectedMemberForDetail.full_name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-900 text-sm">{selectedMemberForDetail.full_name}</h3>
                  <Badge status={selectedMemberForDetail.account_status} />
                </div>
                <p className="text-[11px] font-mono font-bold text-teal-700 mt-0.5">
                  {selectedMemberForDetail.member_code}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getRoleBadgeClass(selectedMemberForDetail.system_role)}`}>
                    Role: {getRoleLabel(selectedMemberForDetail.system_role)}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid Detail Informasi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider mb-0.5">
                  Divisi / Sie
                </span>
                <span className="font-bold text-slate-900 block">
                  {(selectedMemberForDetail.field as any)?.field_name || 'Khusus / Tanpa Divisi'}
                </span>
                <span className="text-[10px] text-teal-700 font-mono">
                  Kode: {(selectedMemberForDetail.field as any)?.field_code || '-'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider mb-0.5">
                  Jabatan Organisasi
                </span>
                <span className="font-bold text-slate-900 block">
                  {selectedMemberForDetail.organization_position || 'Anggota'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider mb-0.5">
                  Email Akun Sistem
                </span>
                <div className="flex items-center gap-2 text-slate-800 font-medium">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="select-all">{selectedMemberForDetail.email}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider mb-0.5">
                  Nomor WhatsApp / Kontak
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{selectedMemberForDetail.phone_number || 'Belum diisi'}</span>
                  </div>
                  {selectedMemberForDetail.phone_number && (
                    <a
                      href={`https://wa.me/${selectedMemberForDetail.phone_number.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-200 flex items-center gap-1 transition-colors"
                    >
                      <span>Chat WA</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2 flex items-center justify-between text-slate-600">
                <span className="text-[11px]">Tanggal Bergabung Panitia:</span>
                <span className="font-semibold text-slate-800">{formatDateWITA(selectedMemberForDetail.joined_at)}</span>
              </div>
            </div>

            {/* Tombol Aksi Bawah */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {userRole === 'admin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEdit(selectedMemberForDetail);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Data</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL 4: KONFIRMASI HAPUS ANGGOTA (DELETE) */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Konfirmasi Hapus Anggota"
        description="Tindakan ini permanen dan akan menghapus identitas akun serta relasi data kepanitiaan."
        maxWidth="max-w-md"
      >
        {memberToDelete && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold block">Peringatan Penghapusan Akun:</span>
                <span>
                  Apakah Anda yakin ingin menghapus akun panitia <strong className="font-bold underline text-rose-950">{memberToDelete.full_name}</strong> ({memberToDelete.member_code})?
                </span>
                <p className="mt-1 text-[11px] text-rose-700">
                  Seluruh data presensi, penugasan agenda kegiatan, dan akun Supabase Auth miliknya akan dihapus dari sistem.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-800 font-semibold">{memberToDelete.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Peran Sistem:</span>
                <span className="font-semibold text-slate-800">{getRoleLabel(memberToDelete.system_role)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Divisi / Sie:</span>
                <span className="font-semibold text-slate-800">{(memberToDelete.field as any)?.field_name || '-'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Permanen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL 5: IMPOR EXCEL / CSV MASSAL */}
      {/* ============================================================================== */}
      <Modal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Impor Data Panitia via Excel / CSV"
        description="Pendaftaran akun resmi panitia, pemetaan divisi, dan pembuatan kredensial login secara massal."
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          {/* Format Guide & Download Templates */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50/70 via-slate-50 to-white border border-teal-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 block text-xs">Format Tabel Data Panitia</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Gunakan kolom resmi berikut di lembar Excel / CSV:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Unduh Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unduh CSV</span>
                </button>
              </div>
            </div>

            {/* Column Schema Pills */}
            <div className="p-2.5 rounded-lg bg-white border border-teal-100 font-mono text-[11px] text-teal-900 overflow-x-auto whitespace-nowrap shadow-xs font-semibold">
              member_code,full_name,email,password,phone_number,field_code,system_role,organization_position
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
              <div>
                <strong className="text-slate-800">Kode Sie & Divisi Resmi:</strong>{' '}
                <span className="font-mono text-teal-700 font-semibold">PNJ</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">KPT</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">SEK</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">BEN</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">ACR</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">HMS</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">KON</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">PER</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">PUB</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">DAN</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">ILM</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">OFF</span>.
              </div>
              <div>
                <strong className="text-slate-800">Peran Sistem (system_role):</strong>{' '}
                <span className="font-mono text-teal-700 font-semibold">admin</span>,{' '}
                <span className="font-mono text-teal-700 font-semibold">coordinator</span> (koordinator),{' '}
                <span className="font-mono text-teal-700 font-semibold">member</span> (anggota).
              </div>
            </div>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Pilih Berkas Excel (.xlsx, .xls) atau CSV (.csv):
            </label>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-700 file:cursor-pointer cursor-pointer border border-slate-300 rounded-xl p-2 bg-white shadow-xs"
            />
            {csvFile && (
              <p className="mt-1.5 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Berkas terpilih: <strong>{csvFile.name}</strong> ({(csvFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Table Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Pratinjau Data ({parsedRows.length} Calon Panitia):</span>
                <span className="text-[11px] font-normal text-slate-500">Menampilkan hingga 10 baris pertama</span>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2">Kode</th>
                      <th className="p-2">Nama Lengkap</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">No. HP</th>
                      <th className="p-2">Divisi</th>
                      <th className="p-2">Role</th>
                      <th className="p-2">Jabatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/80">
                        <td className="p-2 font-mono text-teal-700 font-semibold">{row.member_code || '-'}</td>
                        <td className="p-2 font-medium text-slate-900">{row.full_name || '-'}</td>
                        <td className="p-2 font-mono text-slate-600">{row.email || '-'}</td>
                        <td className="p-2 text-slate-600">{row.phone_number || '-'}</td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 font-semibold">
                            {row.field_code || '-'}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            row.system_role === 'admin' ? 'bg-rose-50 text-rose-700' :
                            row.system_role === 'coordinator' ? 'bg-purple-50 text-purple-700' :
                            'bg-teal-50 text-teal-700'
                          }`}>
                            {row.system_role || 'member'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600">{row.organization_position || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="text-[10px] text-slate-500 text-center">
                  ...dan {parsedRows.length - 10} baris lainnya siap diimpor.
                </p>
              )}
            </div>
          )}

          {/* Import Result Alert */}
          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{importResult.message}</span>
              </div>
              {importResult.results?.created?.length > 0 && (
                <p className="text-[11px] text-emerald-700">
                  Berhasil mendaftarkan {importResult.results.created.length} akun panitia baru dan menginisialisasi rekap evaluasi nilai awal.
                </p>
              )}
              {importResult.results?.skipped?.length > 0 && (
                <div className="pt-2 border-t border-emerald-200/60">
                  <span className="font-semibold text-amber-800 block mb-1">Dilewati ({importResult.results.skipped.length} akun):</span>
                  <ul className="list-disc list-inside text-amber-700 text-[11px] space-y-0.5 max-h-28 overflow-y-auto">
                    {importResult.results.skipped.map((s: any, i: number) => (
                      <li key={i}>{s.email}: {s.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(importResult.results?.failed?.length > 0 || importResult.results?.errors?.length > 0) && (
                <div className="pt-2 border-t border-emerald-200/60">
                  <span className="font-semibold text-rose-800 block mb-1">
                    Gagal ({(importResult.results?.failed || importResult.results?.errors || []).length} akun):
                  </span>
                  <ul className="list-disc list-inside text-rose-700 text-[11px] space-y-0.5 max-h-28 overflow-y-auto">
                    {(importResult.results?.failed || importResult.results?.errors || []).map((e: any, i: number) => (
                      <li key={i}>{e.email}: {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0 || importLoading}
              onClick={handleImportSubmit}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-teal-600/20 transition-all cursor-pointer active:scale-95"
            >
              {importLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses Impor Akun...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Mulai Impor ({parsedRows.length} Panitia)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
