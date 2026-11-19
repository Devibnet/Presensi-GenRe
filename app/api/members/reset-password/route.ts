import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMemberInitialPassword } from '@/lib/credentials-master';

export async function POST(request: Request) {
  try {
    // -------------------------------------------------------------------------
    // 1. Verifikasi Sesi & Hak Akses Admin / Penanggung Jawab
    // -------------------------------------------------------------------------
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login untuk melakukan tindakan ini.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, system_role, organization_position, account_status')
      .eq('id', user.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      callerProfile.system_role !== 'admin' ||
      callerProfile.account_status !== 'active'
    ) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Fitur reset kata sandi hanya dapat dilakukan oleh Admin / Penanggung Jawab.' },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------------
    // 2. Ambil Parameter Permintaan (member_id)
    // -------------------------------------------------------------------------
    const body = await request.json();
    const { member_id } = body;

    if (!member_id || typeof member_id !== 'string') {
      return NextResponse.json(
        { error: 'ID anggota (member_id) wajib disertakan.' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Ambil Data Profil Anggota Target
    // -------------------------------------------------------------------------
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, member_code, full_name, email, phone_number, system_role, organization_position')
      .eq('id', member_id)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: 'Data anggota panitia target tidak ditemukan di database.' },
        { status: 404 }
      );
    }

    // -------------------------------------------------------------------------
    // 4. Resolusi Kata Sandi Awal Resmi (Master Mapping)
    // -------------------------------------------------------------------------
    const initialPassword = resolveMemberInitialPassword(
      targetProfile.email,
      targetProfile.member_code
    );

    if (!initialPassword || initialPassword.length < 6) {
      return NextResponse.json(
        { error: 'Gagal merumuskan kata sandi awal untuk akun panitia ini.' },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Eksekusi Reset Kata Sandi di Supabase Auth
    // -------------------------------------------------------------------------
    const { data: targetAuthData } = await supabaseAdmin.auth.admin.getUserById(targetProfile.id);
    const existingMeta = targetAuthData?.user?.user_metadata || {};

    const { error: resetAuthError } = await supabaseAdmin.auth.admin.updateUserById(targetProfile.id, {
      password: initialPassword,
      user_metadata: {
        ...existingMeta,
        initial_password: initialPassword,
        must_change_password: true,
        password_reset_at: new Date().toISOString(),
        password_reset_by: user.id,
      },
    });

    if (resetAuthError) {
      console.error('Gagal memperbarui sandi auth:', resetAuthError);
      return NextResponse.json(
        { error: `Gagal mereset kata sandi pada sistem autentikasi: ${resetAuthError.message}` },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // 6. Pencatatan Audit Log & Notifikasi Sistem
    // -------------------------------------------------------------------------
    const timestampWITA = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());

    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action_type: 'RESET_PASSWORD',
        entity_type: 'USER_CREDENTIALS',
        entity_id: targetProfile.id,
        reason: `Admin ${callerProfile.full_name} mereset kata sandi panitia ${targetProfile.full_name} (${targetProfile.member_code}) kembali ke sandi awal resmi.`,
      });
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log reset password:', auditErr);
    }

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: targetProfile.id,
        title: '🔑 Kata Sandi Direset ke Sandi Awal',
        message: `Kata sandi akun Anda telah direset kembali ke sandi awal resmi oleh Penanggung Jawab (${callerProfile.full_name}) pada ${timestampWITA} WITA. Demi keamanan akun, segera ganti kata sandi Anda setelah masuk.`,
        notification_type: 'general',
        is_read: false,
      });
    } catch (notifErr) {
      console.warn('Gagal mengirim notifikasi reset password ke anggota:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `Kata sandi untuk ${targetProfile.full_name} berhasil di-reset ke sandi awal!`,
      member: {
        id: targetProfile.id,
        full_name: targetProfile.full_name,
        member_code: targetProfile.member_code,
        email: targetProfile.email,
        phone_number: targetProfile.phone_number,
        initial_password: initialPassword,
        reset_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/members/reset-password:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan sistem internal saat memproses reset kata sandi.' },
      { status: 500 }
    );
  }
}
