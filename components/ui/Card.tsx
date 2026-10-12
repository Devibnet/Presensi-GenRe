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
    <div className={`glass-card rounded-2xl border border-slate-800/80 p-5 sm:p-6 transition-all ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
          <div>
            {title && <h3 className="font-bold text-white text-base sm:text-lg tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
