'use client';

import React, { useState } from 'react';
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
  ClipboardList,
  UploadCloud,
  X,
  LogOut
} from 'lucide-react';
import { GenreLogo } from '@/components/ui/GenreLogo';
import { LogoutModal } from '@/components/ui/LogoutModal';
import { SystemRole } from '@/lib/types';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/utils';

interface SidebarProps {
  userRole?: SystemRole;
  userName?: string;
  userPosition?: string;
  onCloseMobile?: () => void;
}

export function Sidebar({
  userRole = 'member',
  userName = 'Panitia GenRe',
  userPosition = 'Anggota',
  onCloseMobile
}: SidebarProps) {
  const pathname = usePathname();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const navSections = [
    {
      title: 'MENU UTAMA',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'coordinator', 'member'] },
        { label: 'Panitia & Divisi', href: '/dashboard/members', icon: Users, roles: ['admin', 'coordinator', 'member'] },
        { label: 'Impor Akun Panitia', href: '/dashboard/members/import', icon: UploadCloud, roles: ['admin'] },
        { label: 'Agenda Kegiatan', href: '/dashboard/activities', icon: Calendar, roles: ['admin', 'coordinator', 'member'] },
      ]
    },
    {
      title: 'KONTROL PRESENSI',
      items: [
        { label: 'Presensi Mandiri', href: '/dashboard/attendance', icon: QrCode, roles: ['admin', 'coordinator', 'member'] },
        { label: 'Verifikasi Presensi', href: '/dashboard/attendance/manage', icon: CheckSquare, roles: ['admin', 'coordinator'] },
      ]
    },
    {
      title: 'PENILAIAN & LAPORAN',
      items: [
        { label: 'Penilaian Panitia (Evaluasi)', href: '/dashboard/evaluations', icon: Star, roles: ['admin', 'coordinator', 'member'] },
        { label: 'Sanggahan & Klarifikasi', href: '/dashboard/clarifications', icon: HelpCircle, roles: ['admin', 'coordinator', 'member'] },
        { label: 'Sertifikat Kelulusan', href: '/dashboard/certificates', icon: Award, roles: ['admin', 'coordinator', 'member'] },
        { label: 'Laporan & Statistik', href: '/dashboard/reports', icon: BarChart3, roles: ['admin', 'coordinator'] },
      ]
    }
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between h-screen sticky top-0 z-40 select-none shadow-[2px_0_12px_-4px_rgba(15,23,42,0.04)]">
      <div className="overflow-y-auto">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-200/90 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <GenreLogo size={36} priority />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-sm tracking-tight block">GenRe Attendance</span>
              <span className="text-[10px] tracking-wider text-teal-600 font-bold uppercase block">Kab. Buleleng 2026</span>
            </div>
          </Link>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User Card Pill */}
        <div className="p-3 mx-3.5 my-3 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 font-bold text-white text-xs flex items-center justify-center shadow-xs">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="overflow-hidden min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">{userName}</span>
              <span className="text-[11px] text-slate-500 block truncate">{userPosition}</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[10px]">
            <span className={`px-2 py-0.5 rounded-full font-bold tracking-wide ${getRoleBadgeClass(userRole)}`}>
              {getRoleLabel(userRole)}
            </span>
            <span className="text-slate-400 font-mono text-[9px]">WITA (UTC+8)</span>
          </div>
        </div>

        {/* Navigation List grouped by Section */}
        <nav className="px-3 py-1 space-y-4">
          {navSections.map((sec, secIdx) => {
            const visibleSectionItems = sec.items.filter(item => item.roles.includes(userRole));
            if (visibleSectionItems.length === 0) return null;

            return (
              <div key={sec.title} className="space-y-1">
                <span className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1">
                  {sec.title}
                </span>
                {visibleSectionItems.map(item => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group ${isActive
                          ? 'bg-teal-50/90 text-teal-800 font-bold border-l-4 border-teal-600 rounded-l-xs shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                        }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <button
          type="button"
          onClick={() => setIsLogoutModalOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer group active:scale-95"
        >
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-rose-500 group-hover:-translate-x-0.5 transition-transform" />
            <span>Keluar Akun</span>
          </div>
          <span className="text-[10px] font-semibold text-rose-400 group-hover:text-rose-600">Sesi</span>
        </button>

        <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-teal-700 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Sistem Resmi GenRe</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">v1.0 (2026)</span>
        </div>
      </div>

      {/* Confirmation Modal Logout */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userName={userName}
      />
    </aside>
  );
}
