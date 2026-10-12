import Link from 'next/link';
import { 
  CheckCircle2, 
  QrCode, 
  Award, 
  Users, 
  Calendar, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function HomePage() {
  const isSetupMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('sample-genre-buleleng');

  return (
    <main className="min-h-screen flex flex-col justify-between relative overflow-hidden bg-radial-gradient">
      {/* Background ambient decorative glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-genre-500/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-purple-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Header Bar */}
      <header className="w-full border-b border-slate-800/80 bg-navy-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-genre-600 to-teal-400 flex items-center justify-center shadow-lg shadow-genre-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block">GenRe Attendance</span>
              <span className="text-[10px] tracking-wider text-genre-400 font-medium uppercase block">Kabupaten Buleleng</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-all border border-slate-700/60"
            >
              Masuk Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 flex flex-col items-center text-center justify-center z-10">
        {isSetupMode && (
          <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Mode Konfigurasi: Hubungkan dengan kredensial Supabase Anda di <code className="text-amber-200 font-mono">.env.local</code>
          </div>
        )}

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-genre-500/10 text-genre-300 border border-genre-500/30 mb-8 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-genre-400" />
          Sistem Administrasi Kepanitiaan Pemilihan Duta GenRe Buleleng 2026
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-tight">
          Presensi Cerdas, Monitoring Penugasan &{' '}
          <span className="bg-gradient-to-r from-genre-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Evaluasi Transparan
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Platform terpadu untuk 70 panitia, koordinator bidang, dan BPH Pemilihan Duta GenRe Kabupaten Buleleng. Dilengkapi QR Code dinamis, scoring formula berjenjang, dan validasi sertifikat resmi.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-genre-600 to-teal-500 hover:from-genre-500 hover:to-teal-400 transition-all shadow-xl shadow-genre-500/25 flex items-center justify-center gap-2 group"
          >
            <span>Masuk ke Dashboard</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 transition-all border border-slate-700/80 flex items-center justify-center"
          >
            Buka Panel Panitia
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full text-left">
          <div className="glass-card p-6 rounded-2xl hover:border-genre-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-genre-500/10 border border-genre-500/20 flex items-center justify-center mb-4 text-genre-400">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-lg">QR Code Dinamis</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Check-in dan check-out dengan token HMAC berbatas waktu. Mendukung permohonan presensi manual jika terkendala kamera.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl hover:border-genre-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-lg">Penugasan Agenda</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Surat tugas otomatis untuk Rapat Pleno, Workshop Finalis, Gladi Bersih, hingga Malam Grand Final.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl hover:border-genre-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-lg">Evaluasi 60 + 40</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Kombinasi penilaian koordinator (60 poin) dan catatan sistem (40 poin: kehadiran, ketepatan waktu, dan tugas).
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl hover:border-genre-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-lg">Sertifikat Kelulusan</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Verifikasi kelayakan berdasar ambang kelulusan 75 poin dan penerbitan nomor registrasi resmi panitia.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 bg-navy-950/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Forum Generasi Berencana Kabupaten Buleleng. Hak Cipta Dilindungi.</p>
          <div className="flex items-center gap-6 text-slate-400">
            <span>Zona Waktu: Asia/Makassar (WITA)</span>
            <span>Next.js 15 App Router</span>
            <span>Supabase PostgreSQL</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
