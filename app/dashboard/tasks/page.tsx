'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  Calendar, 
  Check, 
  X, 
  Send,
  Building,
  Flag,
  FileText
} from 'lucide-react';
import { Task, Profile, Field, Activity, TaskPriority, TaskStatus, SystemRole } from '@/lib/types';
import { formatDateTimeWITA, getStatusBadgeClass } from '@/lib/utils';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Modal Create Task
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Modal Submit Progress (Member)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [activeTaskAssignmentId, setActiveTaskAssignmentId] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // Modal Verify Progress (Coordinator/Admin)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyAssignmentId, setVerifyAssignmentId] = useState('');
  const [verifyTaskId, setVerifyTaskId] = useState('');
  const [verificationNote, setVerificationNote] = useState('');
  const [verifying, setVerifying] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. User profile
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

      // 2. Fetch Tasks with assignments, field, activity
      const { data: tasksData, error: taskErr } = await supabase
        .from('tasks')
        .select(`
          *,
          field:fields(*),
          activity:activities(*),
          assignments:task_assignments(
            *,
            member:profiles(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (!taskErr && tasksData && tasksData.length > 0) {
        setTasks(tasksData as any);
      } else {
        // Fallback realistic tasks
        setTasks(getFallbackTasks(currentProf?.id || ''));
      }

      // 3. Fetch auxiliary data
      const { data: fData } = await supabase.from('fields').select('*').order('field_name');
      if (fData) setFields(fData);

      const { data: mData } = await supabase.from('profiles').select('*').eq('account_status', 'active').order('full_name');
      if (mData) setMembers(mData as any);

      const { data: aData } = await supabase.from('activities').select('*').order('start_at', { ascending: false });
      if (aData) setActivities(aData);
    } catch (err) {
      console.error(err);
      setTasks(getFallbackTasks(''));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      // Dapatkan active period
      const { data: periodData } = await supabase
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .single();

      const periodId = periodData?.id || '00000000-0000-0000-0000-000000000001';

      // Insert task
      const { data: newTask, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          period_id: periodId,
          field_id: selectedFieldId || null,
          activity_id: selectedActivityId || null,
          task_title: title,
          task_description: description,
          priority: priority,
          task_status: 'open',
          due_at: dueDate ? new Date(dueDate).toISOString() : null,
          created_by: currentUser?.id || '00000000-0000-0000-0000-000000000001',
        })
        .select()
        .single();

      if (taskErr) throw taskErr;

      // Insert assignments if members selected
      if (newTask && assignedMemberIds.length > 0) {
        const assignmentRows = assignedMemberIds.map(mId => ({
          task_id: newTask.id,
          member_id: mId,
          assigned_by: currentUser?.id || '00000000-0000-0000-0000-000000000001',
          assignment_status: 'assigned',
        }));

        await supabase.from('task_assignments').insert(assignmentRows);
      }

      alert('Tugas operasional berhasil dibuat dan didelegasikan!');
      setIsCreateModalOpen(false);
      resetCreateForm();
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat tugas: ' + (err.message || 'Periksa koneksi Supabase.'));
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setSelectedFieldId('');
    setSelectedActivityId('');
    setDueDate('');
    setAssignedMemberIds([]);
  };

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressNote.trim()) return;

    setSubmittingProgress(true);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          progress_note: progressNote,
          submitted_at: new Date().toISOString(),
          assignment_status: 'submitted',
        })
        .eq('id', activeTaskAssignmentId);

      if (error) throw error;

      alert('Bukti progres tugas berhasil dikirimkan ke koordinator bidang!');
      setIsSubmitModalOpen(false);
      setProgressNote('');
      fetchData();
    } catch (err: any) {
      alert('Gagal mengirim progres: ' + err.message);
    } finally {
      setSubmittingProgress(false);
    }
  };

  const handleVerifyProgress = async (isApproved: boolean) => {
    setVerifying(true);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .update({
          assignment_status: isApproved ? 'completed' : 'rejected',
          verified_by: currentUser?.id,
          verified_at: new Date().toISOString(),
          verification_note: verificationNote || (isApproved ? 'Telah diverifikasi dan disetujui.' : 'Perlu perbaikan tugas.'),
        })
        .eq('id', verifyAssignmentId);

      if (error) throw error;

      // Update parent task status if completed
      if (isApproved && verifyTaskId) {
        await supabase
          .from('tasks')
          .update({ task_status: 'completed' })
          .eq('id', verifyTaskId);
      }

      alert(isApproved ? 'Tugas disetujui & diverifikasi tuntas!' : 'Tugas dikembalikan untuk perbaikan.');
      setIsVerifyModalOpen(false);
      setVerificationNote('');
      fetchData();
    } catch (err: any) {
      alert('Gagal memverifikasi: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  // Helper toggle member assignment
  const toggleMemberSelection = (id: string) => {
    setAssignedMemberIds(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  // Priority color
  const getPriorityBadgeClass = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      case 'medium':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
    }
  };

  const getPriorityLabel = (p: TaskPriority) => {
    switch (p) {
      case 'urgent': return 'Mendesak';
      case 'high': return 'Tinggi';
      case 'medium': return 'Sedang';
      default: return 'Rendah';
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const matchSearch = t.task_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.task_description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.task_status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const canManageTask = currentUser?.system_role === 'admin' || currentUser?.system_role === 'coordinator';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-brand-400" />
            Manajemen Tugas & Penugasan Panitia
          </h1>
          <p className="text-sm text-slate-400">
            Pemberian tanggung jawab operasional, monitoring progres, dan verifikasi penyelesaian tugas bidang.
          </p>
        </div>

        {canManageTask && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-brand-500/20 transition-all text-sm"
          >
            <Plus className="h-4 w-4" />
            Buat Tugas Baru
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-navy-900/60 border-slate-800">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari judul tugas, rincian instruksi..."
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
              <option value="open">Terbuka / Baru</option>
              <option value="in_progress">Sedang Dikerjakan</option>
              <option value="pending_review">Menunggu Verifikasi</option>
              <option value="completed">Selesai Diverifikasi</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-navy-950/70 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">Semua Prioritas</option>
              <option value="urgent">Mendesak</option>
              <option value="high">Tinggi</option>
              <option value="medium">Sedang</option>
              <option value="low">Rendah</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Task List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center bg-navy-900/40 border-slate-800">
          <ClipboardList className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Belum Ada Tugas Ditemukan</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Tidak ada tugas yang sesuai dengan kriteria filter pencarian Anda.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredTasks.map((task) => {
            // Cek apakah ada penugasan ke user saat ini
            const myAssignment = task.assignments?.find(a => a.member_id === currentUser?.id);
            const isCompleted = task.task_status === 'completed';

            return (
              <Card 
                key={task.id} 
                className="p-5 bg-navy-900/60 border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${getPriorityBadgeClass(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getStatusBadgeClass(task.task_status)}`}>
                        {task.task_status === 'completed' ? 'Selesai' :
                         task.task_status === 'pending_review' ? 'Menunggu Review' :
                         task.task_status === 'in_progress' ? 'Dikerjakan' : 'Terbuka'}
                      </span>
                    </div>

                    {task.due_at && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        Tenggat: {formatDateTimeWITA(task.due_at)}
                      </span>
                    )}
                  </div>

                  {/* Title & Desc */}
                  <h3 className="text-base font-semibold text-white mb-2 leading-snug">
                    {task.task_title}
                  </h3>
                  <p className="text-xs text-slate-300 line-clamp-3 mb-4 leading-relaxed">
                    {task.task_description}
                  </p>

                  {/* Context Info (Field & Activity) */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800/60">
                    {task.field && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Building className="h-3.5 w-3.5 text-brand-400" />
                        {task.field.field_name}
                      </span>
                    )}
                    {task.activity && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Calendar className="h-3.5 w-3.5 text-accent-400" />
                        {task.activity.activity_name}
                      </span>
                    )}
                  </div>

                  {/* Assigned Members */}
                  <div className="mb-4">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Panitia Pelaksana ({task.assignments?.length || 0})
                    </span>
                    <div className="space-y-1.5">
                      {task.assignments && task.assignments.length > 0 ? (
                        task.assignments.map((asg) => (
                          <div 
                            key={asg.id} 
                            className="flex items-center justify-between text-xs bg-navy-950/60 p-2 rounded-lg border border-slate-800/60"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 font-semibold flex items-center justify-center text-[10px]">
                                {asg.member?.full_name?.charAt(0) || 'P'}
                              </div>
                              <span className="text-slate-200 font-medium">
                                {asg.member?.full_name || 'Anggota Panitia'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusBadgeClass(asg.assignment_status)}`}>
                                {asg.assignment_status === 'completed' ? 'Tuntas' :
                                 asg.assignment_status === 'submitted' ? 'Diserahkan' :
                                 asg.assignment_status === 'rejected' ? 'Revisi' : 'Ditugaskan'}
                              </span>

                              {/* Coordinator Verify Action Button */}
                              {canManageTask && asg.assignment_status === 'submitted' && (
                                <button
                                  onClick={() => {
                                    setVerifyAssignmentId(asg.id);
                                    setVerifyTaskId(task.id);
                                    setIsVerifyModalOpen(true);
                                  }}
                                  className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium px-2 py-1 rounded transition-colors"
                                >
                                  Verifikasi
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic">Belum ada panitia yang ditugaskan khusus.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Member Action Bar */}
                {myAssignment && (
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-brand-400 font-medium flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Status Anda: {myAssignment.assignment_status.toUpperCase()}
                    </span>

                    {myAssignment.assignment_status !== 'completed' && (
                      <button
                        onClick={() => {
                          setActiveTaskAssignmentId(myAssignment.id);
                          setIsSubmitModalOpen(true);
                        }}
                        className="text-xs bg-brand-600 hover:bg-brand-500 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Send className="h-3 w-3" />
                        {myAssignment.assignment_status === 'submitted' ? 'Update Bukti Progres' : 'Kirim Bukti Progres'}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: Buat Tugas Baru */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Buat & Delegasikan Tugas Operasional"
        description="Tetapkan tugas kepada bidang atau anggota panitia tertentu beserta batas waktu pengerjaan."
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Judul Tugas <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pembuatan Backdrop Panggung Grand Final"
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Rincian Instruksi / Ruang Lingkup <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan spesifikasi tugas, output yang diharapkan, serta tautan berkas pendukung..."
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tingkat Prioritas</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
                <option value="urgent">Mendesak</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Batas Waktu (Tenggat)</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Divisi / Bidang Terkait</label>
              <select
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="">Umum / Lintas Bidang</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>{f.field_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Agenda Kegiatan Terkait</label>
              <select
                value={selectedActivityId}
                onChange={(e) => setSelectedActivityId(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="">Tidak Terkait Agenda Spesifik</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>{a.activity_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Anggota yang Ditugaskan */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Pilih Anggota Panitia yang Ditugaskan ({assignedMemberIds.length} dipilih)
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-navy-950 border border-slate-800 rounded-xl">
              {members.map((m) => (
                <label 
                  key={m.id}
                  className="flex items-center gap-2 p-1.5 hover:bg-slate-800/50 rounded-lg cursor-pointer text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={assignedMemberIds.includes(m.id)}
                    onChange={() => toggleMemberSelection(m.id)}
                    className="rounded border-slate-700 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{m.full_name}</span>
                  <span className="text-[10px] text-slate-500">({m.organization_position})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-xl disabled:opacity-50 transition-colors"
            >
              {creating ? 'Menyimpan...' : 'Terbitkan Tugas'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Kirim Progres (Anggota) */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Kirim Laporan & Bukti Progres Tugas"
        description="Sampaikan catatan perkembangan pengerjaan tugas atau cantumkan tautan bukti dokumen/Google Drive."
      >
        <form onSubmit={handleSubmitProgress} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Catatan Progres & Tautan Berkas <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Contoh: Desain backdrop selesai 100% dan sudah diserahkan ke vendor percetakan. Bukti invoice: drive.google.com/..."
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submittingProgress}
              className="px-4 py-2 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-xl disabled:opacity-50 transition-colors"
            >
              {submittingProgress ? 'Mengirim...' : 'Kirim Bukti Selesai'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Verifikasi Tugas (Koordinator/Admin) */}
      <Modal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        title="Verifikasi Hasil Pengerjaan Tugas"
        description="Tinjau hasil kerja panitia dan putuskan apakah tugas diterima tuntas atau memerlukan revisi."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Catatan Verifikator (Opsional)
            </label>
            <textarea
              rows={3}
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
              placeholder="Tuliskan catatan apresiasi atau poin revisi yang harus diperbaiki anggota..."
              className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={verifying}
              onClick={() => handleVerifyProgress(false)}
              className="px-4 py-2 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl transition-colors"
            >
              Tolak / Minta Revisi
            </button>
            <button
              type="button"
              disabled={verifying}
              onClick={() => handleVerifyProgress(true)}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
            >
              {verifying ? 'Memproses...' : 'Setujui & Tandai Tuntas'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Fallback Mock Data for demo preview
function getFallbackTasks(currentUserId: string): Task[] {
  return [
    {
      id: 'task-1',
      period_id: 'p-1',
      task_title: 'Koordinasi Venue & Tata Panggung Gedung Kesenian Gde Manik',
      task_description: 'Pastikan kesiapan sound system 10.000 watt, tata lampu panggung, dan layout 350 kursi undangan VIP.',
      priority: 'urgent',
      task_status: 'in_progress',
      due_at: '2026-10-23T18:00:00+08:00',
      created_by: 'admin-1',
      created_at: '2026-10-10T09:00:00+08:00',
      updated_at: '2026-10-10T09:00:00+08:00',
      field: {
        id: 'f-1',
        period_id: 'p-1',
        field_name: 'Bidang Perlengkapan & Logistik',
        field_code: 'LOGISTIK',
        field_status: 'active',
        created_at: '',
        updated_at: '',
      },
      assignments: [
        {
          id: 'asg-1',
          task_id: 'task-1',
          member_id: currentUserId || 'mem-1',
          assigned_by: 'admin-1',
          assigned_at: '2026-10-10T09:00:00+08:00',
          assignment_status: 'in_progress',
          progress_note: null,
          created_at: '',
          updated_at: '',
          member: {
            id: currentUserId || 'mem-1',
            member_code: 'GENRE-004',
            full_name: 'Wayan Eka Putra',
            email: 'wayan.eka@genre.org',
            organization_position: 'Staff Perlengkapan',
            system_role: 'member',
            account_status: 'active',
            joined_at: '',
            created_at: '',
            updated_at: '',
          },
        },
      ],
    },
    {
      id: 'task-2',
      period_id: 'p-1',
      task_title: 'Desain Banner, Id Card & Sertifikat Finalis GenRe Buleleng',
      task_description: 'Finalisasi mockup desain sesuai panduan visual identity BKKBN dan Forum GenRe Bali.',
      priority: 'high',
      task_status: 'pending_review',
      due_at: '2026-10-21T20:00:00+08:00',
      created_by: 'admin-1',
      created_at: '2026-10-09T14:00:00+08:00',
      updated_at: '2026-10-09T14:00:00+08:00',
      field: {
        id: 'f-2',
        period_id: 'p-1',
        field_name: 'Bidang Publikasi & Dokumentasi',
        field_code: 'PUBDOK',
        field_status: 'active',
        created_at: '',
        updated_at: '',
      },
      assignments: [
        {
          id: 'asg-2',
          task_id: 'task-2',
          member_id: 'mem-2',
          assigned_by: 'admin-1',
          assigned_at: '2026-10-09T14:00:00+08:00',
          assignment_status: 'submitted',
          progress_note: 'File siap cetak telah diunggah ke Google Drive panitia di folder /Pubdok/Cetak-Final.',
          created_at: '',
          updated_at: '',
          member: {
            id: 'mem-2',
            member_code: 'GENRE-005',
            full_name: 'Luh Putu Dian Swari',
            email: 'dian.swari@genre.org',
            organization_position: 'Staff Desain Komunikasi',
            system_role: 'member',
            account_status: 'active',
            joined_at: '',
            created_at: '',
            updated_at: '',
          },
        },
      ],
    },
    {
      id: 'task-3',
      period_id: 'p-1',
      task_title: 'Penyusunan Rundown Detil & Script MC Malam Grand Final',
      task_description: 'Sinkronisasi susunan acara dengan protokol Dinas PPKBPPPA Kabupaten Buleleng.',
      priority: 'high',
      task_status: 'completed',
      due_at: '2026-10-18T12:00:00+08:00',
      created_by: 'admin-1',
      created_at: '2026-10-08T10:00:00+08:00',
      updated_at: '2026-10-08T10:00:00+08:00',
      field: {
        id: 'f-3',
        period_id: 'p-1',
        field_name: 'Bidang Acara & Protokoler',
        field_code: 'ACARA',
        field_status: 'active',
        created_at: '',
        updated_at: '',
      },
      assignments: [
        {
          id: 'asg-3',
          task_id: 'task-3',
          member_id: 'mem-3',
          assigned_by: 'admin-1',
          assigned_at: '2026-10-08T10:00:00+08:00',
          assignment_status: 'completed',
          progress_note: 'Rundown final versi 3.2 telah disetujui Ketua Panitia.',
          verified_by: 'admin-1',
          verification_note: 'Sangat baik dan terstruktur rapi.',
          created_at: '',
          updated_at: '',
          member: {
            id: 'mem-3',
            member_code: 'GENRE-003',
            full_name: 'Ni Kadek Ayu Lestari',
            email: 'ayu.lestari@genre.org',
            organization_position: 'Koordinator Acara',
            system_role: 'coordinator',
            account_status: 'active',
            joined_at: '',
            created_at: '',
            updated_at: '',
          },
        },
      ],
    },
  ];
}
