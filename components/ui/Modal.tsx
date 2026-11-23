'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-xl',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Positioning wrapper: min-h-full + items-center guarantees perfect vertical alignment without clipping */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
        {/* Modal Dialog Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 w-full ${maxWidth} max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-left my-auto`}
          role="dialog"
          aria-modal="true"
        >
          {/* Sticky Header: Judul & Tombol Tutup (X) Selalu Terlihat di Atas */}
          <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 bg-white shrink-0">
            <div className="min-w-0 pr-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                {title}
              </h3>
              {description && (
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 -mr-1 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body: Form & Konten Nyaman Di-scroll di Dalam */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 overflow-y-auto flex-1 overscroll-contain">
            {children}
          </div>

          {/* Optional Footer */}
          {footer && (
            <div className="px-5 py-3.5 sm:px-6 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
