'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Sparkles, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Award,
  HelpCircle,
  X,
  Clock,
  Shield
} from 'lucide-react';
import { GenreLogo } from '@/components/ui/GenreLogo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/dashboard';
  const isLoggedOut = searchParams?.get('loggedOut') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const supabase = createClient();

  // Reset email dan password agar saat logout / pertama buka kolom selalu kosong tanpa tersimpan di cache form
  useEffect(() => {
    setEmail('');
    setPassword('');
    setErrorMessage(null);

    // Timer bertahap untuk mencegah autofill agresif dari browser setelah navigasi logout
    const timer1 = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 50);

    const timer2 = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 250);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Harap lengkapi email dan kata sandi Anda.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage('Email atau kata sandi tidak cocok. Silakan periksa kembali akun Anda.');
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Email Anda belum dikonfirmasi. Silakan hubungi Sekretariat Panitia.');
        } else {
          setErrorMessage(error.message || 'Gagal masuk ke sistem. Silakan coba kembali.');
        }
        setLoading(false);
        return;
      }

      if (data?.session) {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi gangguan koneksi jaringan. Silakan coba sesaat lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white text-slate-900 selection:bg-teal-500 selection:text-white relative overflow-hidden font-sans">
      {/* Ambient background lighting and subtle geometric pattern */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-teal-100/40 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-emerald-100/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

      {/* LEFT COLUMN: Premium Official Showcase (Desktop >= lg) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 xl:p-16 border-r border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-white/80 to-teal-50/40 backdrop-blur-sm z-10">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-white p-1.5 border border-slate-200/90 flex items-center justify-center shadow-md shadow-slate-200/50">
            <GenreLogo size={46} priority />
          </div>
          <div>
            <span className="font-black text-xl tracking-tight text-slate-900 block leading-tight">
              GenRe Attendance
            </span>
            <span className="text-[11px] tracking-wider text-teal-700 font-bold uppercase block">
              Kabupaten Buleleng • 2026
            </span>
          </div>
        </div>

        {/* Hero Narrative */}
        <div className="my-auto py-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold mb-6 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Portal Resmi Kepanitiaan Terpadu</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-[1.2]">
            Kontrol Absensi Cerdas &{' '}
            <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Penilaian Panitia Terpadu
            </span>
          </h2>

          <p className="mt-4 text-sm xl:text-base text-slate-600 leading-relaxed font-normal">
            Platform operasional resmi bagi seluruh panitia, koordinator bidang, dan BPH Pemilihan Duta GenRe Kabupaten Buleleng 2026.
          </p>

          {/* Pillars List */}
          <div className="mt-8 space-y-3.5">
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-400 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/80 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Presensi Presisi Real-Time WITA</h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Pemindaian kamera QR stasiun kegiatan dengan validasi kedatangan dan kepulangan instan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Evaluasi Formula 40 / 60</h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Integrasi skor sistem presensi (40 poin) dan 5 rubrik penilaian kinerja koordinator sie (60 poin).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-purple-400 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Sertifikat Digital SK Resmi</h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Penerbitan otomatis sertifikat kelayakan panitia dengan nomor registrasi terverifikasi.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Metadata Info */}
        <div className="pt-6 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">Forum Generasi Berencana Kab. Buleleng</span>
          <div className="flex items-center gap-1.5 text-teal-700 font-bold font-mono">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>Waktu: WITA (UTC+8)</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Crisp White Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-14 xl:p-16 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="text-center lg:text-left mb-6 sm:mb-8">
            <div className="inline-flex lg:hidden items-center justify-center w-16 h-16 rounded-2xl bg-white p-2 border border-slate-200/90 mb-4 shadow-sm">
              <GenreLogo size={52} priority />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-3 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Portal Resmi Panitia 2026</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Masuk ke Portal
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
              Gunakan email panitia dan kata sandi Anda yang terdaftar pada SK Panitia.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-9 border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            {/* Status Selesai Logout Notifikasi */}
            {isLoggedOut && !errorMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs sm:text-sm animate-fade-in shadow-xs">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                <div className="flex-1 leading-relaxed font-semibold">
                  Anda telah berhasil keluar dari akun. Sesi login telah berakhir.
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs sm:text-sm animate-fade-in shadow-xs">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 leading-relaxed font-medium">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleLogin} autoComplete="off" className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Alamat Email Panitia
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    name="login_email_panitia"
                    placeholder="nama.panitia@genrebuleleng.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-50/70 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/15 focus:border-teal-600 focus:bg-white transition-all text-xs sm:text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-bold transition-colors cursor-pointer"
                  >
                    Bantuan Akses?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    name="login_password_panitia"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3.5 rounded-xl bg-slate-50/70 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/15 focus:border-teal-600 focus:bg-white transition-all text-xs sm:text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-teal-500/20 transition-all shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Kredensial...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Portal Panitia</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <Shield className="w-3.5 h-3.5 text-teal-600" />
                <span>Akses terproteksi khusus Panitia SK Duta GenRe 2026</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center mt-6 text-xs text-slate-500 font-medium">
            <span>© 2026 Forum GenRe Kabupaten Buleleng • Hak Cipta Dilindungi</span>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl relative text-left">
            <button
              onClick={() => setIsHelpOpen(false)}
              className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Bantuan Akses Akun</h3>
                <p className="text-xs text-slate-500">Panduan Kredensial Panitia</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p>
                Seluruh akun panitia didaftarkan secara terpusat oleh <strong>Divisi Sekretariat BPH</strong> sesuai dengan lampiran SK Panitia Resmi.
              </p>
              <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2">
                <div className="flex items-start gap-2 text-teal-900 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-teal-600 mt-0.5" />
                  <span>Jika Anda belum menerima akun atau lupa kata sandi, silakan hubungi Koordinator Bidang Anda atau Tim Sekretariat BPH.</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Pembaruan sandi atau aktivasi ulang akan diverifikasi langsung oleh Admin BPH untuk menjaga keabsahan data presensi.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-white text-teal-600">
        <div className="w-8 h-8 border-2 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
