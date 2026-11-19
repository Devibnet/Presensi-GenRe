import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sanitizeSupabaseUrl } from '@/lib/utils';

// In-Memory Rate Limiting untuk proteksi brute force kata sandi
// Key: userId atau IP, Value: { attempts: number, resetTime: number }
const rateLimitMap = new Map<string, { attempts: number; resetTime: number }>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Menit

function checkRateLimit(key: string): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  if (now > entry.resetTime) {
    rateLimitMap.delete(key);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  if (entry.attempts >= MAX_FAILED_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSec };
  }

  return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS - entry.attempts };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { attempts: 1, resetTime: now + LOCKOUT_DURATION_MS });
  } else {
    entry.attempts += 1;
  }
}

function clearRateLimit(key: string) {
  rateLimitMap.delete(key);
}

export async function POST(request: Request) {
  try {
    // -------------------------------------------------------------------------
    // 1. Verifikasi Autentikasi Pengguna Aktif
    // -------------------------------------------------------------------------
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Sesi login tidak valid atau telah berakhir. Silakan login kembali.' },
        { status: 401 }
      );
    }

    // Ambil IP untuk rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'localhost';
    const rateLimitKey = `pw_change:${user.id}:${clientIp}`;

    // -------------------------------------------------------------------------
    // 2. Proteksi Brute-Force Rate Limiting
    // -------------------------------------------------------------------------
    const rateLimitCheck = checkRateLimit(rateLimitKey);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan gagal. Akun dibatasi sementara demi keamanan. Coba lagi dalam ${Math.ceil(
            (rateLimitCheck.retryAfterSec || 60) / 60
          )} menit.`,
        },
        { status: 429 }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Parsing & Validasi Input
    // -------------------------------------------------------------------------
    const body = await request.json();
    const { current_password, new_password, confirm_password } = body;

    if (!current_password || typeof current_password !== 'string') {
      return NextResponse.json(
        { error: 'Kata sandi saat ini wajib diisi untuk verifikasi identitas Anda.' },
        { status: 400 }
      );
    }

    if (!new_password || typeof new_password !== 'string') {
      return NextResponse.json(
        { error: 'Kata sandi baru wajib diisi.' },
        { status: 400 }
      );
    }

    if (!confirm_password || typeof confirm_password !== 'string') {
      return NextResponse.json(
        { error: 'Konfirmasi kata sandi baru wajib diisi.' },
        { status: 400 }
      );
    }

    if (new_password !== confirm_password) {
      return NextResponse.json(
        { error: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.' },
        { status: 400 }
      );
    }

    if (new_password === current_password) {
      return NextResponse.json(
        { error: 'Kata sandi baru tidak boleh sama dengan kata sandi saat ini.' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 4. Standar Keamanan Super Ketat (Password Complexity Policy)
    // - Minimal 8 karakter, Maksimal 64 karakter
    // - Mengandung minimal 1 Huruf Besar (A-Z)
    // - Mengandung minimal 1 Huruf Kecil (a-z)
    // - Mengandung minimal 1 Angka (0-9)
    // - Mengandung minimal 1 Karakter Khusus / Simbol (!@#$%^&*...)
    // -------------------------------------------------------------------------
    if (new_password.length < 8) {
      return NextResponse.json(
        { error: 'Kata sandi baru minimal harus 8 karakter sesuai standar keamanan.' },
        { status: 400 }
      );
    }

    if (new_password.length > 64) {
      return NextResponse.json(
        { error: 'Kata sandi baru maksimal 64 karakter.' },
        { status: 400 }
      );
    }

    const hasUppercase = /[A-Z]/.test(new_password);
    const hasLowercase = /[a-z]/.test(new_password);
    const hasNumber = /[0-9]/.test(new_password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(new_password);

    if (!hasUppercase) {
      return NextResponse.json(
        { error: 'Kata sandi baru wajib mengandung minimal 1 huruf kapital (A-Z).' },
        { status: 400 }
      );
    }

    if (!hasLowercase) {
      return NextResponse.json(
        { error: 'Kata sandi baru wajib mengandung minimal 1 huruf kecil (a-z).' },
        { status: 400 }
      );
    }

    if (!hasNumber) {
      return NextResponse.json(
        { error: 'Kata sandi baru wajib mengandung minimal 1 angka (0-9).' },
        { status: 400 }
      );
    }

    if (!hasSymbol) {
      return NextResponse.json(
        { error: 'Kata sandi baru wajib mengandung minimal 1 simbol / karakter khusus (contoh: !@#$%&*).' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Verifikasi Otentikasi Kata Sandi Lama (Proof of Identity)
    // -------------------------------------------------------------------------
    const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const authVerifyClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: verifyError } = await authVerifyClient.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    });

    if (verifyError) {
      recordFailedAttempt(rateLimitKey);
      const remaining = Math.max(0, rateLimitCheck.remainingAttempts - 1);
      return NextResponse.json(
        {
          error: `Kata sandi saat ini salah. Sisa percobaan keamanan: ${remaining} kali sebelum akun dibatasi sementara.`,
        },
        { status: 401 }
      );
    }

    // Berhasil verifikasi: bersihkan rate limit counter
    clearRateLimit(rateLimitKey);

    // -------------------------------------------------------------------------
    // 6. Pembaruan Kata Sandi di Supabase Auth via Admin Client
    // -------------------------------------------------------------------------
    const supabaseAdmin = createAdminClient();
    const currentMeta = user.user_metadata || {};

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: new_password,
      user_metadata: {
        ...currentMeta,
        must_change_password: false,
        password_updated_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      console.error('Gagal memperbarui kata sandi di Supabase Auth:', updateError);
      return NextResponse.json(
        { error: `Gagal memperbarui kata sandi: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Update juga sesi user saat ini jika memungkinkan
    try {
      await supabase.auth.updateUser({ password: new_password });
    } catch {
      // Abaikan jika token refresh ditangani oleh middleware
    }

    // -------------------------------------------------------------------------
    // 7. Audit Log Keamanan & Notifikasi Sistem
    // -------------------------------------------------------------------------
    const timestampWITA = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());

    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action_type: 'UPDATE',
        entity_type: 'USER_PASSWORD',
        entity_id: user.id,
        reason: 'Pengguna berhasil mengganti kata sandi mandiri dengan standar keamanan ketat.',
        ip_address: clientIp,
      });
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log perubahan password:', auditErr);
    }

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        title: '🔒 Keamanan: Kata Sandi Berhasil Diperbarui',
        message: `Kata sandi akun Anda berhasil diperbarui pada ${timestampWITA} WITA. Simpan dan ingat kata sandi baru Anda dengan aman.`,
        notification_type: 'general',
        is_read: false,
      });
    } catch (notifErr) {
      console.warn('Gagal mencatat notifikasi perubahan password:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Kata sandi Anda berhasil diperbarui dengan standar keamanan super ketat!',
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/change-password:', err);
    return NextResponse.json(
      { error: err?.message || 'Terjadi kesalahan sistem saat memperbarui kata sandi.' },
      { status: 500 }
    );
  }
}
