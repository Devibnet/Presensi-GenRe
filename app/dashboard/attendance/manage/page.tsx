'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  CheckSquare, 
  Check, 
  X, 
  ExternalLink, 
  Clock, 
  User, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { formatDateTimeWITA } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { sendInAppNotification } from '@/lib/notifications';

export default function ManageAttendancePage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('manual_attendance_requests')
        .select(`
          *,
          member:profiles!requested_by(full_name, member_code, email),
          activity_assignment:activity_assignments(
            id,
            activity:activities(activity_name, activity_code, check_in_closes_at, check_out_opens_at, end_at)
          )
        `)
        .order('created_at', { ascending: false });

      if (data) setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (requestId: string, status: 'approved' | 'rejected') => {
    setProcessingId(requestId);
    const reviewNote = prompt(`Catatan keputusan untuk ${status === 'approved' ? 'menyetujui' : 'menolak'}:`) || '';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let reviewerId = user?.id;
      if (!reviewerId) {
        const { data: adminProf } = await supabase
          .from('profiles')
          .select('id')
          .in('system_role', ['admin', 'coordinator'])
          .limit(1)
          .maybeSingle();
        reviewerId = adminProf?.id || '11111111-0000-0000-0000-000000000001';
      }

      const targetReq = requests.find(r => r.id === requestId);
      if (!targetReq) return;

      const nowIso = new Date().toISOString();

      // 1. Update status di manual_attendance_requests
      const { error: reqErr } = await supabase
        .from('manual_attendance_requests')
        .update({
          review_status: status,
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: reviewNote,
          updated_at: nowIso,
        })
        .eq('id', requestId);

      if (reqErr) throw reqErr;

      // 2. Jika disetujui, buat atau perbarui baris di attendances sesuai attendance_type
      if (status === 'approved') {
        const assignmentId = targetReq.activity_assignment_id;
        const claimedTime = targetReq.claimed_event_time;
        const attType = targetReq.attendance_type || 'check_in';
        const act = targetReq.activity_assignment?.activity;

        // Evaluasi ketepatan waktu kedatangan jika permohonan check-in
        let isLate = false;
        if (act?.check_in_closes_at) {
          isLate = new Date(claimedTime) > new Date(act.check_in_closes_at);
        }
        const checkInStatus = isLate ? 'late' : 'on_time';

        // Evaluasi kepulangan mendahului jika permohonan check-out
        let isEarly = false;
        if (act?.check_out_opens_at) {
          isEarly = new Date(claimedTime) < new Date(act.check_out_opens_at);
        } else if (act?.end_at) {
          isEarly = new Date(claimedTime) < new Date(act.end_at);
        }
        const checkOutStatus = isEarly ? 'early_departure' : 'normal';

        const { data: existingAtt } = await supabase
          .from('attendances')
          .select('id, check_in_at, check_out_at, attendance_note')
          .eq('activity_assignment_id', assignmentId)
          .maybeSingle();

        const noteText = `Disetujui manual oleh Koordinator: ${reviewNote || targetReq.reason}`;

        if (existingAtt) {
          const updatePayload: any = {
            verification_status: 'approved',
            verified_by: reviewerId,
            verified_at: nowIso,
            attendance_note: existingAtt.attendance_note ? `${existingAtt.attendance_note} | ${noteText}` : noteText,
            updated_at: nowIso,
          };

          if (attType === 'check_in' || attType === 'both') {
            updatePayload.check_in_at = claimedTime;
            updatePayload.check_in_method = 'manual';
            updatePayload.check_in_status = checkInStatus;
          }
          if (attType === 'check_out' || attType === 'both') {
            updatePayload.check_out_at = claimedTime;
            updatePayload.check_out_method = 'manual';
            updatePayload.check_out_status = checkOutStatus;
          }

          await supabase.from('attendances').update(updatePayload).eq('id', existingAtt.id);
        } else {
          const insertPayload: any = {
            activity_assignment_id: assignmentId,
            verification_status: 'approved',
            verified_by: reviewerId,
            verified_at: nowIso,
            attendance_note: noteText,
            created_at: nowIso,
            updated_at: nowIso,
          };

          if (attType === 'check_in' || attType === 'both') {
            insertPayload.check_in_at = claimedTime;
            insertPayload.check_in_method = 'manual';
            insertPayload.check_in_status = checkInStatus;
          } else {
            // Jika hanya check-out tapi belum pernah check-in
            insertPayload.check_in_at = claimedTime;
            insertPayload.check_in_method = 'manual';
            insertPayload.check_in_status = 'on_time';
          }

          if (attType === 'check_out' || attType === 'both') {
            insertPayload.check_out_at = claimedTime;
            insertPayload.check_out_method = 'manual';
            insertPayload.check_out_status = checkOutStatus;
          }

          await supabase.from('attendances').insert(insertPayload);
        }
      }

      const targetMemberId = targetReq.requested_by || targetReq.member_id;
      if (status === 'approved' && targetMemberId) {
        // Otomatis sinkronkan skor presensi dan evaluasi akhir ke sistem
        fetch('/api/evaluations/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: targetMemberId }),
        }).catch((e) => console.warn('Gagal trigger kalkulasi evaluasi:', e));
      }


      if (status === 'approved') {
        toast.success(
          'Permohonan Disetujui',
          `Presensi manual untuk ${targetReq.member?.full_name || 'anggota'} telah disahkan.`
        );
      } else {
        toast.info(
          'Permohonan Ditolak',
          `Permohonan presensi untuk ${targetReq.member?.full_name || 'anggota'} telah ditolak.`
        );
      }

      // Kirim notifikasi in-app ke pemohon
      if (targetReq.requested_by) {
        sendInAppNotification({
          userId: targetReq.requested_by,
          title: status === 'approved' ? 'Permohonan Presensi Disetujui' : 'Permohonan Presensi Ditolak',
          message: `Permohonan presensi kegiatan "${targetReq.activity_assignment?.activity?.activity_name || 'kegiatan'}" telah ${status === 'approved' ? 'disetujui' : 'ditolak'}. Catatan: ${reviewNote || '-'}`,
          notificationType: 'attendance',
          actionUrl: '/dashboard/attendance',
        });
      }

      fetchPendingRequests();
    } catch (err: any) {
      toast.error('Gagal Memproses Keputusan', err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Verifikasi Presensi Manual</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Tinjau permohonan kehadiran panitia yang mengalami kendala teknis saat kegiatan
        </p>
      </div>

      <Card title={`Daftar Pengajuan (${requests.length} Permohonan)`}>
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Memuat data pengajuan manual...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Tidak ada permohonan presensi manual yang masuk.
          </div>
        ) : (
          <div className="space-y-3.5 sm:space-y-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{req.member?.full_name}</span>
                    <span className="text-[11px] font-mono font-semibold text-teal-700">({req.member?.member_code})</span>
                    <Badge status={req.review_status} />
                  </div>

                  <div className="text-xs text-slate-700">
                    <span className="text-slate-500">Kegiatan: </span>
                    <span className="font-semibold text-slate-900">
                      {req.activity_assignment?.activity?.activity_name} ({req.activity_assignment?.activity?.activity_code})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs text-slate-500 font-mono">
                    <div>Waktu Diklaim: {formatDateTimeWITA(req.claimed_event_time)}</div>
                    <div>Waktu Diajukan: {formatDateTimeWITA(req.recorded_at)}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                    <span className="text-slate-500 block text-[11px] font-semibold mb-1">Alasan Permohonan:</span>
                    <p className="text-slate-800 leading-relaxed">{req.reason}</p>
                  </div>

                  {req.evidence_url && (
                    <a
                      href={req.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Lihat Bukti Lampiran</span>
                    </a>
                  )}
                </div>

                {req.review_status === 'pending' && (
                  <div className="flex sm:flex-col items-center gap-2 self-start md:self-center">
                    <button
                      onClick={() => handleDecision(req.id, 'approved')}
                      disabled={processingId === req.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-600/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Setujui</span>
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, 'rejected')}
                      disabled={processingId === req.id}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
