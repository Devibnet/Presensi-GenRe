/**
 * Helper client-side untuk memicu Notifikasi In-App & sinkronisasi UI Real-time
 */

export interface CreateNotificationParams {
  userId?: string;
  title: string;
  message: string;
  notificationType?: 'general' | 'assignment' | 'attendance' | 'task' | 'evaluation' | 'certificate' | 'clarification';
  actionUrl?: string | null;
  broadcastToAll?: boolean;
}

export async function sendInAppNotification(params: CreateNotificationParams) {
  try {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    
    // Pemicu event real-time untuk Navbar notification center
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refresh-notifications'));
    }

    return await res.json();
  } catch (err) {
    console.warn('Error saat mengirim notifikasi in-app:', err);
    return null;
  }
}
