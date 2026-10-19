import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Setiap orang wajib melakukan login diawal:
  // Jika sudah terotentikasi, arahkan langsung ke panel kerja /dashboard
  // Jika belum terotentikasi, wajib masuk melalui /login
  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
