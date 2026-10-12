'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  Calendar, 
  Plus, 
  MapPin, 
  Clock, 
  QrCode, 
  Users, 
  ArrowRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Activity } from '@/lib/types';
import { formatDateTimeWITA } from '@/lib/utils';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'coordinator' | 'member'>('member');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [periodId, setPeriodId] = useState('');
  const [activityCode, setActivityCode] = useState('');
  const [activityName, setActivityName] = useState('');
  const [activityLocation, setActivityLocation] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [checkInOpensAt, setCheckInOpensAt] = useState('');
  const [checkInClosesAt, setCheckInClosesAt] = useState('');
  const [checkOutOpensAt, setCheckOutOpensAt] = useState('');
  const [checkOutClosesAt, setCheckOutClosesAt] = useState('');
  const [assignAllMembers, setAssignAllMembers] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('system_role')
          .eq('id', user.id)
          .single();
        if (profile) setUserRole(profile.system_role);
      }

      const { data: periods } = await supabase
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .limit(1);
      if (periods && periods.length > 0) setPeriodId(periods[0].id);

      const { data } = await supabase
        .from('activities')
        .select('*')
        .order('start_at', { ascending: true });
      if (data) setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Harap login terlebih dahulu');

      const { data, error } = await supabase
        .from('activities')
        .insert({
          period_id: periodId || '00000000-0000-0000-0000-000000000001',
          activity_code: activityCode.trim().toUpperCase(),
          activity_name: activityName.trim(),
          activity_description: activityDescription.trim() || null,
          activity_location: activityLocation.trim(),
          start_at: new Date(startAt).toISOString(),
          end_at: new Date(endAt).toISOString(),
          check_in_opens_at: new Date(checkInOpensAt).toISOString(),
          check_in_closes_at: new Date(checkInClosesAt).toISOString(),
          check_out_opens_at: new Date(checkOutOpensAt).toISOString(),
          check_out_closes_at: new Date(checkOutClosesAt).toISOString(),
          activity_status: 'scheduled',
          attendance_required: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Buat default attendance session
      if (data) {
        await supabase.from('attendance_sessions').insert({
          activity_id: data.id,
          session_name: `Presensi Utama ${data.activity_name}`,
          session_code: `${data.activity_code}-MAIN`,
          session_status: 'open',
          created_by: user.id,
        });

        // Jika opsi wajib hadir seluruh panitia dicentang, tugaskan seluruh panitia aktif
        if (assignAllMembers) {
          const { data: allMembers } = await supabase
            .from('profiles')
            .select('id')
            .eq('account_status', 'active');

          if (allMembers && allMembers.length > 0) {
            const batchAssignments = allMembers.map(m => ({
              activity_id: data.id,
              member_id: m.id,
              assignment_type: 'attendance_required',
              assignment_description: 'Wajib Hadir Seluruh Panitia',
              assignment_status: 'active',
              assigned_by: user.id,
            }));

            await supabase
              .from('activity_assignments')
              .upsert(batchAssignments, { onConflict: 'activity_id,member_id' });
          }
        }
      }

      setIsCreateModalOpen(false);
      setActivityCode('');
      setActivityName('');
      setActivityLocation('');
      setActivityDescription('');
      setStartAt('');
      setEndAt('');
      setCheckInOpensAt('');
      setCheckInClosesAt('');
      setCheckOutOpensAt('');
      setCheckOutClosesAt('');
      setAssignAllMembers(false);
      fetchActivities();
    } catch (err: any) {
      alert('Gagal membuat agenda: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Agenda Kegiatan Panitia</h1>
          <p className="text-xs text-slate-400 mt-1">
            Jadwal kegiatan resmi, jendela toleransi presensi, dan monitoring kehadiran panitia
          </p>
        </div>

        {(userRole === 'admin' || userRole === 'coordinator') && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-genre-600 hover:bg-genre-500 transition-colors shadow-lg shadow-genre-500/20 flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Agenda Kegiatan</span>
          </button>
        )}
      </div>

      {/* Activities Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-genre-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat agenda kegiatan...</span>
        </div>
      ) : activities.length === 0 ? (
        <Card className="text-center py-12">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">Belum Ada Agenda Kegiatan</h3>
          <p className="text-xs text-slate-400 mt-1">Agenda kegiatan resmi yang dibuat akan muncul di sini.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activities.map((act) => (
            <Card key={act.id} className="hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-mono font-bold text-genre-400 px-2 py-0.5 rounded bg-genre-500/10 border border-genre-500/20">
                    {act.activity_code}
                  </span>
                  <Badge status={act.activity_status} />
                </div>

                <h3 className="font-bold text-white text-base leading-snug">{act.activity_name}</h3>
                {act.activity_description && (
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {act.activity_description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{act.activity_location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{formatDateTimeWITA(act.start_at)} s/d {formatDateTimeWITA(act.end_at)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                    <span className="text-genre-400 font-semibold block">Jendela Check-in On-Time:</span>
                    <span>{formatDateTimeWITA(act.check_in_opens_at)} - {formatDateTimeWITA(act.check_in_closes_at)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  {act.attendance_required ? 'Wajib Presensi' : 'Opsional'}
                </span>

                <Link
                  href={`/dashboard/activities/${act.id}`}
                  className="px-3.5 py-1.5 rounded-lg bg-genre-600/20 hover:bg-genre-600/30 border border-genre-500/30 text-genre-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Detail & Sesi QR</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Buat Kegiatan */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Buat Agenda Kegiatan Baru"
        description="Atur jadwal agenda kepanitiaan dan rentang waktu toleransi check-in."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateActivity} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Kode Kegiatan *</label>
              <input
                type="text"
                required
                placeholder="ACT-WORKSHOP-2"
                value={activityCode}
                onChange={(e) => setActivityCode(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Nama Kegiatan *</label>
              <input
                type="text"
                required
                placeholder="Workshop Public Speaking Finalis"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Lokasi Kegiatan *</label>
            <input
              type="text"
              required
              placeholder="Gedung Kesenian Gde Manik Singaraja"
              value={activityLocation}
              onChange={(e) => setActivityLocation(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Deskripsi & Instruksi Panitia</label>
            <textarea
              rows={2}
              placeholder="Briefing dress code dan jobdesk per divisi..."
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Waktu Mulai Acara *</label>
              <input
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Waktu Selesai Acara *</label>
              <input
                type="datetime-local"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-genre-300 mb-1">Check-in Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={checkInOpensAt}
                onChange={(e) => setCheckInOpensAt(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-genre-300 mb-1">Batas Check-in On-Time *</label>
              <input
                type="datetime-local"
                required
                value={checkInClosesAt}
                onChange={(e) => setCheckInClosesAt(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Check-out Dibuka *</label>
              <input
                type="datetime-local"
                required
                value={checkOutOpensAt}
                onChange={(e) => setCheckOutOpensAt(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Check-out Ditutup *</label>
              <input
                type="datetime-local"
                required
                value={checkOutClosesAt}
                onChange={(e) => setCheckOutClosesAt(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              />
            </div>
          </div>

          {/* Opsi Wajib Hadir Seluruh Panitia */}
          <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-brand-300">
              <input
                type="checkbox"
                checked={assignAllMembers}
                onChange={(e) => setAssignAllMembers(e.target.checked)}
                className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span>Wajib Hadir Seluruh Panitia (Otomatis tugaskan seluruh anggota panitia aktif)</span>
            </label>
            <p className="text-[11px] text-slate-400 mt-1 pl-6">
              Cocok untuk Rapat Pleno, Gladi Bersih, atau Malam Grand Final di mana seluruh panitia wajib hadir tanpa perlu ditugaskan manual per sie.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-xl font-semibold text-white bg-genre-600 hover:bg-genre-500 disabled:opacity-50 flex items-center gap-2"
            >
              {creating ? 'Menyimpan...' : 'Simpan Agenda Kegiatan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
