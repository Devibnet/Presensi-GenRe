'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  Sparkles, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff,
  CheckCircle2,
  Info
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        // Cek jika lingkungan masih dummy
        if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('sample-genre-buleleng')) {
          setErrorMessage(
            'Lingkungan lokal masih menggunakan konfigurasi placeholder. Harap isi URL dan Anon Key Supabase asli Anda di .env.local atau gunakan panel bypass demo.'
          );
        } else {
          setErrorMessage(error.message || 'Email atau kata sandi tidak valid.');
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const fillMockAccount = (mockEmail: string) => {
    setEmail(mockEmail);
    setPassword('GenRe2026!Buleleng');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-navy-950 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-genre-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-genre-600 to-teal-400 flex items-center justify-center shadow-xl shadow-genre-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Masuk Portal Panitia
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Pemilihan Duta GenRe Kabupaten Buleleng 2026
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Alamat Email Panitia
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="nama.panitia@genre-buleleng.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-genre-400 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-genre-400 focus:border-transparent transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-genre-600 to-teal-500 hover:from-genre-500 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-genre-400 focus:ring-offset-2 focus:ring-offset-navy-950 transition-all shadow-lg shadow-genre-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Masuk Sistem</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Guide */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              <Info className="w-4 h-4 text-genre-400" />
              <span>Contoh Akun Uji (Seed Dataset):</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillMockAccount('ketua.admin@genre-buleleng.org')}
                className="w-full text-left p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 transition-colors flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-purple-300 block">BPH / Admin</span>
                  <span className="text-[11px] text-slate-400">ketua.admin@genre-buleleng.org</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">Pilih</span>
              </button>

              <button
                type="button"
                onClick={() => fillMockAccount('coord.acara@genre-buleleng.org')}
                className="w-full text-left p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 transition-colors flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-emerald-300 block">Koordinator Divisi Acara</span>
                  <span className="text-[11px] text-slate-400">coord.acara@genre-buleleng.org</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Pilih</span>
              </button>

              <button
                type="button"
                onClick={() => fillMockAccount('member.yoga@genre-buleleng.org')}
                className="w-full text-left p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 transition-colors flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-blue-300 block">Anggota Panitia</span>
                  <span className="text-[11px] text-slate-400">member.yoga@genre-buleleng.org</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">Pilih</span>
              </button>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/" className="text-xs text-slate-400 hover:text-genre-300 transition-colors">
            ← Kembali ke Halaman Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
