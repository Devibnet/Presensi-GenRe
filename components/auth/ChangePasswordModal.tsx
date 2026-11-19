'use client';

import React, { useState, useMemo } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Evaluasi Aturan Keamanan Real-Time
  const rules = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasMaxLength = newPassword.length <= 64;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSym = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);
    const isDifferent =
      newPassword.length > 0 &&
      currentPassword.length > 0 &&
      newPassword !== currentPassword;
    const isMatch =
      newPassword.length > 0 &&
      confirmPassword.length > 0 &&
      newPassword === confirmPassword;

    let score = 0;
    if (hasMinLength) score += 20;
    if (hasUpper) score += 20;
    if (hasLower) score += 20;
    if (hasNum) score += 20;
    if (hasSym) score += 20;

    const allPassed =
      hasMinLength &&
      hasMaxLength &&
      hasUpper &&
      hasLower &&
      hasNum &&
      hasSym &&
      isDifferent &&
      isMatch;

    return {
      hasMinLength,
      hasMaxLength,
      hasUpper,
      hasLower,
      hasNum,
      hasSym,
      isDifferent,
      isMatch,
      score,
      allPassed,
    };
  }, [newPassword, currentPassword, confirmPassword]);

  // Deskripsi Kekuatan Kata Sandi
  const strengthInfo = useMemo(() => {
    if (newPassword.length === 0) return { label: 'Belum diisi', color: 'bg-slate-200', text: 'text-slate-400' };
    if (rules.score < 40) return { label: 'Lemah', color: 'bg-rose-500', text: 'text-rose-600' };
    if (rules.score < 80) return { label: 'Sedang', color: 'bg-amber-500', text: 'text-amber-600' };
    if (rules.score < 100) return { label: 'Kuat', color: 'bg-emerald-500', text: 'text-emerald-600' };
    return { label: 'Sangat Kuat & Aman', color: 'bg-teal-600', text: 'text-teal-600' };
  }, [newPassword, rules.score]);

  // Reset form ketika modal ditutup
  const handleClose = () => {
    if (loading) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setErrorMessage(null);
    setIsSuccess(false);
    onClose();
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi eksplisit jika ada aturan yang belum terpenuhi
    if (!currentPassword.trim()) {
      setErrorMessage('Harap masukkan kata sandi Anda saat ini untuk verifikasi identitas.');
      return;
    }
    if (!newPassword) {
      setErrorMessage('Harap tentukan kata sandi baru.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage('Kata sandi baru tidak boleh sama dengan kata sandi saat ini. Pastikan kolom "Kata Sandi Saat Ini" diisi dengan kata sandi lama Anda saat login.');
      return;
    }
    if (!rules.hasMinLength) {
      setErrorMessage('Kata sandi baru minimal harus 8 karakter.');
      return;
    }
    if (!rules.hasUpper) {
      setErrorMessage('Kata sandi baru wajib mengandung minimal 1 huruf kapital (A-Z).');
      return;
    }
    if (!rules.hasLower) {
      setErrorMessage('Kata sandi baru wajib mengandung minimal 1 huruf kecil (a-z).');
      return;
    }
    if (!rules.hasNum) {
      setErrorMessage('Kata sandi baru wajib mengandung minimal 1 angka (0-9).');
      return;
    }
    if (!rules.hasSym) {
      setErrorMessage('Kata sandi baru wajib mengandung minimal 1 simbol / karakter khusus (contoh: !@#$%&*).');
      return;
    }
    if (!confirmPassword) {
      setErrorMessage('Harap ulangi kata sandi baru pada kolom konfirmasi.');
      return;
    }
    if (!rules.isMatch) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
      return;
    }
    if (!rules.allPassed) {
      setErrorMessage('Harap lengkapi seluruh ketentuan keamanan kata sandi.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui kata sandi.');
      }

      setIsSuccess(true);
      if (onSuccess) onSuccess();

      // Refresh notifikasi navbar jika ada custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
      }

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Perbarui Kata Sandi Akun"
      description="Tingkatkan keamanan akun portal presensi Anda dengan kata sandi baru berstandar tinggi."
      maxWidth="max-w-lg"
    >
      {isSuccess ? (
        <div className="py-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-sm animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Kata Sandi Berhasil Diperbarui!
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              Akun Anda kini terlindungi dengan kata sandi baru. Sistem otomatis mencatat log audit pembaruan keamanan.
            </p>
          </div>
          <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl text-[11px] text-teal-800 font-medium">
            Jendela ini akan menutup otomatis dalam beberapa detik...
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold block">Gagal Memperbarui:</span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* 1. Kata Sandi Saat Ini */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Kata Sandi Saat Ini (Sandi Lama) <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-teal-700 font-semibold">Sandi yang dipakai login saat ini</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan kata sandi lama Anda saat login..."
                className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showCurrent ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. Kata Sandi Baru */}
          <div className="space-y-1.5 pt-1">
            <label className="font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                Kata Sandi Baru <span className="text-rose-500">*</span>
              </span>
              <span className={`text-[10px] font-bold ${strengthInfo.text}`}>
                {strengthInfo.label}
              </span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan kata sandi baru..."
                className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showNew ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength Meter Bar */}
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full transition-all duration-300 ${strengthInfo.color}`}
                style={{ width: `${rules.score}%` }}
              />
            </div>

            {/* Checklist Standar Keamanan Super Ketat */}
            <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1.5 mt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-teal-600" />
                Ketentuan Keamanan Sandi:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                <div
                  className={`flex items-center gap-1.5 ${
                    rules.hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {rules.hasMinLength ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span>Minimal 8 karakter</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    rules.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {rules.hasUpper ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span>1 Huruf besar (A-Z)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    rules.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {rules.hasLower ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span>1 Huruf kecil (a-z)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    rules.hasNum ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {rules.hasNum ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span>1 Angka (0-9)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    rules.hasSym ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {rules.hasSym ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span>1 Simbol (!@#$%&*)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    rules.isDifferent
                      ? 'text-emerald-700 font-semibold'
                      : newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword
                      ? 'text-rose-600 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  {rules.isDifferent ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X
                      className={`w-3.5 h-3.5 shrink-0 ${
                        newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword
                          ? 'text-rose-600'
                          : 'text-slate-300'
                      }`}
                    />
                  )}
                  <span>
                    {newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword
                      ? 'Harus beda dari sandi lama (masih sama)'
                      : 'Berbeda dari kata sandi lama'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Konfirmasi Kata Sandi Baru */}
          <div className="space-y-1.5 pt-1">
            <label className="font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-600" />
                Ulangi Kata Sandi Baru <span className="text-rose-500">*</span>
              </span>
              {confirmPassword.length > 0 && (
                <span
                  className={`text-[10px] font-bold ${
                    rules.isMatch ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {rules.isMatch ? '✓ Cocok' : '✗ Belum cocok'}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru..."
                className={`w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border transition-all font-mono ${
                  confirmPassword.length > 0 && !rules.isMatch
                    ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showConfirm ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Peringatan Keamanan Privasi */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Pemberitahuan:</strong> Setelah kata sandi diganti, akun Anda berstatus{' '}
              <em>&ldquo;Telah Diubah Mandiri oleh Panitia&rdquo;</em> sehingga kerahasiaan kata sandi baru
              sepenuhnya terlindungi enkripsi dan tidak dapat dilihat oleh siapa pun.
            </span>
          </div>

          {/* Tombol Aksi */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl font-bold text-white transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2 text-xs ${
                rules.allPassed
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-600/20'
                  : 'bg-teal-700/80 hover:bg-teal-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memverifikasi Keamanan...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Simpan Kata Sandi Baru</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
