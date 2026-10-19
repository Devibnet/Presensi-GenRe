import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateMemberEvaluation } from '@/lib/evaluations';

export interface CsvMemberInput {
  member_code: string;
  full_name: string;
  email: string;
  password?: string;
  phone_number?: string;
  field_code?: string;
  system_role?: string;
  organization_position?: string;
}

interface ImportItemResult {
  member_code: string;
  full_name: string;
  email: string;
  field_code?: string;
  field_name?: string;
  organization_position?: string;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Verifikasi Otorisasi Pengguna (Wajib Admin Aktif yang Terautentikasi)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan. Silakan masuk sebagai Admin terlebih dahulu.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, system_role, account_status')
      .eq('id', user.id)
      .maybeSingle();

    if (
      callerProfileError ||
      !callerProfile ||
      callerProfile.system_role !== 'admin' ||
      callerProfile.account_status !== 'active'
    ) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Admin aktif yang berwenang melakukan impor dan pembuatan akun panitia.' },
        { status: 403 }
      );
    }

    // 2. Parse Body Request
    const body = await request.json();
    const { members, periodId, dryRun = false } = body as {
      members: CsvMemberInput[];
      periodId?: string;
      dryRun?: boolean;
    };

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: 'Daftar data panitia kosong atau format tidak sesuai.' },
        { status: 400 }
      );
    }

    // 3. Ambil Periode Aktif
    let activePeriodId = periodId;
    if (!activePeriodId) {
      const { data: pData } = await supabaseAdmin
        .from('organization_periods')
        .select('id')
        .eq('period_status', 'active')
        .limit(1)
        .maybeSingle();
      activePeriodId = pData?.id || '00000000-0000-0000-0000-000000000001';
    }

    // 4. Ambil Daftar Bidang/Divisi untuk Pemetaan field_code
    const { data: fieldsData } = await supabaseAdmin
      .from('fields')
      .select('id, field_code, field_name')
      .eq('period_id', activePeriodId);

    const fieldMapByCode = new Map<string, { id: string; name: string }>();
    const fieldMapByName = new Map<string, { id: string; name: string }>();

    if (fieldsData) {
      for (const f of fieldsData) {
        if (f.field_code) {
          fieldMapByCode.set(f.field_code.toUpperCase().trim(), { id: f.id, name: f.field_name });
        }
        if (f.field_name) {
          fieldMapByName.set(f.field_name.toUpperCase().trim(), { id: f.id, name: f.field_name });
        }
      }
    }

    // Helper resolusi divisi dengan fallback alias
    const resolveField = (rawCode?: string, rawPos?: string) => {
      const code = (rawCode || '').toUpperCase().trim();
      if (code && fieldMapByCode.has(code)) {
        return fieldMapByCode.get(code)!;
      }

      // Cek berdasarkan nama jabatan jika divisi tidak ditemukan
      const pos = (rawPos || '').toLowerCase();
      if (pos.includes('penanggung jawab')) return fieldMapByCode.get('PNJ') || null;
      if (pos.includes('ketua') || pos.includes('wakil ketua')) return fieldMapByCode.get('KPT') || null;
      if (pos.includes('bendahara')) return fieldMapByCode.get('BEN') || null;
      if (pos.includes('acara')) return fieldMapByCode.get('ACR') || null;
      if (pos.includes('humas') || pos.includes('kesekretariatan dan humas')) return fieldMapByCode.get('HMS') || null;
      if (pos.includes('sekretaris panitia')) return fieldMapByCode.get('SEK') || null;
      if (pos.includes('publikasi') || pos.includes('dokumentasi')) return fieldMapByCode.get('PUB') || null;
      if (pos.includes('perlengkapan') || pos.includes('keamanan') || pos.includes('logistik')) return fieldMapByCode.get('PER') || null;
      if (pos.includes('konsumsi') || pos.includes('rohani')) return fieldMapByCode.get('KON') || null;
      if (pos.includes('dana') || pos.includes('penggalian dana')) return fieldMapByCode.get('DAN') || null;
      if (pos.includes('ilmiah') || pos.includes('lomba')) return fieldMapByCode.get('ILM') || null;
      if (pos.includes('official') || pos.includes('duta')) return fieldMapByCode.get('OFF') || null;

      return null;
    };

    // 5. Ambil data eksisting untuk pemeriksaan idempoten & pencegahan duplikasi
    const { data: existingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, member_code, email');

    const existingEmailMap = new Map<string, string>(); // email -> profile id
    const existingCodeMap = new Map<string, string>(); // member_code -> profile id

    if (existingProfiles) {
      for (const p of existingProfiles) {
        if (p.email) existingEmailMap.set(p.email.toLowerCase().trim(), p.id);
        if (p.member_code) existingCodeMap.set(p.member_code.toUpperCase().trim(), p.id);
      }
    }

    // Ambil user auth eksisting untuk memastikan tidak ada user gantung
    const { data: existingAuthData } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthEmails = new Set<string>();
    if (existingAuthData?.users) {
      for (const u of existingAuthData.users) {
        if (u.email) existingAuthEmails.add(u.email.toLowerCase().trim());
      }
    }

    // 6. Siapkan Wadah Hasil
    const results = {
      total: members.length,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      created: [] as ImportItemResult[],
      skipped: [] as ImportItemResult[],
      failed: [] as ImportItemResult[],
    };

    // Set untuk mendeteksi duplikat intra-batch dalam berkas CSV itu sendiri
    const batchSeenEmails = new Set<string>();
    const batchSeenCodes = new Set<string>();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 7. Proses Setiap Baris CSV
    for (let index = 0; index < members.length; index++) {
      const m = members[index];
      const email = (m.email || '').trim().toLowerCase();
      const fullName = (m.full_name || '').trim();
      const memberCode = (m.member_code || '').trim().toUpperCase();
      const rawPassword = (m.password || '').toString().trim();
      const rawFieldCode = (m.field_code || '').trim().toUpperCase();
      const position = (m.organization_position || '').trim() || 'Anggota Panitia';
      const phone = (m.phone_number || '').toString().trim() || null;

      // -----------------------------------------------------------------------
      // A. Validasi Integritas Baris
      // -----------------------------------------------------------------------
      if (!email || !emailRegex.test(email)) {
        results.failedCount++;
        results.failed.push({
          member_code: memberCode || `ROW-${index + 1}`,
          full_name: fullName || 'Tanpa Nama',
          email: email || 'Kosong',
          reason: 'Format email tidak valid atau kosong',
        });
        continue;
      }

      if (!fullName || fullName.length < 2) {
        results.failedCount++;
        results.failed.push({
          member_code: memberCode || `ROW-${index + 1}`,
          full_name: fullName || 'Kosong',
          email,
          reason: 'Nama lengkap wajib diisi minimal 2 karakter',
        });
        continue;
      }

      if (!memberCode) {
        results.failedCount++;
        results.failed.push({
          member_code: 'KOSONG',
          full_name: fullName,
          email,
          reason: 'Kode anggota (member_code) wajib diisi',
        });
        continue;
      }

      // Sesuai ketentuan Supabase Auth, password minimal 6 karakter
      if (!rawPassword || rawPassword.length < 6) {
        results.failedCount++;
        results.failed.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          reason: 'Password minimal 6 karakter sesuai standar keamanan Supabase Auth',
        });
        continue;
      }

      // -----------------------------------------------------------------------
      // B. Deteksi Duplikat Intra-Batch
      // -----------------------------------------------------------------------
      if (batchSeenEmails.has(email)) {
        results.skippedCount++;
        results.skipped.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          reason: 'Duplikat dalam file CSV: email muncul lebih dari satu kali',
        });
        continue;
      }
      batchSeenEmails.add(email);

      if (batchSeenCodes.has(memberCode)) {
        results.failedCount++;
        results.failed.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          reason: 'Duplikat dalam file CSV: kode anggota muncul lebih dari satu kali',
        });
        continue;
      }
      batchSeenCodes.add(memberCode);

      // -----------------------------------------------------------------------
      // C. Pemeriksaan Idempoten & Duplikat Database Eksisting
      // -----------------------------------------------------------------------
      if (existingEmailMap.has(email) || existingAuthEmails.has(email)) {
        results.skippedCount++;
        results.skipped.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          reason: 'Akun dengan email ini sudah terdaftar sebelumnya (dilewati demi idempotensi)',
        });
        continue;
      }

      if (existingCodeMap.has(memberCode)) {
        results.failedCount++;
        results.failed.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          reason: `Kode anggota ${memberCode} sudah digunakan oleh panitia lain di database`,
        });
        continue;
      }

      // -----------------------------------------------------------------------
      // D. Resolusi Divisi
      // -----------------------------------------------------------------------
      const resolvedField = resolveField(rawFieldCode, position);
      const fieldId = resolvedField?.id || null;
      const fieldName = resolvedField?.name || 'Belum Ada Divisi';

      // -----------------------------------------------------------------------
      // E. Penegakan Hak Akses Berdasarkan Susunan Kepanitiaan Resmi
      // - Penanggung Jawab & Ketua Panitia -> admin
      // - Koordinator setiap sie -> coordinator
      // - Sekretaris, bendahara, dan seluruh anggota sie -> member
      // -----------------------------------------------------------------------
      let assignedSystemRole: 'admin' | 'coordinator' | 'member' = 'member';
      const posLower = position.toLowerCase();
      const emailLower = email.toLowerCase();

      if (
        emailLower === 'angga@genrebuleleng.org' ||
        posLower === 'penanggung jawab' ||
        emailLower === 'sukkun@genrebuleleng.org' ||
        (posLower.includes('ketua panitia') && !posLower.includes('wakil'))
      ) {
        assignedSystemRole = 'admin';
      } else if (posLower.startsWith('koordinator') || posLower.includes('koordinator sie')) {
        assignedSystemRole = 'coordinator';
      } else {
        assignedSystemRole = 'member';
      }

      // Jika dryRun (mode pratinjau validasi server), jangan eksekusi penulisan
      if (dryRun) {
        results.successCount++;
        results.created.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          field_code: rawFieldCode,
          field_name: fieldName,
          organization_position: position,
        });
        continue;
      }

      // -----------------------------------------------------------------------
      // F. Pembuatan Akun Supabase Auth & Profil dengan Mekanisme Rollback Aman
      // -----------------------------------------------------------------------
      let createdAuthUserId: string | null = null;

      try {
        // Buat akun Auth via Supabase Admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: rawPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            member_code: memberCode,
            system_role: assignedSystemRole,
            organization_position: position,
            must_change_password: true,
            imported_at: new Date().toISOString(),
          },
        });

        if (authError || !authData?.user) {
          const isEmailExists =
            (authError as any)?.code === 'email_exists' ||
            authError?.message?.toLowerCase().includes('registered') ||
            authError?.message?.toLowerCase().includes('duplicate');

          if (isEmailExists) {
            results.skippedCount++;
            results.skipped.push({
              member_code: memberCode,
              full_name: fullName,
              email,
              reason: 'Akun dengan email ini sudah terdaftar di Supabase Auth (dilewati demi idempotensi)',
            });
            continue;
          }

          results.failedCount++;
          results.failed.push({
            member_code: memberCode,
            full_name: fullName,
            email,
            reason: `Gagal membuat akun Supabase Auth: ${authError?.message || 'Identitas tidak valid'}`,
          });
          continue;
        }

        createdAuthUserId = authData.user.id;

        // Simpan Profil ke tabel profiles
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
          id: createdAuthUserId,
          member_code: memberCode,
          full_name: fullName,
          email,
          phone_number: phone,
          field_id: fieldId,
          system_role: assignedSystemRole,
          organization_position: position,
          account_status: 'active',
          joined_at: new Date().toISOString().split('T')[0],
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          // KOMPENSASI / ROLLBACK: Hapus akun Auth yang baru dibuat agar tidak gantung tanpa profil
          if (createdAuthUserId) {
            try {
              await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
            } catch (cleanupErr) {
              // Catat kegagalan cleanup jika terjadi
            }
          }

          results.failedCount++;
          results.failed.push({
            member_code: memberCode,
            full_name: fullName,
            email,
            reason: `Gagal menyimpan profil: ${profileError.message} (Akun Auth telah dibatalkan)`,
          });
          continue;
        }

        // Catat ke daftar eksisting agar baris berikutnya jika ada duplikasi langsung terdeteksi
        existingEmailMap.set(email, createdAuthUserId);
        existingCodeMap.set(memberCode, createdAuthUserId);
        existingAuthEmails.add(email);

        // Inisialisasi otomatis evaluasi nilai akhir untuk anggota baru secara akurat
        try {
          await calculateMemberEvaluation(createdAuthUserId, activePeriodId);
        } catch {
          // Silently continue
        }

        // Jika koordinator sie, hubungkan otomatis ke tabel fields (fields.coordinator_id)
        if (assignedSystemRole === 'coordinator' && fieldId) {
          try {
            await supabaseAdmin
              .from('fields')
              .update({ coordinator_id: createdAuthUserId })
              .eq('id', fieldId);
          } catch {}
        }

        results.successCount++;
        results.created.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          field_code: rawFieldCode,
          field_name: fieldName,
          organization_position: position,
        });
      } catch (err: any) {
        // Kompensasi darurat jika terjadi unhandled error
        if (createdAuthUserId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
          } catch {
            // Silently continue
          }
        }

        results.failedCount++;
        results.failed.push({
          member_code: memberCode,
          full_name: fullName,
          email,
          reason: `Kesalahan tak terduga: ${err.message || 'Error internal server'}`,
        });
      }
    }

    // 8. Pencatatan Jejak Audit (Audit Logs)
    if (!dryRun && (results.successCount > 0 || results.failedCount > 0)) {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: user.id,
          action_type: 'import_committee_accounts',
          entity_type: 'profiles',
          entity_id: user.id,
          new_values: {
            total_processed: results.total,
            success_count: results.successCount,
            skipped_count: results.skippedCount,
            failed_count: results.failedCount,
          },
          reason: `Impor massal akun panitia Pemilihan Duta GenRe Buleleng 2026/2027 (${results.successCount} berhasil, ${results.skippedCount} dilewati, ${results.failedCount} gagal)`,
        });
      } catch {
        // Audit log fail-safe
      }
    }

    return NextResponse.json({
      success: true,
      message: dryRun
        ? `Validasi selesai: ${results.successCount} valid, ${results.skippedCount} akan dilewati, ${results.failedCount} tidak valid.`
        : `Impor selesai: ${results.successCount} akun panitia berhasil dibuat, ${results.skippedCount} dilewati, ${results.failedCount} gagal.`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan internal pada server' },
      { status: 500 }
    );
  }
}
