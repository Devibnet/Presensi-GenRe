'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/ui/Sidebar';
import { Navbar } from '@/components/ui/Navbar';
import { ToastProvider } from '@/components/ui/Toast';
import { SystemRole } from '@/lib/types';
import { 
  LayoutDashboard, 
  Calendar, 
  QrCode, 
  ClipboardList, 
  Menu, 
  Star,
  Users
} from 'lucide-react';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  userRole: SystemRole;
  userName: string;
  userPosition: string;
}

export function DashboardLayoutClient({
  children,
  userRole,
  userName,
  userPosition,
}: DashboardLayoutClientProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const pathname = usePathname();

  return (
    <ToastProvider>
      <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Desktop Sidebar (Fixed left on >= lg screens) */}
      <div className="hidden lg:block shrink-0 print:hidden">
        <Sidebar userRole={userRole} userName={userName} userPosition={userPosition} />
      </div>

      {/* Mobile Sidebar Drawer (< lg screens) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setIsMobileDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
          />

          {/* Drawer content */}
          <div className="relative z-50 w-72 max-w-[85vw] h-full shadow-2xl animate-slide-right">
            <Sidebar 
              userRole={userRole} 
              userName={userName} 
              userPosition={userPosition} 
              onCloseMobile={() => setIsMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 print:p-0 print:m-0">
        <Navbar 
          title="GenRe Attendance Panel" 
          userName={userName}
          onToggleMobileMenu={() => setIsMobileDrawerOpen(true)}
        />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Quick-Access Bar (< lg screens) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-lg shadow-slate-900/5 print:hidden">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
            pathname === '/dashboard' ? 'text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Ikhtisar</span>
        </Link>

        <Link
          href="/dashboard/activities"
          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
            pathname.startsWith('/dashboard/activities') ? 'text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span>Agenda</span>
        </Link>

        {/* Center Floating Quick-Scan Button */}
        <Link
          href="/dashboard/attendance"
          className="flex flex-col items-center -mt-5"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 border-2 border-white transition-transform active:scale-95">
            <QrCode className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-bold mt-0.5 ${
            pathname === '/dashboard/attendance' ? 'text-teal-700' : 'text-slate-600'
          }`}>
            Presensi
          </span>
        </Link>

        <Link
          href="/dashboard/evaluations"
          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
            pathname.startsWith('/dashboard/evaluations') ? 'text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Star className="w-5 h-5" />
          <span>Penilaian</span>
        </Link>

        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl text-[10px] font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span>Menu</span>
        </button>
      </nav>
      </div>
    </ToastProvider>
  );
}
