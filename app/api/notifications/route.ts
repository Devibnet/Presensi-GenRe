import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// -----------------------------------------------------------------------------
// GET: Ambil Daftar Notifikasi Pengguna
// -----------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const customUserId = searchParams.get('userId');

    let targetUserId = user?.id || customUserId;

    if (!targetUserId) {
      // Fallback demo user
      const { data: firstAdmin } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('system_role', 'admin')
        .limit(1)
        .maybeSingle();
      targetUserId = firstAdmin?.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ success: true, data: [], unreadCount: 0 });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unreadCount = (data || []).filter((n: any) => !n.is_read).length;

    return NextResponse.json({
      success: true,
      data: data || [],
      unreadCount,
    });
  } catch (err: any) {
    console.error('Error in GET /api/notifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: Buat Notifikasi Baru (Direct atau Broadcast ke seluruh panitia aktif)
// -----------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const body = await request.json();

    const {
      userId,
      title,
      message,
      notificationType = 'general',
      actionUrl = null,
      broadcastToAll = false,
    } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Judul dan pesan notifikasi wajib diisi.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    if (broadcastToAll) {
      // Broadcast ke seluruh anggota aktif
      const { data: activeMembers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('account_status', 'active');

      if (activeMembers && activeMembers.length > 0) {
        const batchNotifs = activeMembers.map((m: any) => ({
          user_id: m.id,
          title: title.trim(),
          message: message.trim(),
          notification_type: notificationType,
          action_url: actionUrl,
          is_read: false,
          created_at: nowIso,
        }));

        await supabaseAdmin.from('notifications').insert(batchNotifs);
      }

      return NextResponse.json({
        success: true,
        message: 'Notifikasi berhasil disiarkan ke seluruh panitia.',
      });
    }

    // Direct notification ke pengguna tertentu
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: defaultUser } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      targetUserId = defaultUser?.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target pengguna tidak ditemukan.' }, { status: 400 });
    }

    const { data: created, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: targetUserId,
        title: title.trim(),
        message: message.trim(),
        notification_type: notificationType,
        action_url: actionUrl,
        is_read: false,
        created_at: nowIso,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Notifikasi berhasil dikirim!',
      data: created,
    });
  } catch (err: any) {
    console.error('Error in POST /api/notifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: Tandai Notifikasi Sebagai Sudah Dibaca
// -----------------------------------------------------------------------------
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { notificationId, markAll = false, userId } = body;

    const targetUserId = user?.id || userId;

    if (markAll && targetUserId) {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', targetUserId);

      return NextResponse.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca.' });
    }

    if (notificationId) {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      return NextResponse.json({ success: true, message: 'Notifikasi ditandai telah dibaca.' });
    }

    return NextResponse.json({ error: 'ID notifikasi atau markAll wajib disertakan.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in PATCH /api/notifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: Hapus Notifikasi
// -----------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAllUserId = searchParams.get('clearAllUserId');

    if (clearAllUserId) {
      await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', clearAllUserId);

      return NextResponse.json({ success: true, message: 'Seluruh notifikasi berhasil dibersihkan.' });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID notifikasi wajib disertakan.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Notifikasi berhasil dihapus.' });
  } catch (err: any) {
    console.error('Error in DELETE /api/notifications:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan internal' }, { status: 500 });
  }
}
