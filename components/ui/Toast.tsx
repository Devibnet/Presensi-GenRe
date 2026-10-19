'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  X,
  Bell
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (title: string, message?: string, duration?: number) => void;
    error: (title: string, message?: string, duration?: number) => void;
    info: (title: string, message?: string, duration?: number) => void;
    warning: (title: string, message?: string, duration?: number) => void;
  };
  notify: (item: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (title: string, message?: string, duration = 4000) =>
      notify({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration = 5000) =>
      notify({ type: 'error', title, message, duration }),
    info: (title: string, message?: string, duration = 4000) =>
      notify({ type: 'info', title, message, duration }),
    warning: (title: string, message?: string, duration = 4500) =>
      notify({ type: 'warning', title, message, duration }),
  };

  return (
    <ToastContext.Provider value={{ toast, notify }}>
      {children}

      {/* Container Toast Notifications di Pojok Kanan Atas */}
      <div 
        aria-live="polite"
        className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="alert"
            className={`pointer-events-auto transform transition-all duration-300 ease-out translate-y-0 opacity-100 flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md ${
              item.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-emerald-600/10'
                : item.type === 'error'
                ? 'bg-rose-50/95 border-rose-300 text-rose-950 shadow-rose-600/10'
                : item.type === 'warning'
                ? 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-amber-600/10'
                : 'bg-teal-50/95 border-teal-300 text-teal-950 shadow-teal-600/10'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {item.type === 'success' && (
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              {item.type === 'error' && (
                <div className="p-1 rounded-lg bg-rose-100 text-rose-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}
              {item.type === 'warning' && (
                <div className="p-1 rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              {item.type === 'info' && (
                <div className="p-1 rounded-lg bg-teal-100 text-teal-700">
                  <Info className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold tracking-tight leading-tight">
                {item.title}
              </h4>
              {item.message && (
                <p className="text-[11px] sm:text-xs opacity-90 mt-1 leading-relaxed">
                  {item.message}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-750 hover:bg-black/5 transition-colors"
              title="Tutup Notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast harus digunakan di dalam ToastProvider');
  }
  return context;
}
