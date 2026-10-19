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
  Trash2,
  Edit2,
  Printer,
  Download,
  Image as ImageIcon,
  Camera,
  Lock,
  FileText,
  Check
} from 'lucide-react';
import QRCode from 'qrcode';
import { Activity, ActivityAssignment, Profile, AttendanceSession, Field } from '@/lib/types';
import { formatDateTimeWITA, formatTimeWITA, getStatusBadgeClass, generateActivityCode } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';

export default function ActivityDetailPage() {
  const { toast } = useToast();
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
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [downloadingPoster, setDownloadingPoster] = useState(false);
  const [downloadingQrOnly, setDownloadingQrOnly] = useState(false);

  // Modal Konfirmasi Batalkan Penugasan (Mencegah Salah Klik)
  const [isRemoveAssignmentModalOpen, setIsRemoveAssignmentModalOpen] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<{ id: string; name: string; memberCode?: string; fieldName?: string } | null>(null);
  const [removingAssignment, setRemovingAssignment] = useState(false);

  // Filter Table State
  const [tableFieldFilter, setTableFieldFilter] = useState<string>('all');
  const [tableStatusFilter, setTableStatusFilter] = useState<string>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  // Modal Assign State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalFieldFilter, setAssignModalFieldFilter] = useState<string>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [assignType, setAssignType] = useState('attendance_required');
  const [assignDescription, setAssignDescription] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Modal Edit Agenda State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updatingActivity, setUpdatingActivity] = useState(false);
  const [editForm, setEditForm] = useState({
    activityCode: '',
    activityName: '',
    activityLocation: '',
    activityDescription: '',
    startAt: '',
    endAt: '',
    checkInOpensAt: '',
    checkInClosesAt: '',
    checkOutOpensAt: '',
    checkOutClosesAt: '',
    activityStatus: 'scheduled' as any,
    attendanceRequired: true,
  });

  const supabase = createClient();

  const formatForInput = (isoStr?: string | null) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEditModal = () => {
    if (!activity) return;
    setEditForm({
      activityCode: activity.activity_code,
      activityName: activity.activity_name,
      activityLocation: activity.activity_location,
      activityDescription: activity.activity_description || '',
      startAt: formatForInput(activity.start_at),
      endAt: formatForInput(activity.end_at),
      checkInOpensAt: formatForInput(activity.check_in_opens_at),
      checkInClosesAt: formatForInput(activity.check_in_closes_at),
      checkOutOpensAt: formatForInput(activity.check_out_opens_at || activity.end_at),
      checkOutClosesAt: formatForInput(activity.check_out_closes_at || activity.end_at),
      activityStatus: activity.activity_status,
      attendanceRequired: activity.attendance_required,
    });
    setIsEditModalOpen(true);
  };

  const handleEditActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity?.id) return;

    setUpdatingActivity(true);
    try {
      const effectiveStartAt = editForm.checkInOpensAt;
      const effectiveEndAt = editForm.checkOutClosesAt || editForm.checkInClosesAt;

      const res = await fetch('/api/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activity.id,
          ...editForm,
          startAt: effectiveStartAt,
          endAt: effectiveEndAt,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal memperbarui agenda kegiatan.');

      toast.success(
        'Agenda Kegiatan Berhasil Diperbarui',
        'Informasi jadwal, toleransi check-in, dan jendela check-out telah diperbarui.'
      );
      setIsEditModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error('Gagal Mengedit Agenda', err.message);
    } finally {
      setUpdatingActivity(false);
    }
  };

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
          .select('*, field:fields!profiles_field_id_fkey(*)')
          .eq('id', user.id)
          .single();
        if (p) {
          currentProf = p as any;
          setCurrentUser(currentProf);
          if (currentProf?.field_id) {
            setAssignModalFieldFilter(currentProf.field_id);
          }
        }
      }

      // Buka modal penugasan hanya jika user adalah admin atau koordinator
      const userCanManage = Boolean(
        currentProf && (currentProf.system_role === 'admin' || currentProf.system_role === 'coordinator')
      );
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('openAssign') === 'true' && userCanManage) {
          setIsAssignModalOpen(true);
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
        if (userCanManage) {
          generateQrCode(openSess.session_code);
        }
      } else if (act) {
        if (userCanManage) {
          generateQrCode(`${act.activity_code}-MAIN`);
        }
      }

      // 4. Ambil daftar bidang/divisi
      const { data: fData } = await supabase.from('fields').select('*').order('field_name');
      if (fData) setFields(fData);

      // 5. Ambil daftar penugasan dan presensi panitia (transparan untuk semua pengguna)
      let assignsData: any[] = [];
      const { data: assigns, error: assignErr } = await supabase
        .from('activity_assignments')
        .select(`
          *,
          member:profiles!activity_assignments_member_id_fkey(
            *,
            field:fields!profiles_field_id_fkey(*)
          ),
          attendance:attendances(*)
        `)
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });

      if (!assignErr && assigns && assigns.length > 0) {
        assignsData = assigns;
      }

      // Pastikan seluruh anggota dapat melihat presensi rekan panitia lain
      // (termasuk jika RLS membatasi tampilan akun anggota biasa atau jika query client gagal)
      try {
        const res = await fetch(`/api/activities/${activityId}/attendances`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length >= assignsData.length) {
            assignsData = json.data;
          }
        }
      } catch (apiErr) {
        // Fallback ke data client jika terjadi kendala jaringan
      }

      // Normalisasi objek attendance (jika berbentuk array dari PostgREST)
      const normalizedAssignments = assignsData.map((item: any) => ({
        ...item,
        attendance: Array.isArray(item.attendance) ? (item.attendance[0] || null) : item.attendance,
      }));

      setAssignments(normalizedAssignments as any);

      // 6. Ambil seluruh anggota panitia aktif
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*, field:fields!profiles_field_id_fkey(*)')
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
        width: 800,
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

  // Helper untuk wrapping teks pada Canvas poster
  const drawWrappedCanvasText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
    return currentY;
  };

  // Unduh Poster Lengkap (PNG / JPG) untuk dicetak & ditempel di lokasi kegiatan
  const handleDownloadPoster = async (format: 'png' | 'jpeg') => {
    if (!activity || !qrDataUrl) {
      toast.warning('QR Belum Siap', 'QR Code sedang diproses atau belum tersedia.');
      return;
    }
    setDownloadingPoster(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1680;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Peramban Anda tidak mendukung Canvas rendering.');

      // Background Putih Bersih
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Border Luar Elegan Teal
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 14;
      ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

      // Header Background Teal Deep
      ctx.fillStyle = '#0f766e';
      ctx.fillRect(35, 35, canvas.width - 70, 165);

      // Render logo GenRe resmi di header poster canvas jika tersedia
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/logo-genre.png';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });
        if (logoImg.naturalWidth > 0) {
          const lHeight = 115;
          const lWidth = (logoImg.naturalWidth / logoImg.naturalHeight) * lHeight;
          // Background badge putih untuk logo di header canvas
          ctx.fillStyle = '#ffffff';
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(55, 60, lWidth + 20, lHeight + 15, 12);
            ctx.fill();
          } else {
            ctx.fillRect(55, 60, lWidth + 20, lHeight + 15);
          }
          ctx.drawImage(logoImg, 65, 67, lWidth, lHeight);
        }
      } catch (e) {
        console.warn('Logo could not be drawn on canvas:', e);
      }

      // Header Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PEMILIHAN DUTA GENRE KABUPATEN BULELENG', canvas.width / 2, 90);

      ctx.font = '600 22px sans-serif';
      ctx.fillStyle = '#ccfbf1';
      ctx.fillText('LEMBAR PRESENSI KEGIATAN RESMI', canvas.width / 2, 130);

      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`KODE AGENDA: ${activity.activity_code}`, canvas.width / 2, 168);

      // Judul Kegiatan
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 40px sans-serif';
      drawWrappedCanvasText(ctx, activity.activity_name, canvas.width / 2, 260, 1000, 48);

      // Box Informasi Detail Kegiatan
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(90, 325, canvas.width - 180, 175);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(90, 325, canvas.width - 180, 175);

      ctx.textAlign = 'left';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(`📍 Lokasi: ${activity.activity_location}`, 120, 370);
      ctx.fillText(`📅 Tanggal: ${formatDateTimeWITA(activity.start_at)}`, 120, 410);

      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#0d9488';
      ctx.fillText(`⏰ Toleransi On-Time Check-in: s.d. ${formatTimeWITA(activity.check_in_closes_at)} WITA`, 120, 455);
      ctx.fillStyle = '#d97706';
      ctx.fillText(`🚪 Jendela Check-out: ${formatTimeWITA(activity.check_out_opens_at)} - ${formatTimeWITA(activity.check_out_closes_at)} WITA`, 120, 485);

      // Muat gambar QR Code ke canvas
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.src = qrDataUrl;
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
      });

      const qrSize = 580;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 545;

      // Frame Box Putih untuk QR
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX - 25, qrY - 25, qrSize + 50, qrSize + 50);
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 6;
      ctx.strokeRect(qrX - 25, qrY - 25, qrSize + 50, qrSize + 50);

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Petunjuk Pemindaian untuk Panitia
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('PINDAI QR CODE INI UNTUK PRESENSI KEHADIRAN', canvas.width / 2, 1220);

      ctx.fillStyle = '#475569';
      ctx.font = '20px sans-serif';
      ctx.fillText('1. Buka menu Presensi di Sistem Absensi Panitia GenRe di smartphone Anda.', canvas.width / 2, 1265);
      ctx.fillText('2. Tekan tombol "Buka Kamera Scanner" dan arahkan ke QR Code ini.', canvas.width / 2, 1300);
      ctx.fillText('3. Presensi wajib dilakukan langsung di lokasi kegiatan saat kedatangan & kepulangan.', canvas.width / 2, 1335);

      // Kotak Peringatan Keamanan
      ctx.fillStyle = '#fffbeb';
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 2;
      ctx.fillRect(120, 1380, canvas.width - 240, 75);
      ctx.strokeRect(120, 1380, canvas.width - 240, 75);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText('⚠️ QR Code ini hanya sah dipindai secara fisik di lokasi kegiatan.', canvas.width / 2, 1415);
      ctx.font = '16px sans-serif';
      ctx.fillText('Dilarang memfoto / membagikan kode QR keluar dari area registrasi kegiatan.', canvas.width / 2, 1440);

      // Footer Signature Line
      ctx.fillStyle = '#64748b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Diterbitkan Resmi Oleh Koordinator & Penanggung Jawab Kegiatan', canvas.width / 2, 1515);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#0f766e';
      ctx.fillText('PEMILIHAN DUTA GENRE KABUPATEN BULELENG', canvas.width / 2, 1545);

      // Export file
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, 0.95);
      const link = document.createElement('a');
      link.download = `POSTER_PRESENSI_${activity.activity_code}_${format.toUpperCase()}.${format === 'png' ? 'png' : 'jpg'}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Poster Berhasil Diunduh', `Poster presensi ${format.toUpperCase()} siap dicetak dan ditempel di lokasi.`);
    } catch (err: any) {
      console.error('Error exporting poster:', err);
      toast.error('Gagal Mengunduh Poster', err.message || 'Terjadi kesalahan saat memproses gambar.');
    } finally {
      setDownloadingPoster(false);
    }
  };

  // Unduh Standalone QR Code Only (PNG / JPG)
  const handleDownloadQrOnly = async (format: 'png' | 'jpeg') => {
    if (!activity || (!activeSession && !activity.activity_code)) return;
    setDownloadingQrOnly(true);
    try {
      const code = activeSession?.session_code || `${activity.activity_code}-MAIN`;
      const qrPayload = JSON.stringify({
        activityId,
        sessionCode: code,
        timestamp: Date.now(),
      });

      const highResUrl = await QRCode.toDataURL(qrPayload, {
        width: 1200,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `QR_CODE_${activity.activity_code}.png`;
        link.href = highResUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1200, 1200);
        const img = new Image();
        img.src = highResUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        ctx.drawImage(img, 0, 0);
        const jpgUrl = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.download = `QR_CODE_${activity.activity_code}.jpg`;
        link.href = jpgUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success('QR Code Berhasil Diunduh', `File QR Code (${format.toUpperCase()}) telah disimpan.`);
    } catch (err: any) {
      toast.error('Gagal Mengunduh QR', err.message);
    } finally {
      setDownloadingQrOnly(false);
    }
  };

  // Cetak Poster Langsung (Mendukung Simpan ke PDF atau Cetak Kertas Printer)
  const handlePrintPoster = () => {
    setIsPosterModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Anggota yang belum ditugaskan pada agenda ini
  const assignedMemberIdSet = new Set(assignments.map(a => a.member_id));
  const unassignedMembers = allActiveMembers.filter(m => !assignedMemberIdSet.has(m.id));

  // Filter anggota unassigned di modal berdasarkan divisi yang dipilih koordinator
  const filteredUnassignedMembers = unassignedMembers.filter(m => {
    if (assignModalFieldFilter === 'all') return true;
    return m.field_id === assignModalFieldFilter;
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

  // Eksekusi Penugasan Massal (Hanya Koordinator & Admin)
  const handleBatchAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error('Akses Ditolak', 'Hanya Koordinator dan Admin yang memiliki izin menugaskan panitia.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      toast.warning('Pilih Panitia', 'Pilih setidaknya 1 anggota panitia untuk ditugaskan.');
      return;
    }

    setAssigning(true);
    try {
      const assignerId = currentUser?.id || '11111111-0000-0000-0000-000000000001';
      const batchRows = selectedMemberIds.map(mId => ({
        activity_id: activityId,
        member_id: mId,
        assignment_type: assignType,
        assignment_description: assignDescription.trim() || null,
        assignment_status: 'active',
        assigned_by: assignerId,
      }));

      const { error } = await supabase
        .from('activity_assignments')
        .upsert(batchRows, { onConflict: 'activity_id,member_id' });

      if (error) throw error;

      toast.success(
        'Penugasan Berhasil',
        `Berhasil menugaskan ${selectedMemberIds.length} anggota panitia ke agenda ini.`
      );

      // Kirim notifikasi in-app ke masing-masing panitia yang ditugaskan
      selectedMemberIds.forEach((mId) => {
        sendInAppNotification({
          userId: mId,
          title: 'Penugasan Panitia Baru',
          message: `Anda telah ditugaskan pada agenda "${activity?.activity_name || 'Kegiatan'}" (${assignType}).`,
          notificationType: 'assignment',
          actionUrl: `/dashboard/activities/${activityId}`,
        });
      });

      setIsAssignModalOpen(false);
      setSelectedMemberIds([]);
      setAssignDescription('');
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal Menugaskan Panitia', err.message || 'Periksa koneksi database.');
    } finally {
      setAssigning(false);
    }
  };

  // Catat Kehadiran / Kepulangan Cepat oleh Koordinator / Admin
  const handleQuickAttendance = async (assignmentId: string, memberName: string, action: 'check_in' | 'check_out') => {
    if (!canManage) {
      toast.error('Akses Ditolak', 'Hanya Koordinator dan Admin yang memiliki izin mencatat presensi panitia secara manual.');
      return;
    }
    const actionLabel = action === 'check_in' ? 'Check-in (Masuk)' : 'Check-out (Pulang)';

    try {
      const nowIso = new Date().toISOString();
      const { data: existingAtt } = await supabase
        .from('attendances')
        .select('*')
        .eq('activity_assignment_id', assignmentId)
        .maybeSingle();

      const assignerId = currentUser?.id || '11111111-0000-0000-0000-000000000001';

      if (action === 'check_in') {
        if (existingAtt && existingAtt.check_in_at) {
          toast.warning('Sudah Check-in', `${memberName} sudah tercatat melakukan check-in sebelumnya pada pukul ${formatTimeWITA(existingAtt.check_in_at)}.`);
          return;
        }

        // Tentukan apakah terlambat
        const checkInCloses = activity?.check_in_closes_at ? new Date(activity.check_in_closes_at) : null;
        const isLate = checkInCloses ? new Date() > checkInCloses : false;
        const checkInStatus = isLate ? 'late' : 'on_time';
        const note = isLate ? 'Check-in manual (terlambat)' : 'Check-in manual (tepat waktu)';

        if (existingAtt) {
          await supabase.from('attendances').update({
            check_in_at: nowIso,
            check_in_status: checkInStatus,
            check_in_method: 'manual',
            verification_status: 'approved',
            verified_by: assignerId,
            verified_at: nowIso,
            attendance_note: note,
            updated_at: nowIso,
          }).eq('id', existingAtt.id);
        } else {
          await supabase.from('attendances').insert({
            activity_assignment_id: assignmentId,
            check_in_at: nowIso,
            check_in_status: checkInStatus,
            check_in_method: 'manual',
            verification_status: 'approved',
            verified_by: assignerId,
            verified_at: nowIso,
            attendance_note: note,
          });
        }
      } else {
        // check_out
        if (!existingAtt || !existingAtt.check_in_at) {
          toast.warning('Belum Check-in', `${memberName} belum tercatat melakukan check-in pada agenda ini.`);
          return;
        }

        if (existingAtt.check_out_at) {
          toast.warning('Sudah Check-out', `${memberName} sudah tercatat melakukan check-out sebelumnya pada pukul ${formatTimeWITA(existingAtt.check_out_at)}.`);
          return;
        }

        // Tentukan apakah mendahului atau melewati jam check-out yang ditentukan
        let isEarly = false;
        let isPastDeadline = false;
        let referenceTime = '';
        const checkOutDeadline = activity?.check_out_closes_at || activity?.end_at;

        if (activity?.check_out_opens_at) {
          isEarly = new Date() < new Date(activity.check_out_opens_at);
          referenceTime = formatTimeWITA(activity.check_out_opens_at);
        } else if (activity?.end_at) {
          isEarly = new Date() < new Date(activity.end_at);
          referenceTime = formatTimeWITA(activity.end_at);
        }

        if (checkOutDeadline && new Date() > new Date(checkOutDeadline)) {
          isPastDeadline = true;
        }

        const checkOutStatus = isEarly ? 'early_departure' : 'normal';
        const note = isEarly 
          ? `Check-out manual oleh Koordinator (Mendahului sebelum ${referenceTime})` 
          : isPastDeadline
          ? `Check-out susulan oleh Koordinator (Dikonfirmasi setelah batas waktu kegiatan)`
          : 'Check-out manual oleh Koordinator (Sesuai jadwal)';

        await supabase.from('attendances').update({
          check_out_at: nowIso,
          check_out_status: checkOutStatus,
          check_out_method: 'manual',
          attendance_note: existingAtt.attendance_note ? `${existingAtt.attendance_note} | ${note}` : note,
          updated_at: nowIso,
        }).eq('id', existingAtt.id);
      }

      toast.success(
        `Presensi ${actionLabel} Berhasil`,
        `Pencatatan presensi untuk ${memberName} berhasil disimpan dan diverifikasi.`
      );

      // Cari member_id untuk penugasan ini dan kirim in-app notif
      const targetAssignment = assignments.find(a => a.id === assignmentId);
      if (targetAssignment?.member_id) {
        // Otomatis sinkronkan skor presensi ke evaluasi akhir
        fetch('/api/evaluations/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: targetAssignment.member_id }),
        }).catch(e => console.warn('Gagal trigger kalkulasi evaluasi:', e));

        sendInAppNotification({
          userId: targetAssignment.member_id,
          title: `Presensi Terverifikasi: ${actionLabel}`,
          message: `Presensi Anda pada agenda "${activity?.activity_name || 'Kegiatan'}" telah dicatat oleh koordinator.`,
          notificationType: 'attendance',
          actionUrl: '/dashboard/attendance',
        });
      }

      loadData();
    } catch (err: any) {
      toast.error('Gagal Memproses Presensi', err.message);
    }
  };

  // Buka Modal Konfirmasi Pembatalan Penugasan (Mencegah Salah Klik)
  const openRemoveAssignmentModal = (item: any) => {
    setAssignmentToRemove({
      id: item.id,
      name: item.member?.full_name || 'Panitia',
      memberCode: item.member?.member_code,
      fieldName: item.member?.field?.field_name,
    });
    setIsRemoveAssignmentModalOpen(true);
  };

  // Eksekusi Pembatalan Penugasan setelah Dikonfirmasi
  const confirmRemoveAssignment = async () => {
    if (!assignmentToRemove || !canManage) return;

    setRemovingAssignment(true);
    try {
      const res = await fetch(`/api/activities/assignments?id=${assignmentToRemove.id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal membatalkan penugasan.');
      }

      toast.success(
        'Penugasan Berhasil Dibatalkan',
        `Penugasan untuk ${assignmentToRemove.name} berhasil dihapus dari agenda ini.`
      );

      setIsRemoveAssignmentModalOpen(false);
      setAssignmentToRemove(null);
      await loadData();
    } catch (err: any) {
      console.error('Error removing assignment:', err);
      toast.error('Gagal Membatalkan Penugasan', err.message);
    } finally {
      setRemovingAssignment(false);
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
        <h3 className="text-sm font-bold text-slate-900">Kegiatan Tidak Ditemukan</h3>
        <Link href="/dashboard/activities" className="mt-3 inline-block text-xs font-semibold text-teal-600 hover:text-teal-700">
          ← Kembali ke Agenda Kegiatan
        </Link>
      </Card>
    );
  }

  // Filter tabel penugasan yang tampil (divisi, pencarian, dan status presensi)
  const filteredAssignments = assignments.filter(a => {
    const matchField = tableFieldFilter === 'all' || a.member?.field_id === tableFieldFilter;
    const name = a.member?.full_name?.toLowerCase() || '';
    const code = a.member?.member_code?.toLowerCase() || '';
    const matchSearch = name.includes(tableSearchQuery.toLowerCase()) || code.includes(tableSearchQuery.toLowerCase());

    let matchStatus = true;
    if (tableStatusFilter === 'on_time') {
      matchStatus = a.attendance?.check_in_status === 'on_time';
    } else if (tableStatusFilter === 'late') {
      matchStatus = a.attendance?.check_in_status === 'late';
    } else if (tableStatusFilter === 'early_departure') {
      matchStatus = a.attendance?.check_out_status === 'early_departure';
    } else if (tableStatusFilter === 'no_checkout') {
      const checkOutDeadline = activity?.check_out_closes_at || activity?.end_at;
      const closed = Boolean(
        activity?.activity_status === 'completed' ||
        (checkOutDeadline && new Date() > new Date(checkOutDeadline))
      );
      matchStatus = Boolean(a.attendance?.check_in_at && !a.attendance?.check_out_at && closed);
    } else if (tableStatusFilter === 'checked_in') {
      matchStatus = Boolean(a.attendance?.check_in_at);
    } else if (tableStatusFilter === 'not_checked_in') {
      matchStatus = !a.attendance?.check_in_at;
    }

    return matchField && matchSearch && matchStatus;
  });

  const checkOutDeadline = activity?.check_out_closes_at || activity?.end_at;
  const isCheckoutClosed = Boolean(
    activity?.activity_status === 'completed' ||
    (checkOutDeadline && new Date() > new Date(checkOutDeadline))
  );

  const totalAssigned = assignments.length;
  const totalCheckedIn = assignments.filter(a => a.attendance?.check_in_at).length;
  const totalOnTime = assignments.filter(a => a.attendance?.check_in_status === 'on_time').length;
  const totalLate = assignments.filter(a => a.attendance?.check_in_status === 'late').length;
  const totalEarly = assignments.filter(a => a.attendance?.check_out_status === 'early_departure').length;
  const totalNoCheckout = assignments.filter(
    a => a.attendance?.check_in_at && !a.attendance?.check_out_at && isCheckoutClosed
  ).length;

  const myField = currentUser?.field;
  const canManage = Boolean(
    currentUser && (currentUser.system_role === 'admin' || currentUser.system_role === 'coordinator')
  );

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/activities"
              className="text-xs text-slate-500 hover:text-teal-700 flex items-center gap-1.5 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Daftar Agenda</span>
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono font-bold text-teal-800 px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200">
                {activity.activity_code}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{activity.activity_name}</h1>
              <Badge status={activity.activity_status} />
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{activity.activity_location} • Waktu: {formatDateTimeWITA(activity.start_at)}</span>
            </p>
          </div>

          {/* Tombol Aksi di Header Utama - Khusus Koordinator & Admin */}
          {canManage && (
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <button
                onClick={() => setIsPosterModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Cetak Poster Presensi (PDF) atau Unduh Gambar (PNG/JPG)"
              >
                <Printer className="w-3.5 h-3.5 text-teal-600" />
                <span>Cetak / Unduh Poster QR</span>
              </button>
              <button
                onClick={openEditModal}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Edit Agenda Kegiatan (Waktu, Lokasi, Toleransi & Check-out)"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Agenda</span>
              </button>
              <button
                onClick={() => {
                  setSelectedMemberIds([]);
                  setIsAssignModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tugaskan Panitia</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Grid: QR Card & Live Attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Left Column: QR Code Station (Khusus Koordinator & Admin) ATAU Informasi Lokasi (Untuk Panitia) */}
          {canManage ? (
            <Card
              title="Stasiun QR Code Presensi"
              subtitle="Cetak untuk ditempel di lokasi acara atau tampilkan di proyektor"
              className="lg:col-span-1 flex flex-col items-center text-center p-5"
              action={
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsPosterModalOpen(true)}
                    className="p-1.5 text-xs text-teal-700 hover:text-teal-900 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Cetak Poster PDF / Unduh Gambar"
                  >
                    <Printer className="w-3.5 h-3.5 text-teal-600" />
                    <span className="font-semibold text-[11px]">Cetak</span>
                  </button>
                  <button
                    onClick={() => setIsQrFullscreen(true)}
                    className="p-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center transition-colors cursor-pointer"
                    title="Tampilkan Layar Penuh"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              }
            >
              <div className="p-4 rounded-2xl bg-white shadow-md inline-block border-2 border-teal-500/40 relative group">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code Presensi" className="w-52 h-52 sm:w-56 sm:h-56 object-contain" />
                ) : (
                  <div className="w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 text-xs">
                    Membuat QR Code...
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                  <button
                    onClick={() => setIsPosterModalOpen(true)}
                    className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Poster PDF</span>
                  </button>
                  <button
                    onClick={() => handleDownloadPoster('png')}
                    disabled={downloadingPoster}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>{downloadingPoster ? 'Menyiapkan...' : 'Unduh Poster PNG'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 w-full">
                <button
                  onClick={() => setIsPosterModalOpen(true)}
                  className="py-2 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak PDF</span>
                </button>
                <button
                  onClick={() => handleDownloadPoster('png')}
                  disabled={downloadingPoster}
                  className="py-2 px-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Unduh Poster Lengkap Format PNG"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>{downloadingPoster ? 'Memproses...' : 'Unduh PNG'}</span>
                </button>
              </div>

              <div className="mt-4 w-full text-left space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Kode Sesi:</span>
                  <span className="font-mono font-bold text-teal-700">{activeSession?.session_code || `${activity.activity_code}-MAIN`}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Jendela On-Time:</span>
                  <span className="font-medium text-slate-800">{formatTimeWITA(activity.check_in_opens_at)} - {formatTimeWITA(activity.check_in_closes_at)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                  <span className="text-amber-800 font-medium">Jendela Check-out:</span>
                  <span className="font-semibold text-amber-900">{formatTimeWITA(activity.check_out_opens_at)} - {formatTimeWITA(activity.check_out_closes_at)}</span>
                </div>
              </div>

              <div className="mt-3.5 p-2.5 rounded-xl bg-teal-50/70 border border-teal-200/60 text-left text-[11px] text-teal-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Akses Khusus Koordinator:</strong> Cetak atau unduh lembar poster QR ini untuk ditempel di meja presensi lokasi kegiatan.
                </span>
              </div>
            </Card>
          ) : (
            <Card
              title="Presensi Lokasi Kegiatan"
              subtitle="QR Code fisik ditempelkan di lokasi kegiatan oleh Koordinator"
              className="lg:col-span-1 p-5 flex flex-col justify-between"
            >
              <div>
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 mb-4">
                  <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-amber-800">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>QR Code Khusus Lokasi Fisik</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Untuk menjamin keabsahan dan kedisiplinan kehadiran, <strong>QR Code tidak ditampilkan di layar panitia</strong> dan hanya dapat diakses oleh Koordinator / Penanggung Jawab untuk dicetak serta ditempelkan di lokasi kegiatan.
                  </p>
                </div>

                <div className="space-y-3 text-xs text-slate-600">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    <span>Petunjuk Presensi Panitia:</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px] text-slate-600 leading-relaxed">
                    <li>
                      Hadir langsung di lokasi: <strong className="text-slate-900">{activity.activity_location}</strong>
                    </li>
                    <li>
                      Waktu Check-in: <strong className="text-teal-700">{formatTimeWITA(activity.check_in_opens_at)} - {formatTimeWITA(activity.check_in_closes_at)} WITA</strong>
                    </li>
                    <li>
                      Cari lembar poster QR Code resmi yang ditempel di meja presensi lokasi kegiatan.
                    </li>
                    <li>
                      Buka menu <strong>Presensi</strong> di sistem ini, lalu klik tombol <strong>Buka Kamera Scanner</strong>.
                    </li>
                  </ol>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  href="/dashboard/attendance"
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-teal-600/20"
                >
                  <Camera className="w-4 h-4" />
                  <span>Buka Kamera Scanner Presensi</span>
                </Link>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  Pastikan Anda sudah berada di lokasi sebelum memindai QR Code.
                </p>
              </div>
            </Card>
          )}

        {/* Right Column: Live Attendance Monitor */}
        <Card
          title="Pemantau Presensi Panitia"
          subtitle={`${totalCheckedIn} dari ${totalAssigned} panitia telah hadir (${totalOnTime} Tepat Waktu, ${totalLate} Terlambat)`}
          action={
            canManage ? (
              <button
                onClick={() => {
                  setSelectedMemberIds([]);
                  setIsAssignModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Tugaskan Panitia</span>
              </button>
            ) : undefined
          }
          className="lg:col-span-2"
        >
          {/* Filter Bar Tabel */}
          <div className="flex flex-col sm:flex-row gap-2.5 mb-4 pb-4 border-b border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau nomor anggota..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={tableStatusFilter}
                onChange={(e) => setTableStatusFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-teal-500"
              >
                <option value="all">Semua Status Presensi ({assignments.length})</option>
                <option value="on_time">🟢 Tepat Waktu ({totalOnTime})</option>
                <option value="late">🔴 Terlambat ({totalLate})</option>
                <option value="early_departure">🟠 Pulang Mendahului ({totalEarly})</option>
                {isCheckoutClosed && totalNoCheckout > 0 && (
                  <option value="no_checkout">⚠️ Tidak Check-out ({totalNoCheckout})</option>
                )}
                <option value="not_checked_in">🟡 Belum Check-in ({totalAssigned - totalCheckedIn})</option>
              </select>

              <select
                value={tableFieldFilter}
                onChange={(e) => setTableFieldFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-teal-500"
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

              {myField && (
                <button
                  type="button"
                  onClick={() => setTableFieldFilter(tableFieldFilter === myField.id ? 'all' : myField.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    tableFieldFilter === myField.id 
                      ? 'bg-teal-50 text-teal-800 border-teal-300' 
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {tableFieldFilter === myField.id ? 'Tampilkan Semua' : `Sie Saya (${myField.field_code})`}
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Status Badges */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setTableStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                tableStatusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({assignments.length})
            </button>
            <button
              type="button"
              onClick={() => setTableStatusFilter('on_time')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tableStatusFilter === 'on_time'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Tepat Waktu ({totalOnTime})
            </button>
            <button
              type="button"
              onClick={() => setTableStatusFilter('late')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tableStatusFilter === 'late'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Terlambat ({totalLate})
            </button>
            <button
              type="button"
              onClick={() => setTableStatusFilter('early_departure')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tableStatusFilter === 'early_departure'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Mendahului ({totalEarly})
            </button>
            {isCheckoutClosed && totalNoCheckout > 0 && (
              <button
                type="button"
                onClick={() => setTableStatusFilter('no_checkout')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  tableStatusFilter === 'no_checkout'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                Tidak Check-out ({totalNoCheckout})
              </button>
            )}
            <button
              type="button"
              onClick={() => setTableStatusFilter('not_checked_in')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                tableStatusFilter === 'not_checked_in'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Belum Hadir ({totalAssigned - totalCheckedIn})
            </button>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
              {assignments.length === 0 ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mb-3 shadow-sm">
                    <Users className="w-7 h-7" />
                  </div>
                  <p className="font-bold text-slate-900 text-base">Belum Ada Panitia Bertugas</p>
                  <p className="text-slate-500 max-w-md mt-1 mb-4 leading-relaxed text-xs">
                    {canManage
                      ? 'Agenda ini belum memiliki panitia yang ditugaskan. Koordinator dari setiap divisi/sie (Acara, Perlengkapan, Konsumsi, Humas, dll.) dapat memilih dan menugaskan anggotanya untuk bertugas di agenda ini.'
                      : 'Agenda ini belum memiliki panitia yang ditugaskan. Penugasan panitia dikelola oleh Koordinator masing-masing divisi atau Admin.'}
                  </p>
                  {canManage && (
                    <button
                      onClick={() => {
                        setSelectedMemberIds([]);
                        setIsAssignModalOpen(true);
                      }}
                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Tugaskan Panitia Sie ke Agenda Ini</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="py-6">
                  Tidak ada panitia yang cocok dengan filter divisi atau pencarian.
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3">Panitia</th>
                    <th className="py-2.5 px-3">Divisi / Posisi & Jobdesk</th>
                    <th className="py-2.5 px-3">Status Hadir</th>
                    <th className="py-2.5 px-3">Masuk</th>
                    <th className="py-2.5 px-3">Pulang</th>
                    {canManage && <th className="py-2.5 px-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAssignments.map((item) => {
                    const att = item.attendance;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block">{item.member?.full_name}</span>
                          <span className="text-[10px] font-mono text-teal-700 block">{item.member?.member_code}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.member?.field?.field_code || 'UMUM'}
                            </span>
                            <span className="text-slate-800 font-medium">{item.member?.field?.field_name || 'Umum'}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {item.member?.organization_position}
                            {item.assignment_description && (
                              <span className="text-teal-800 font-medium"> &bull; {item.assignment_description}</span>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {att?.check_in_at ? (
                            <Badge status={att.check_in_status} />
                          ) : (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">Belum Check-in</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {att?.check_in_at ? formatTimeWITA(att.check_in_at) : '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {att?.check_out_at ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className="font-mono text-[11px] text-slate-700 font-semibold">{formatTimeWITA(att.check_out_at)}</span>
                              {att.check_out_status === 'early_departure' ? (
                                <span className="text-[10px] text-amber-800 font-bold bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                                  Mendahului
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-medium">Sesuai Jadwal</span>
                              )}
                            </div>
                          ) : att?.check_in_at && isCheckoutClosed ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                Tidak Check-out
                              </span>
                              <span className="text-[9px] text-slate-400">Melewati Batas</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">-</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!att?.check_in_at ? (
                                <button
                                  onClick={() => handleQuickAttendance(item.id, item.member?.full_name || 'Panitia', 'check_in')}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                                  title="Catat Masuk"
                                >
                                  + Masuk
                                </button>
                              ) : !att?.check_out_at ? (
                                <button
                                  onClick={() => handleQuickAttendance(item.id, item.member?.full_name || 'Panitia', 'check_out')}
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                                    isCheckoutClosed
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                  }`}
                                  title={isCheckoutClosed ? 'Konfirmasi Pulang Susulan (Melewati Batas)' : 'Catat Pulang (Check-out)'}
                                >
                                  + Pulang {isCheckoutClosed ? '(Susulan)' : '(Check-out)'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                                  Selesai
                                </span>
                              )}

                              <button
                                onClick={() => openRemoveAssignmentModal(item)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors ml-1 cursor-pointer"
                                title="Batalkan Penugasan Panitia (Buka Konfirmasi)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

      {/* Fullscreen QR Modal (Khusus Koordinator & Admin) */}
      {canManage && isQrFullscreen && (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <button
              onClick={() => setIsPosterModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Unduh Poster</span>
            </button>
            <button
              onClick={() => setIsQrFullscreen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-300 cursor-pointer"
            >
              Tutup Layar Penuh (ESC)
            </button>
          </div>

          <div className="text-center mb-6">
            <span className="text-sm font-mono font-bold text-teal-700 uppercase tracking-widest">{activity.activity_code}</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{activity.activity_name}</h2>
            <p className="text-sm text-slate-600 mt-1">Pindai QR Code untuk Check-in Presensi Panitia di Lokasi</p>
          </div>

          <div className="p-8 rounded-3xl bg-white shadow-2xl border-4 border-teal-500">
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code Fullscreen" className="w-72 h-72 sm:w-96 sm:h-96 object-contain" />}
          </div>

          <div className="mt-6 flex items-center gap-6 text-xs text-slate-500 font-mono">
            <span>Toleransi On-Time: {formatTimeWITA(activity.check_in_closes_at)}</span>
            <span>•</span>
            <span>Zona Waktu: Asia/Makassar (WITA)</span>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: KONFIRMASI BATALKAN PENUGASAN (MENCEGAH SALAH KLIK) */}
      {/* ============================================================================== */}
      {canManage && (
        <Modal
          isOpen={isRemoveAssignmentModalOpen}
          onClose={() => {
            if (!removingAssignment) {
              setIsRemoveAssignmentModalOpen(false);
              setAssignmentToRemove(null);
            }
          }}
          title="Konfirmasi Pembatalan Penugasan"
          description="Konfirmasi pembatalan tugas panitia untuk mencegah ketidaksengajaan klik."
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-rose-950">Yakin ingin membatalkan penugasan ini?</h4>
                <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                  Panitia tidak akan lagi terdaftar bertugas pada agenda ini, dan data presensi terkait agenda ini akan dihapus dari sistem.
                </p>
              </div>
            </div>

            {assignmentToRemove && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Nama Panitia:</span>
                  <span className="font-bold text-slate-900 text-xs">{assignmentToRemove.name}</span>
                </div>
                {assignmentToRemove.memberCode && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Nomor Anggota:</span>
                    <span className="font-mono text-slate-700 font-semibold">{assignmentToRemove.memberCode}</span>
                  </div>
                )}
                {assignmentToRemove.fieldName && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Divisi / Bidang:</span>
                    <span className="text-slate-700 font-medium">{assignmentToRemove.fieldName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Agenda Kegiatan:</span>
                  <span className="font-bold text-teal-800">{activity.activity_name}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={removingAssignment}
                onClick={() => {
                  setIsRemoveAssignmentModalOpen(false);
                  setAssignmentToRemove(null);
                }}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Batal (Kembali)
              </button>
              <button
                type="button"
                disabled={removingAssignment}
                onClick={confirmRemoveAssignment}
                className="px-4 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-600/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{removingAssignment ? 'Membatalkan...' : 'Ya, Batalkan Penugasan'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================================== */}
      {/* MODAL: TUGASKAN PANITIA (MULTI-SIE & FITUR PILIH SEMUA ANGGOTA - KHUSUS KOORDINATOR & ADMIN) */}
      {/* ============================================================================== */}
      {canManage && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Tugaskan Panitia ke Kegiatan"
          description="Koordinator setiap divisi/sie dapat memilih divisi miliknya dan menugaskan anggota yang bertugas pada agenda ini."
        >
        <form onSubmit={handleBatchAssign} className="space-y-4 text-xs">
          {/* Info Banner Penugasan Multi-Sie */}
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-teal-900">
              <Sparkles className="w-4 h-4 shrink-0 text-teal-600" />
              <span>Penugasan Panitia Lintas Sie / Divisi</span>
            </div>
            <p className="text-[11px] text-teal-800 leading-relaxed">
              Agenda ini dibuat untuk kegiatan organisasi. Jika Anda adalah koordinator sie atau pimpinan panitia, silakan pilih divisi Anda di bawah ini dan centang panitia yang ditugaskan.
            </p>
          </div>

          {/* Filter Divisi / Sie */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-800">
                Pilih Divisi / Sie yang Ditugaskan *
              </label>
              {myField && (
                <span className="text-[10px] text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded font-semibold">
                  Divisi Anda: {myField.field_name}
                </span>
              )}
            </div>
            <select
              value={assignModalFieldFilter}
              onChange={(e) => setAssignModalFieldFilter(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="all">Semua Divisi (Seluruh Panitia Organisasi)</option>
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.field_name} ({f.field_code}) {myField?.id === f.id ? '⭐ [Divisi Anda]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Checklist Anggota dengan Tombol Pilih Semua */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-700">
                Daftar Anggota Tersedia ({filteredUnassignedMembers.length} Tersedia, {selectedMemberIds.length} Dipilih)
              </label>

              {filteredUnassignedMembers.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="text-xs text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {filteredUnassignedMembers.every(m => selectedMemberIds.includes(m.id))
                    ? 'Batal Pilih Semua'
                    : `Pilih Semua (${filteredUnassignedMembers.length} Anggota)`}
                </button>
              )}
            </div>

            {filteredUnassignedMembers.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                Seluruh anggota panitia di kategori/divisi ini sudah ditugaskan pada agenda ini.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                {filteredUnassignedMembers.map((m) => {
                  const isChecked = selectedMemberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isChecked 
                          ? 'bg-teal-50 border border-teal-300 text-teal-900 font-medium' 
                          : 'hover:bg-white text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberSelection(m.id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <span className="font-semibold block">{m.full_name}</span>
                          <span className="text-[10px] text-slate-500">
                            {m.member_code} &bull; {m.organization_position}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/80 text-slate-600">
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
            <label className="block font-semibold text-slate-700 mb-1">Tipe Mandat Penugasan *</label>
            <select
              value={assignType}
              onChange={(e) => setAssignType(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-medium focus:outline-none focus:border-teal-500"
            >
              <option value="attendance_required">Wajib Hadir (attendance_required) - Syarat Nilai & Sertifikat</option>
              <option value="work_assignment">Tugas Kerja Lapangan (work_assignment)</option>
              <option value="coordinator_duty">Tugas Koordinator Sie (coordinator_duty)</option>
              <option value="committee_support">Dukungan Operasional (committee_support)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Peran Lapangan / Jobdesk di Agenda Ini (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: PJ Perlengkapan Sound System & Venue, atau Tim Konsumsi VIP, atau Dokumentasi Kamera 1"
              value={assignDescription}
              onChange={(e) => setAssignDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={assigning || selectedMemberIds.length === 0}
              className="px-5 py-2 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md shadow-teal-600/20 cursor-pointer"
            >
              {assigning ? 'Menyimpan...' : `Tugaskan ${selectedMemberIds.length} Panitia`}
            </button>
          </div>
        </form>
      </Modal>
      )}

      {/* MODAL: Edit Agenda Kegiatan */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Agenda Kegiatan"
        description="Perbarui informasi kegiatan, jadwal, toleransi presensi, atau batas jendela check-out."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleEditActivitySubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Kode Kegiatan *</label>
                <button
                  type="button"
                  onClick={() => {
                    const newCode = generateActivityCode(editForm.activityName, activity ? [activity.activity_code] : []);
                    setEditForm({ ...editForm, activityCode: newCode });
                  }}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
                  title="Generate ulang kode berdasarkan nama kegiatan"
                >
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Generate Otomatis</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={editForm.activityCode}
                onChange={(e) => setEditForm({ ...editForm, activityCode: e.target.value.toUpperCase() })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 font-mono font-bold focus:outline-none focus:border-teal-500 uppercase tracking-wide"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kegiatan *</label>
              <input
                type="text"
                required
                value={editForm.activityName}
                onChange={(e) => setEditForm({ ...editForm, activityName: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lokasi Kegiatan *</label>
              <input
                type="text"
                required
                value={editForm.activityLocation}
                onChange={(e) => setEditForm({ ...editForm, activityLocation: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Kegiatan</label>
              <select
                value={editForm.activityStatus}
                onChange={(e) => setEditForm({ ...editForm, activityStatus: e.target.value as any })}
                className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-500"
              >
                <option value="scheduled">Terjadwal (Scheduled)</option>
                <option value="ongoing">Sedang Berlangsung (Ongoing)</option>
                <option value="completed">Selesai (Completed)</option>
                <option value="cancelled">Dibatalkan (Cancelled)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Deskripsi Kegiatan</label>
            <textarea
              rows={2}
              value={editForm.activityDescription}
              onChange={(e) => setEditForm({ ...editForm, activityDescription: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-teal-50/50 rounded-xl border border-teal-200">
            <div>
              <label className="block font-semibold text-teal-900 mb-1">Check-in Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkInOpensAt}
                onChange={(e) => setEditForm({ ...editForm, checkInOpensAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-teal-300 text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-teal-900 mb-1">Batas Toleransi Check-in *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkInClosesAt}
                onChange={(e) => setEditForm({ ...editForm, checkInClosesAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-teal-300 text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
            <div>
              <label className="block font-semibold text-amber-900 mb-1">Check-out Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkOutOpensAt}
                onChange={(e) => setEditForm({ ...editForm, checkOutOpensAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-amber-700/80 mt-1">Check-out sebelum jam ini tercatat status "Mendahului".</p>
            </div>
            <div>
              <label className="block font-semibold text-amber-900 mb-1">Batas Toleransi Check-out *</label>
              <input
                type="datetime-local"
                required
                value={editForm.checkOutClosesAt}
                onChange={(e) => setEditForm({ ...editForm, checkOutClosesAt: e.target.value })}
                className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-amber-700/80 mt-1">Batas akhir penutupan jendela presensi pulang.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="detailEditAttendanceRequired"
              checked={editForm.attendanceRequired}
              onChange={(e) => setEditForm({ ...editForm, attendanceRequired: e.target.checked })}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <label htmlFor="detailEditAttendanceRequired" className="font-semibold text-slate-700 select-none">
              Wajib Melakukan Presensi
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updatingActivity}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-teal-600/20 cursor-pointer"
            >
              {updatingActivity ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================================== */}
      {/* MODAL: CETAK & UNDUH POSTER QR CODE (KHUSUS KOORDINATOR & ADMIN) */}
      {/* ============================================================================== */}
      {canManage && (
        <Modal
          isOpen={isPosterModalOpen}
          onClose={() => setIsPosterModalOpen(false)}
          title="Cetak & Unduh Poster QR Code Presensi"
          description="Cetak lembar poster resmi (format PDF / Kertas A4) atau unduh gambar (PNG/JPG) untuk ditempelkan di meja registrasi lokasi kegiatan."
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Live Interactive Preview Box of the Poster */}
            <div className="rounded-2xl border-2 border-teal-600 p-5 bg-white shadow-sm text-center relative overflow-hidden">
              <div className="border-b border-teal-600/30 pb-3 mb-3">
                <div className="flex justify-center mb-2">
                  <img
                    src="/logo-genre.png"
                    alt="Logo GenRe Kabupaten Buleleng"
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-teal-800 uppercase block">
                  PEMILIHAN DUTA GENRE KABUPATEN BULELENG
                </span>
                <span className="text-xs font-extrabold text-slate-900 uppercase block mt-0.5">
                  LEMBAR PRESENSI KEGIATAN RESMI
                </span>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-[10px] font-bold text-teal-800">
                  KODE: {activity.activity_code}
                </span>
              </div>

              <h3 className="font-extrabold text-base text-slate-900">{activity.activity_name}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                📍 {activity.activity_location} • 📅 {formatDateTimeWITA(activity.start_at)}
              </p>

              <div className="my-4 inline-block p-3 rounded-2xl bg-white border-2 border-teal-500 shadow-md">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="Preview QR Code"
                    className="w-44 h-44 mx-auto object-contain"
                  />
                )}
              </div>

              <div className="space-y-1 text-center">
                <p className="font-bold text-slate-900 text-xs">PINDAI QR CODE UNTUK PRESENSI KEHADIRAN</p>
                <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
                  Gunakan menu <strong>Presensi</strong> pada Sistem Absensi Panitia GenRe di smartphone Anda saat tiba di lokasi.
                </p>
              </div>

              <div className="mt-3 py-1.5 px-3 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-800 font-medium">
                ⚠️ QR Code ini diawasi oleh Koordinator & Penanggung Jawab di lokasi kegiatan.
              </div>
            </div>

            {/* Tombol Aksi Cetak & Unduh */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs">Pilih Opsi Cetak atau Unduh:</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Cetak PDF / Printer Langsung */}
                <button
                  type="button"
                  onClick={handlePrintPoster}
                  className="p-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center justify-center gap-2 shadow-sm shadow-teal-600/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <div className="text-left">
                    <div className="text-xs">Cetak Poster (PDF / Printer)</div>
                    <div className="text-[10px] font-normal text-teal-100">Format A4 siap dicetak & ditempel</div>
                  </div>
                </button>

                {/* 2. Unduh Gambar Poster Lengkap (PNG) */}
                <button
                  type="button"
                  onClick={() => handleDownloadPoster('png')}
                  disabled={downloadingPoster}
                  className="p-3 rounded-xl bg-white hover:bg-teal-50/50 text-slate-800 border border-slate-300 font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-teal-600" />
                  <div className="text-left">
                    <div className="text-xs">{downloadingPoster ? 'Menyiapkan...' : 'Unduh Poster (PNG)'}</div>
                    <div className="text-[10px] font-normal text-slate-500">Resolusi tinggi 1200x1680px</div>
                  </div>
                </button>

                {/* 3. Unduh Gambar Poster Lengkap (JPG) */}
                <button
                  type="button"
                  onClick={() => handleDownloadPoster('jpeg')}
                  disabled={downloadingPoster}
                  className="p-3 rounded-xl bg-white hover:bg-teal-50/50 text-slate-800 border border-slate-300 font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-amber-600" />
                  <div className="text-left">
                    <div className="text-xs">{downloadingPoster ? 'Menyiapkan...' : 'Unduh Poster (JPG)'}</div>
                    <div className="text-[10px] font-normal text-slate-500">Format ringan untuk kirim WA</div>
                  </div>
                </button>

                {/* 4. Unduh QR Code Saja (PNG) */}
                <button
                  type="button"
                  onClick={() => handleDownloadQrOnly('png')}
                  disabled={downloadingQrOnly}
                  className="p-3 rounded-xl bg-white hover:bg-teal-50/50 text-slate-800 border border-slate-300 font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <div className="text-left">
                    <div className="text-xs">{downloadingQrOnly ? 'Memproses...' : 'Unduh QR Saja (PNG)'}</div>
                    <div className="text-[10px] font-normal text-slate-500">Hanya QR Code 1200x1200px</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Tips Cetak:</strong> Saat dialog cetak peramban muncul, pilih <em>"Save as PDF"</em> untuk menyimpan file PDF, atau pilih printer terhubung untuk langsung mencetak di kertas A4.
              </span>
            </div>
          </div>
        </Modal>
      )}
      </div>

      {/* =========================================================================
          PRINTABLE POSTER SECTION (Hanya Muncul Saat window.print() / Cetak PDF)
      ========================================================================= */}
      {canManage && (
        <div id="printable-qr-poster" className="hidden print:block fixed inset-0 z-[9999] bg-white p-4 m-0">
          <div className="border-4 border-teal-800 p-8 h-full flex flex-col justify-between text-center font-sans">
            <div>
              {/* Header Lembaga & Acara */}
              <div className="border-b-2 border-teal-700 pb-4 mb-5">
                <div className="flex justify-center mb-3">
                  <img
                    src="/logo-genre.png"
                    alt="Logo GenRe Kabupaten Buleleng"
                    className="h-16 w-auto object-contain"
                  />
                </div>
                <h3 className="text-sm font-bold tracking-widest text-teal-800 uppercase">
                  PEMILIHAN DUTA GENRE KABUPATEN BULELENG 2026/2027
                </h3>
                <h1 className="text-2xl font-extrabold text-slate-900 mt-1 uppercase">
                  LEMBAR PRESENSI KEGIATAN RESMI
                </h1>
                <p className="text-xs font-mono font-bold text-teal-800 mt-1 bg-teal-50 inline-block px-3 py-0.5 rounded border border-teal-200">
                  KODE AGENDA: {activity.activity_code}
                </p>
              </div>

              {/* Detail Agenda */}
              <div className="mb-5">
                <h2 className="text-xl font-extrabold text-slate-900">{activity.activity_name}</h2>
                <div className="mt-3 inline-grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-left bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-xl mx-auto">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Lokasi Kegiatan:</span>
                    <p className="font-bold text-slate-900">{activity.activity_location}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Tanggal & Waktu:</span>
                    <p className="font-bold text-slate-900">{formatDateTimeWITA(activity.start_at)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Batas Toleransi Check-in:</span>
                    <p className="font-bold text-teal-700">{formatTimeWITA(activity.check_in_closes_at)} WITA</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Jendela Check-out:</span>
                    <p className="font-bold text-amber-700">{formatTimeWITA(activity.check_out_opens_at)} - {formatTimeWITA(activity.check_out_closes_at)} WITA</p>
                  </div>
                </div>
              </div>

              {/* QR Code Frame */}
              <div className="inline-block p-6 rounded-2xl border-4 border-teal-600 bg-white shadow-sm mb-5">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code Presensi ${activity.activity_code}`}
                    className="w-72 h-72 mx-auto object-contain"
                  />
                )}
              </div>

              {/* Petunjuk Presensi */}
              <div className="max-w-md mx-auto text-center space-y-1.5">
                <p className="text-base font-extrabold text-slate-900">
                  PINDAI QR CODE INI UNTUK PRESENSI KEHADIRAN
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  1. Buka menu <strong>Presensi</strong> di Sistem Absensi Panitia GenRe di smartphone Anda.<br />
                  2. Klik tombol <strong>Buka Kamera Scanner</strong> dan arahkan ke QR Code di atas.<br />
                  3. Presensi wajib dilakukan langsung di lokasi saat kedatangan dan kepulangan.
                </p>
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 font-semibold">
                  ⚠️ QR Code ini hanya sah dipindai secara fisik di lokasi kegiatan. Dilarang memfoto / membagikan ke luar lokasi.
                </div>
              </div>
            </div>

            {/* Signature & Pengesahan */}
            <div className="pt-5 border-t border-slate-300 mt-5 grid grid-cols-2 text-xs text-slate-800">
              <div>
                <p className="text-[11px] text-slate-500">Diverifikasi & Ditempel Oleh:</p>
                <p className="font-bold mt-1">Koordinator Divisi / Penanggung Jawab</p>
                <div className="h-14" />
                <p className="font-bold underline">Panitia Pelaksana GenRe</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Singaraja, Bali</p>
                <p className="font-bold mt-1">Badan Pengurus Duta GenRe Buleleng</p>
                <div className="h-14" />
                <p className="font-bold underline">Ida Bagus Angga Prabaswara, S.Pd</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
