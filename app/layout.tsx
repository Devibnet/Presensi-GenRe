import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GenRe Attendance — Pemilihan Duta GenRe Kabupaten Buleleng',
  description: 'Portal presensi digital, penugasan panitia, evaluasi kinerja koordinator, dan registrasi sertifikat Duta GenRe Kabupaten Buleleng.',
  icons: {
    icon: '/logo-genre.png',
    shortcut: '/logo-genre.png',
    apple: '/logo-genre.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-teal-500/20 selection:text-teal-900"
      >
        {children}
      </body>
    </html>
  );
}
