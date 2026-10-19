import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardLayoutClient } from '@/components/layout/DashboardLayoutClient';
import { SystemRole } from '@/lib/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Wajib login: Jika tidak ada sesi user yang valid, arahkan ke login
  if (!user) {
    redirect('/login');
  }

  let userRole: SystemRole = 'member';
  let userName = user.email ? user.email.split('@')[0] : 'Panitia GenRe';
  let userPosition = 'Panitia Pelaksana';

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, system_role, organization_position')
      .eq('id', user.id)
      .single();

    if (profile) {
      userRole = (profile.system_role as SystemRole) || 'member';
      userName = profile.full_name || userName;
      userPosition = profile.organization_position || userPosition;
    }
  } catch (e) {
    console.warn('Gagal memuat profil pengguna aktif di DashboardLayout:', e);
  }

  return (
    <DashboardLayoutClient
      userRole={userRole}
      userName={userName}
      userPosition={userPosition}
    >
      {children}
    </DashboardLayoutClient>
  );
}
