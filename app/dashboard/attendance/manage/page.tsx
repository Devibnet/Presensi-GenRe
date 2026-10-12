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

export default function ManageAttendancePage() {
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
            activity:activities(activity_name, activity_code, check_in_closes_at)
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
      if (!user) throw new Error('Harap login');

      const targetReq = requests.find(r => r.id === requestId);
      if (!targetReq) return;

      const nowIso = new Date().toISOString();

      // 1. Update status di manual_attendance_requests
      const { error: reqErr } = await supabase
        .from('manual_attendance_requests')
        .update({
          review_status: status,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          review_note: reviewNote,
          updated_at: nowIso,
        })
        .eq('id', requestId);

      if (reqErr) throw reqErr;

      // 2. Jika disetujui, buat atau perbarui baris di attendances
      if (status === 'approved') {
        const assignmentId = targetReq.activity_assignment_id;
        const claimedTime = targetReq.claimed_event_time;

        const { data: existingAtt } = await supabase
          .from('attendances')
          .select('id')
          .eq('activity_assignment_id', assignmentId)
          .maybeSingle();

        if (existingAtt) {
          await supabase
            .from('attendances')
            .update({
              check_out_at: claimedTime,
              check_out_method: 'manual',
              verification_status: 'approved',
              verified_by: user.id,
              verified_at: nowIso,
              attendance_note: `Disetujui manual: ${reviewNote || targetReq.reason}`,
              updated_at: nowIso,
            })
            .eq('id', existingAtt.id);
        } else {
          await supabase
            .from('attendances')
            .insert({
              activity_assignment_id: assignmentId,
              check_in_at: claimedTime,
              check_in_method: 'manual',
              check_in_status: 'on_time',
              verification_status: 'approved',
              verified_by: user.id,
              verified_at: nowIso,
              attendance_note: `Disetujui manual: ${reviewNote || targetReq.reason}`,
            });
        }
      }

      alert(`Permohonan berhasil di-${status === 'approved' ? 'setujui' : 'tolak'}!`);
      fetchPendingRequests();
    } catch (err: any) {
      alert('Gagal memproses keputusan: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Verifikasi Presensi Manual</h1>
        <p className="text-xs text-slate-400 mt-1">
          Tinjau permohonan kehadiran panitia yang mengalami kendala teknis saat kegiatan
        </p>
      </div>

      <Card title={`Daftar Pengajuan (${requests.length} Permohonan)`}>
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-genre-500 border-t-transparent rounded-full animate-spin" />
            <span>Memuat data pengajuan manual...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Tidak ada permohonan presensi manual yang masuk.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{req.member?.full_name}</span>
                    <span className="text-[11px] font-mono text-genre-400">({req.member?.member_code})</span>
                    <Badge status={req.review_status} />
                  </div>

                  <div className="text-xs text-slate-300">
                    <span className="text-slate-400">Kegiatan: </span>
                    <span className="font-semibold text-white">
                      {req.activity_assignment?.activity?.activity_name} ({req.activity_assignment?.activity?.activity_code})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 font-mono">
                    <div>Waktu Diklaim: {formatDateTimeWITA(req.claimed_event_time)}</div>
                    <div>Waktu Diajukan: {formatDateTimeWITA(req.recorded_at)}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                    <span className="text-slate-400 block text-[11px] font-semibold mb-1">Alasan Permohonan:</span>
                    <p className="text-slate-200 leading-relaxed">{req.reason}</p>
                  </div>

                  {req.evidence_url && (
                    <a
                      href={req.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-genre-400 hover:text-genre-300 font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Lihat Bukti Lampiran</span>
                    </a>
                  )}
                </div>

                {req.review_status === 'pending' && (
                  <div className="flex sm:flex-col items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleDecision(req.id, 'approved')}
                      disabled={processingId === req.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Setujui</span>
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, 'rejected')}
                      disabled={processingId === req.id}
                      className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
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
