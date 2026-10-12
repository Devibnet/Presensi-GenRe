import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/ui/Sidebar';
import { Navbar } from '@/components/ui/Navbar';
import { SystemRole } from '@/lib/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  let userRole: SystemRole = 'admin';
  let userName = 'Putu Gede Adnyana';
  let userPosition = 'Ketua Panitia (Demo)';

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, system_role, organization_position')
        .eq('id', user.id)
        .single();

      if (profile) {
        userRole = profile.system_role as SystemRole;
        userName = profile.full_name;
        userPosition = profile.organization_position;
      } else {
        userName = user.email || 'Pengguna';
      }
    }
  } catch (e) {
    // Mode demo / fallback jika database belum terhubung
  }

  return (
    <div className="min-h-screen flex bg-navy-950 text-slate-100">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar userRole={userRole} userName={userName} userPosition={userPosition} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="GenRe Attendance Panel" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
