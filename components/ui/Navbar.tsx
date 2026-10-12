'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, Bell, Clock, Menu } from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
  title?: string;
}

export function Navbar({ onToggleMobileMenu, title = 'Panel Administrasi' }: NavbarProps) {
  const router = useRouter();
  const [timeWITA, setTimeWITA] = useState<string>('');
  const supabase = createClient();

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Makassar',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now);
        setTimeWITA(formatted + ' WITA');
      } catch {
        setTimeWITA('');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-20 border-b border-slate-800/80 bg-navy-950/60 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real-time WITA Clock */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono text-genre-300">
          <Clock className="w-3.5 h-3.5 text-genre-400" />
          <span>{timeWITA || 'WITA Clock'}</span>
        </div>

        {/* Notifications Icon */}
        <button
          title="Notifikasi"
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-genre-400 absolute top-2 right-2 ring-2 ring-navy-950" />
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          title="Keluar Akun"
          className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors text-xs font-semibold flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
