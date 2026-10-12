import { createClient } from '@supabase/supabase-js';

// WARNING: Client ini hanya boleh diakses di backend (API Routes / Server Actions).
// JANGAN PERNAH mengekspos SUPABASE_SERVICE_ROLE_KEY ke browser!
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceRoleKey || serviceRoleKey.includes('dummy')) {
    console.warn('Peringatan: SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi dengan kredensial riil.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
