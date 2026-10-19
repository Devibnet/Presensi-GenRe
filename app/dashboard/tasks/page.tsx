'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TasksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/activities');
  }, [router]);

  return (
    <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
      <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      <span>Mengalihkan ke Agenda Kegiatan & Penugasan Panitia...</span>
    </div>
  );
}
