import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMemberInitialPassword } from '@/lib/credentials-master';

export async function POST(request: Request) {
  try {
    // -------------------------------------------------------------------------
    // 1. Verifikasi Session & Autentikasi Pengguna
    // -------------------------------------------------------------------------
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda harus login untuk melakukan tindakan ini.' },
        { status: 401 }
      );
    }

    // -------------------------------------------------------------------------
    // 2. Verifikasi Hak Akses Khusus Penanggung Jawab Kepanitiaan
    // -------------------------------------------------------------------------
    const supabaseAdmin = createAdminClient();
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, system_role, organization_position, account_status')
      .eq('id', user.id)
      .single();

    const isPenanggungJawab =
      adminProfile &&
      adminProfile.system_role === 'admin' &&
      adminProfile.account_status === 'active' &&
      adminProfile.organization_position?.toLowerCase().includes('penanggung jawab');

    if (profileError || !isPenanggungJawab) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Fitur ekspor kredensial akun hanya dapat diakses oleh Penanggung Jawab kepanitiaan.' },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Security Gate: Verifikasi Kode Otorisasi Keamanan (110205)
    // -------------------------------------------------------------------------
    const body = await request.json();
    const { security_code, admin_password, field_id, role_filter } = body;

    const inputCode = (security_code || admin_password || '').toString().trim();

    if (!inputCode) {
      return NextResponse.json(
        { error: 'Kode Keamanan Wajib Diisi: Masukkan kode otorisasi keamanan untuk mengonfirmasi ekspor kredensial.' },
        { status: 400 }
      );
    }

    const REQUIRED_SECURITY_CODE = '110205';

    if (inputCode !== REQUIRED_SECURITY_CODE) {
      return NextResponse.json(
        { error: 'Kode Otorisasi Salah: Kode keamanan yang Anda masukkan tidak valid. Akses unduh kredensial ditolak.' },
        { status: 401 }
      );
    }

    // -------------------------------------------------------------------------
    // 4. Pengambilan Data Anggota & Divisi
    // -------------------------------------------------------------------------
    let query = supabaseAdmin
      .from('profiles')
      .select(`
        id,
        member_code,
        full_name,
        email,
        phone_number,
        field_id,
        system_role,
        organization_position,
        account_status,
        created_at,
        fields:field_id (
          id,
          field_name,
          field_code
        )
      `)
      .order('member_code', { ascending: true });

    if (field_id && field_id !== 'all') {
      query = query.eq('field_id', field_id);
    }
    if (role_filter && role_filter !== 'all') {
      query = query.eq('system_role', role_filter);
    }

    const { data: members, error: membersError } = await query;
    if (membersError) {
      return NextResponse.json(
        { error: `Gagal memuat data panitia: ${membersError.message}` },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Sinkronisasi Data Metadata Akun Supabase Auth (Status Password)
    // -------------------------------------------------------------------------
    const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    const authUsersMap = new Map(
      (authUsersData?.users || []).map((u) => [u.id, u])
    );

    const enrichedMembers = (members || []).map((m) => {
      const authUser = authUsersMap.get(m.id);
      const userMeta = authUser?.user_metadata || {};

      const initialPasswordSaved = userMeta.initial_password;
      const mustChangePassword = userMeta.must_change_password;

      let passwordDisplay = '';
      let passwordStatus = 'initial';

      if (mustChangePassword === false) {
        passwordDisplay = '[Telah Diubah Mandiri oleh Panitia]';
        passwordStatus = 'customized';
      } else {
        passwordDisplay = resolveMemberInitialPassword(
          m.email,
          m.member_code,
          initialPasswordSaved
        );
        passwordStatus = 'initial';
      }

      const fieldObj = Array.isArray(m.fields) ? m.fields[0] : m.fields;

      return {
        id: m.id,
        member_code: m.member_code,
        full_name: m.full_name,
        email: m.email,
        phone_number: m.phone_number || '-',
        field_id: m.field_id,
        field_name: fieldObj?.field_name || 'Umum / BPH',
        field_code: fieldObj?.field_code || '-',
        system_role: m.system_role,
        organization_position: m.organization_position || 'Anggota',
        account_status: m.account_status,
        password: passwordDisplay,
        password_status: passwordStatus,
      };
    });

    // -------------------------------------------------------------------------
    // 6. Pencatatan Audit Log & Notifikasi Internal
    // -------------------------------------------------------------------------
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        action_type: 'EXPORT',
        entity_type: 'MEMBER_CREDENTIALS',
        entity_id: user.id,
        reason: `Ekspor data kredensial ${enrichedMembers.length} panitia (Nama, Email, Password) dengan verifikasi password admin.`,
      });
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log:', auditErr);
    }

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        title: '🔒 Audit: Ekspor Kredensial Panitia',
        message: `Anda baru saja mengekspor ${enrichedMembers.length} data kredensial panitia resmi. Pastikan dokumen dijaga kerahasiaannya.`,
        notification_type: 'general',
        is_read: false,
      });
    } catch (notifErr) {
      console.warn('Gagal mencatat notifikasi:', notifErr);
    }

    return NextResponse.json({
      success: true,
      exported_at: new Date().toISOString(),
      exported_by: {
        name: adminProfile.full_name,
        email: adminProfile.email,
      },
      total: enrichedMembers.length,
      members: enrichedMembers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan server saat memproses ekspor data kredensial.' },
      { status: 500 }
    );
  }
}
