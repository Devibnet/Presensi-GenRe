import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Card({ children, className = '', title, subtitle, action }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_6px_20px_-4px_rgba(15,23,42,0.08)] transition-all duration-200 p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4 pb-3.5 border-b border-slate-100">
          <div>
            {title && <h3 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
