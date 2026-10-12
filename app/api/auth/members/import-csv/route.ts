import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface CsvMemberRow {
  member_code: string;
  full_name: string;
  email: string;
  password?: string;
  phone_number?: string;
  field_code?: string;
  system_role?: 'admin' | 'coordinator' | 'member';
  organization_position?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Verifikasi Otorisasi Pengguna (Wajib Admin)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    // Ambil profil pemanggil untuk cek role
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('system_role, account_status')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.system_role !== 'admin' || callerProfile.account_status !== 'active') {
      return NextResponse.json({ error: 'Hanya Admin yang berwenang mengimpor akun panitia' }, { status: 403 });
    }

    // 2. Parse Body JSON dari CSV yang diproses client
    const { members, periodId } = (await request.json()) as { members: CsvMemberRow[]; periodId?: string };

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'Daftar panitia tidak valid atau kosong' }, { status: 400 });
    }

    // 3. Inisialisasi Admin Client (Service Role - Backend Tepercaya)
    const supabaseAdmin = createAdminClient();

    // Ambil daftar fields untuk pemetaan field_code -> field_id
    const { data: fieldsData } = await supabaseAdmin
      .from('fields')
      .select('id, field_code');

    const fieldMap = new Map<string, string>();
    if (fieldsData) {
      for (const f of fieldsData) {
        fieldMap.set(f.field_code.toUpperCase(), f.id);
      }
    }

    const results = {
      total: members.length,
      successCount: 0,
      failedCount: 0,
      errors: [] as { email: string; reason: string }[],
      created: [] as { email: string; full_name: string; member_code: string }[],
    };

    for (const m of members) {
      const email = m.email?.trim().toLowerCase();
      const rawPassword = m.password?.trim() || 'GenRe2026!Buleleng';
      const fullName = m.full_name?.trim();
      const memberCode = m.member_code?.trim() || `GENRE-${Math.floor(100 + Math.random() * 900)}`;
      const systemRole = (['admin', 'coordinator', 'member'].includes(m.system_role || '') ? m.system_role : 'member') as 'admin' | 'coordinator' | 'member';
      const position = m.organization_position?.trim() || 'Anggota Panitia';
      const fieldId = m.field_code ? fieldMap.get(m.field_code.trim().toUpperCase()) || null : null;

      if (!email || !fullName) {
        results.failedCount++;
        results.errors.push({ email: email || 'unknown', reason: 'Email atau Nama Lengkap kosong' });
        continue;
      }

      try {
        // Buat akun di Supabase Auth via Admin Client
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: rawPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            member_code: memberCode,
          },
        });

        let userId = authData?.user?.id;

        if (authError) {
          // Jika email sudah terdaftar di auth.users, cari ID pengguna yang ada
          if (authError.message.includes('already registered') || authError.message.includes('duplicate')) {
            const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
            const matched = existingUser?.users?.find(u => u.email?.toLowerCase() === email);
            if (matched) {
              userId = matched.id;
            } else {
              results.failedCount++;
              results.errors.push({ email, reason: authError.message });
              continue;
            }
          } else {
            results.failedCount++;
            results.errors.push({ email, reason: authError.message });
            continue;
          }
        }

        if (!userId) {
          results.failedCount++;
          results.errors.push({ email, reason: 'Gagal membuat identitas pengguna' });
          continue;
        }

        // Upsert ke tabel profiles
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            member_code: memberCode,
            full_name: fullName,
            email: email,
            phone_number: m.phone_number || null,
            field_id: fieldId,
            system_role: systemRole,
            organization_position: position,
            account_status: 'active',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (profileError) {
          results.failedCount++;
          results.errors.push({ email, reason: `Profil gagal disimpan: ${profileError.message}` });
        } else {
          results.successCount++;
          results.created.push({ email, full_name: fullName, member_code: memberCode });
        }
      } catch (err: any) {
        results.failedCount++;
        results.errors.push({ email, reason: err.message || 'Kesalahan internal' });
      }
    }

    return NextResponse.json({
      message: `Impor selesai: ${results.successCount} berhasil, ${results.failedCount} gagal`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Kesalahan server' }, { status: 500 });
  }
}
