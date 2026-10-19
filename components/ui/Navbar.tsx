'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  LogOut, 
  Bell, 
  Clock, 
  Menu, 
  CheckCheck, 
  Trash2, 
  ExternalLink,
  Calendar,
  MessageSquare,
  Award,
  UserCheck,
  CheckCircle2,
  Info,
  X
} from 'lucide-react';
import { LogoutModal } from '@/components/ui/LogoutModal';
import { GenreLogo } from '@/components/ui/GenreLogo';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
  title?: string;
  userName?: string;
}

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  action_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export function Navbar({ onToggleMobileMenu, title = 'Panel Administrasi', userName }: NavbarProps) {
  const router = useRouter();
  const [timeWITA, setTimeWITA] = useState<string>('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // 1. Clock WITA
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Makassar',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now);
        setTimeWITA(formatted + ' WITA');
      } catch {
        setTimeWITA('');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Notifications
  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listener custom event untuk refresh seketika jika ada aktivitas baru
    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener('refresh-notifications', handleRefresh);

    // Polling setiap 30 detik
    const pollInterval = setInterval(fetchNotifications, 30000);

    return () => {
      window.removeEventListener('refresh-notifications', handleRefresh);
      clearInterval(pollInterval);
    };
  }, []);

  // 3. Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationOpen]);

  // 4. Mark Single as Read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Error marking as read:', err);
    }
  };

  // 5. Mark All as Read
  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Error marking all as read:', err);
    }
  };

  // 6. Delete Single Notification
  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target && !target.is_read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      console.warn('Error deleting notification:', err);
    }
  };

  // 7. Navigation when notification clicked
  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (item.action_url) {
      setIsNotificationOpen(false);
      router.push(item.action_url);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 1) return 'Baru saja';
      if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} jam lalu`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} hari lalu`;
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'attendance':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'clarification':
        return <MessageSquare className="w-4 h-4 text-amber-600" />;
      case 'assignment':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'evaluation':
      case 'certificate':
        return <Award className="w-4 h-4 text-purple-600" />;
      default:
        return <Info className="w-4 h-4 text-teal-600" />;
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] print:hidden">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            suppressHydrationWarning
            onClick={onToggleMobileMenu}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition-colors border border-slate-200"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="lg:hidden w-8 h-8 rounded-lg bg-white p-0.5 border border-slate-200/90 flex items-center justify-center shrink-0 shadow-2xs">
            <GenreLogo size={26} />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-semibold text-slate-400">Portal Panitia</span>
            <span className="hidden sm:inline text-slate-300">/</span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">{title}</h2>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time WITA Clock */}
        <div
          suppressHydrationWarning
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50/80 border border-teal-200/80 text-xs font-mono text-teal-800 font-bold"
        >
          <Clock className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
          <span suppressHydrationWarning>{timeWITA || 'WITA Clock'}</span>
        </div>

        {/* Notifications Icon & Popover */}
        <div className="relative" ref={dropdownRef}>
          <button
            suppressHydrationWarning
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            title="Pusat Notifikasi"
            className={`p-2 rounded-xl border transition-all relative ${
              isNotificationOpen
                ? 'bg-teal-50 border-teal-300 text-teal-900'
                : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-rose-500 text-[9px] font-extrabold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </span>
            )}
          </button>

          {/* Dropdown Box */}
          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden transform transition-all duration-200 animate-in fade-in slide-in-from-top-2">
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-900">Pusat Notifikasi</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                      {unreadCount} baru
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors"
                      title="Tandai semua dibaca"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Dibaca</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsNotificationOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    title="Tutup"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                      <Bell className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Belum Ada Notifikasi</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Semua respon proses dan agenda akan tampil di sini.</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer group ${
                        !item.is_read ? 'bg-teal-50/30 font-medium' : 'opacity-85'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5 p-2 rounded-xl bg-slate-100 group-hover:bg-white transition-colors border border-slate-200/50">
                        {getNotificationIcon(item.notification_type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>

                        {item.action_url && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700">
                            <span>Buka Halaman</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!item.is_read && (
                          <button
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            className="p-1 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                            title="Tandai dibaca"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteNotification(item.id, e)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Hapus notifikasi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Total: {notifications.length} notifikasi</span>
                  <button
                    onClick={async () => {
                      if (confirm('Yakin ingin membersihkan seluruh riwayat notifikasi?')) {
                        await fetch('/api/notifications?clearAllUserId=all', { method: 'DELETE' });
                        fetchNotifications();
                      }
                    }}
                    className="text-slate-400 hover:text-rose-600 transition-colors font-semibold"
                  >
                    Bersihkan Semua
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          suppressHydrationWarning
          onClick={() => setIsLogoutModalOpen(true)}
          title="Keluar Akun"
          className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-700 transition-colors text-xs font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>

      {/* Confirmation Modal Logout */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userName={userName}
      />
    </header>
  );
}

