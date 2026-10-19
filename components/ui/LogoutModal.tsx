'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, AlertTriangle, X } from 'lucide-react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

export function LogoutModal({ isOpen, onClose, userName }: LogoutModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key listener & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen || !mounted) return null;

  const handleConfirmLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();

      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        localStorage.removeItem('supabase.auth.token');
      }

      onClose();
      // Redirect ke login dengan parameter loggedOut dan timestamp unik untuk membersihkan autofill
      router.push(`/login?loggedOut=1&t=${Date.now()}`);
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      setLoading(false);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-7 relative overflow-hidden my-auto"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Subtle decorative background highlight */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-rose-100/50 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          disabled={loading}
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          title="Batal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header & Icon */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
              Konfirmasi Keluar Akun
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sistem Absensi & Evaluasi Panitia GenRe 2026
            </p>
          </div>
        </div>

        {/* Modal Body / Information */}
        <div className="space-y-3 mb-6 text-slate-600 text-xs sm:text-sm leading-relaxed">
          <p>
            Apakah Anda yakin ingin mengakhiri sesi dan keluar dari portal?
          </p>

          {userName && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 font-bold text-white text-xs flex items-center justify-center shrink-0 shadow-xs">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden min-w-0">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Akun Saat Ini</span>
                <span className="text-xs font-bold text-slate-900 block truncate">{userName}</span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span className="leading-relaxed">Pastikan seluruh input presensi atau penilaian Anda telah tersimpan sebelum keluar.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs sm:text-sm transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleConfirmLogout}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-rose-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses Keluar...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>Ya, Keluar Akun</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
