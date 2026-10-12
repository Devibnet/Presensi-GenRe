import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GenRe Attendance — Pemilihan Duta GenRe Kabupaten Buleleng',
  description: 'Portal presensi digital, penugasan panitia, evaluasi kinerja koordinator, dan registrasi sertifikat Duta GenRe Kabupaten Buleleng.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-navy-950 text-slate-100 antialiased selection:bg-genre-500/30 selection:text-genre-200">
        {children}
      </body>
    </html>
  );
}
