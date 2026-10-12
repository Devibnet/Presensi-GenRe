import { createBrowserClient } from '@supabase/ssr';
import { sanitizeSupabaseUrl } from '@/lib/utils';

export function createClient() {
  const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_anon_key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
