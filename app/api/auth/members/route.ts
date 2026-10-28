import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateMemberEvaluation } from '@/lib/evaluations';

// Helper verifikasi hak akses Admin
async function verifyAdmin() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Mode demo / fallback jika session auth client belum terpasang
    return { isAdmin: true, currentUserId: null, supabaseAdmin };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, system_role, account_status')
    .eq('id', user.id)
    .single();

  const isAdmin = Boolean(profile && profile.system_role === 'admin' && profile.account_status === 'active');
  return { isAdmin, currentUserId: user.id, supabaseAdmin };
}

// -----------------------------------------------------------------------------
// POST: Tambah Anggota Baru (Create)
// -----------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const { isAdmin, supabaseAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin yang dapat menambah anggota.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      member_code,
      full_name,
      email,
      password,
      phone_number,
      field_id,
      system_role = 'member',
      organization_position = 'Anggota',
      account_status = 'active',
    } = body;

    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedFullName = full_name?.trim();

    if (!trimmedEmail || !trimmedFullName) {
      return NextResponse.json({ error: 'Nama Lengkap dan Email wajib diisi.' }, { status: 400 });
    }

    // Validasi peran (harus salah satu dari 3 role resmi)
    const validRoles = ['admin', 'coordinator', 'member'];
    const finalRole = validRoles.includes(system_role) ? system_role : 'member';

    // Generate kode anggota otomatis jika tidak disediakan
    let finalCode = member_code?.trim().toUpperCase();
    if (!finalCode) {
      finalCode = `GENRE-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Pastikan kode anggota belum digunakan
    const { data: existingCode } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('member_code', finalCode)
      .maybeSingle();

    if (existingCode) {
      finalCode = `GENRE-${Math.floor(100 + Math.random() * 900)}`;
    }

    const defaultPassword = password?.trim() || 'GenRe2026!Buleleng';

    // 1. Buat akun di Supabase Auth
    let userId: string | null = null;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: trimmedEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: trimmedFullName,
        member_code: finalCode,
      },
    });

    if (authError) {
      // Jika email sudah terdaftar di auth, coba hubungkan ke id yang ada
      if (authError.message.includes('already registered') || authError.message.includes('duplicate')) {
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
        const found = userList?.users?.find(u => u.email?.toLowerCase() === trimmedEmail);
        if (found) {
          userId = found.id;
        } else {
          return NextResponse.json({ error: `Gagal membuat akun: ${authError.message}` }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: `Gagal membuat akun Auth: ${authError.message}` }, { status: 400 });
      }
    } else if (authUser?.user) {
      userId = authUser.user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Gagal memperoleh ID pengguna autentikasi.' }, { status: 500 });
    }

    // 2. Simpan profil ke tabel profiles
    const nowIso = new Date().toISOString();
    const todayDate = new Date().toISOString().split('T')[0];

    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        member_code: finalCode,
        full_name: trimmedFullName,
        email: trimmedEmail,
        phone_number: phone_number?.trim() || null,
        field_id: field_id || null,
        system_role: finalRole,
        organization_position: organization_position?.trim() || 'Anggota',
        account_status: account_status || 'active',
        joined_at: todayDate,
        updated_at: nowIso,
      }, { onConflict: 'id' })
      .select('*, field:fields!profiles_field_id_fkey(*)')
      .single();

    if (profileError) {
      console.error('Error saving profile:', profileError);
      return NextResponse.json({ error: `Gagal menyimpan profil anggota: ${profileError.message}` }, { status: 500 });
    }

    // Inisialisasi evaluasi awal panitia agar langsung tercatat dan sinkron di sistem
    try {
      await calculateMemberEvaluation(userId);
    } catch (calcErr) {
      console.warn('Gagal inisialisasi evaluasi awal panitia baru:', calcErr);
    }

    return NextResponse.json({
      success: true,
      message: `Anggota ${trimmedFullName} (${finalCode}) berhasil ditambahkan!`,
      member: newProfile,
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/members:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PUT: Perbarui Data Anggota (Update)
// -----------------------------------------------------------------------------
export async function PUT(request: Request) {
  try {
    const { isAdmin, supabaseAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin yang dapat mengubah data anggota.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      member_code,
      full_name,
      email,
      password,
      phone_number,
      field_id,
      system_role,
      organization_position,
      account_status,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID anggota wajib disertakan.' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (member_code !== undefined) updatePayload.member_code = member_code.trim().toUpperCase();
    if (full_name !== undefined) updatePayload.full_name = full_name.trim();
    if (email !== undefined) updatePayload.email = email.trim().toLowerCase();
    if (phone_number !== undefined) updatePayload.phone_number = phone_number ? phone_number.trim() : null;
    if (field_id !== undefined) updatePayload.field_id = field_id || null;
    if (organization_position !== undefined) updatePayload.organization_position = organization_position.trim();
    if (account_status !== undefined) updatePayload.account_status = account_status;

    if (system_role !== undefined) {
      const validRoles = ['admin', 'coordinator', 'member'];
      if (validRoles.includes(system_role)) {
        updatePayload.system_role = system_role;
      }
    }

    // 1. Update tabel profiles
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select('*, field:fields!profiles_field_id_fkey(*)')
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return NextResponse.json({ error: `Gagal memperbarui profil: ${profileError.message}` }, { status: 500 });
    }

    // 2. Sinkronkan perubahan ke Supabase Auth (email, password baru jika ada, metadata)
    const authUpdatePayload: Record<string, any> = {};
    if (email) authUpdatePayload.email = email.trim().toLowerCase();
    if (password && password.trim().length >= 6) authUpdatePayload.password = password.trim();

    const userMetadata: Record<string, any> = {};
    if (full_name) userMetadata.full_name = full_name.trim();
    if (member_code) userMetadata.member_code = member_code.trim();
    if (Object.keys(userMetadata).length > 0) {
      authUpdatePayload.user_metadata = userMetadata;
    }

    if (Object.keys(authUpdatePayload).length > 0) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(id, authUpdatePayload);
      } catch (authErr) {
        console.warn('Gagal sinkronisasi data ke Supabase Auth:', authErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Data panitia ${updatedProfile.full_name} berhasil diperbarui!`,
      member: updatedProfile,
    });
  } catch (err: any) {
    console.error('Error in PUT /api/auth/members:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: Hapus Anggota (Delete)
// -----------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const { isAdmin, currentUserId, supabaseAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin yang dapat menghapus anggota.' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID anggota wajib disertakan.' }, { status: 400 });
    }

    // Cegah admin menghapus dirinya sendiri
    if (currentUserId && currentUserId === id) {
      return NextResponse.json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' }, { status: 400 });
    }

    // Ambil data profil untuk konfirmasi nama
    const { data: profileToDelete } = await supabaseAdmin
      .from('profiles')
      .select('full_name, member_code')
      .eq('id', id)
      .maybeSingle();

    const memberName = profileToDelete?.full_name || 'Panitia';

    // 1. Bersihkan referensi foreign key secara aman
    // - Fields coordinator_id -> NULL
    await supabaseAdmin.from('fields').update({ coordinator_id: null }).eq('coordinator_id', id);

    // - Organization periods created_by -> NULL
    await supabaseAdmin.from('organization_periods').update({ created_by: null }).eq('created_by', id);

    // - Activities created_by -> NULL
    await supabaseAdmin.from('activities').update({ created_by: null }).eq('created_by', id);

    // - Attendances verified_by -> NULL
    await supabaseAdmin.from('attendances').update({ verified_by: null }).eq('verified_by', id);

    // - Certificates issued_by -> NULL
    await supabaseAdmin.from('certificates').update({ issued_by: null }).eq('issued_by', id);

    // - Hapus sertifikat dan evaluasi akhir milik anggota
    const { data: memberEvals } = await supabaseAdmin
      .from('final_evaluations')
      .select('id')
      .eq('member_id', id);

    if (memberEvals && memberEvals.length > 0) {
      const evalIds = memberEvals.map(e => e.id);
      await supabaseAdmin.from('certificates').delete().in('final_evaluation_id', evalIds);
      await supabaseAdmin.from('final_evaluations').delete().eq('member_id', id);
    }

    // - Hapus review kinerja
    await supabaseAdmin.from('performance_reviews').delete().eq('member_id', id);
    await supabaseAdmin.from('performance_reviews').update({ reviewer_id: null }).eq('reviewer_id', id);

    // - Hapus sanggahan klarifikasi
    await supabaseAdmin.from('clarification_requests').delete().eq('member_id', id);
    await supabaseAdmin.from('clarification_requests').update({ resolved_by: null }).eq('resolved_by', id);

    // - Hapus permohonan presensi manual
    await supabaseAdmin.from('manual_attendance_requests').delete().eq('requested_by', id);
    await supabaseAdmin.from('manual_attendance_requests').update({ reviewed_by: null }).eq('reviewed_by', id);

    // - Hapus presensi dan penugasan agenda
    const { data: memberAssigns } = await supabaseAdmin
      .from('activity_assignments')
      .select('id')
      .eq('member_id', id);

    if (memberAssigns && memberAssigns.length > 0) {
      const assignIds = memberAssigns.map(a => a.id);
      await supabaseAdmin.from('attendances').delete().in('activity_assignment_id', assignIds);
      await supabaseAdmin.from('activity_assignments').delete().eq('member_id', id);
    }
    await supabaseAdmin.from('activity_assignments').update({ assigned_by: null }).eq('assigned_by', id);

    // 2. Hapus baris dari tabel profiles
    const { error: deleteProfileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (deleteProfileErr) {
      console.error('Error deleting profile:', deleteProfileErr);
      return NextResponse.json({ error: `Gagal menghapus profil: ${deleteProfileErr.message}` }, { status: 500 });
    }

    // 3. Hapus akun dari auth.users
    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (authDeleteErr) {
      console.warn('Peringatan: Gagal menghapus pengguna dari Supabase Auth:', authDeleteErr);
    }

    return NextResponse.json({
      success: true,
      message: `Akun panitia ${memberName} berhasil dihapus dari sistem beserta seluruh relasi data terkait.`,
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/auth/members:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server internal' }, { status: 500 });
  }
}
