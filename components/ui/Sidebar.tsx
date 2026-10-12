'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  QrCode, 
  CheckSquare, 
  Star, 
  Award, 
  HelpCircle, 
  BarChart3, 
  Sparkles,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';
import { SystemRole } from '@/lib/types';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/utils';

interface SidebarProps {
  userRole?: SystemRole;
  userName?: string;
  userPosition?: string;
}

export function Sidebar({ userRole = 'member', userName = 'Panitia GenRe', userPosition = 'Anggota' }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Ikhtisar',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Panitia & Divisi',
      href: '/dashboard/members',
      icon: Users,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Agenda Kegiatan',
      href: '/dashboard/activities',
      icon: Calendar,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Presensi Mandiri',
      href: '/dashboard/attendance',
      icon: QrCode,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Verifikasi Presensi',
      href: '/dashboard/attendance/manage',
      icon: CheckSquare,
      roles: ['admin', 'coordinator'],
    },
    {
      label: 'Tugas Operasional',
      href: '/dashboard/tasks',
      icon: ClipboardList,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Evaluasi Kinerja',
      href: '/dashboard/evaluations',
      icon: Star,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Sanggahan & Klarifikasi',
      href: '/dashboard/clarifications',
      icon: HelpCircle,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Sertifikat Kelulusan',
      href: '/dashboard/certificates',
      icon: Award,
      roles: ['admin', 'coordinator', 'member'],
    },
    {
      label: 'Laporan & Statistik',
      href: '/dashboard/reports',
      icon: BarChart3,
      roles: ['admin', 'coordinator'],
    },
  ];

  // Filter based on role
  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-navy-950/80 backdrop-blur-xl flex flex-col justify-between h-screen sticky top-0 z-40 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-20 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-genre-600 to-teal-400 flex items-center justify-center shadow-lg shadow-genre-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight block">GenRe Attendance</span>
            <span className="text-[10px] tracking-wider text-genre-400 font-semibold uppercase block">Kab. Buleleng 2026</span>
          </div>
        </div>

        {/* User Card Pill */}
        <div className="p-4 mx-3 my-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-genre-300">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-white block truncate">{userName}</span>
              <span className="text-[11px] text-slate-400 block truncate">{userPosition}</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${getRoleBadgeClass(userRole)}`}>
              {getRoleLabel(userRole)}
            </span>
            <span className="text-slate-500 font-mono">WITA (UTC+8)</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="px-3 py-2 space-y-1">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-genre-600 to-teal-600 text-white shadow-lg shadow-genre-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-genre-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>RLS Active</span>
        </div>
        <span>v1.0 (Buleleng)</span>
      </div>
    </aside>
  );
}
