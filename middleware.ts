import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeSupabaseUrl, isValidHttpUrl } from '@/lib/utils';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Jika URL tidak valid atau masih placeholder, izinkan navigasi
  if (!isValidHttpUrl(supabaseUrl) || !supabaseAnonKey) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Ambil user saat ini
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isLoginPage = pathname === '/login';
    const isAuthRoute = pathname.startsWith('/auth') || pathname.startsWith('/api/auth') || pathname === '/api/evaluations/save';

    // 1. Setiap pengguna WAJIB login diawal.
    // Jika belum login dan mencoba mengakses rute selain /login atau endpoint autentikasi:
    if (!user && !isLoginPage && !isAuthRoute) {
      // Jika request API selain auth, kembalikan response 401 Unauthorized
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Harap melakukan login terlebih dahulu untuk mengakses sistem.' },
          { status: 401 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = '/login';
      // Simpan tujuan redirect jika bukan ke root '/'
      if (pathname !== '/') {
        const fullTarget = pathname + (request.nextUrl.search || '');
        url.searchParams.set('redirectTo', fullTarget);
      }
      return NextResponse.redirect(url);
    }

    // 2. Jika sudah terotentikasi dan mencoba mengakses /login atau root '/', arahkan ke /dashboard
    if (user && (isLoginPage || pathname === '/')) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  } catch (e) {
    console.error('Middleware Supabase auth check error:', e);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
