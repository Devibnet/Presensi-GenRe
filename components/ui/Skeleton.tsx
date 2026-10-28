import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base shimmering skeleton box
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-slate-200/80 ${className}`}
      {...props}
    />
  );
}

/**
 * Placeholder for Metric/Stat Cards (e.g. Total Panitia, Agenda, Hadir)
 */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * Placeholder for Activity Agenda Cards
 */
export function SkeletonActivityCard() {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4 animate-fade-in">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24 rounded-lg" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder for Data Tables (Panitia, Nilai, Sertifikat, Presensi)
 */
export function SkeletonTable({
  rows = 5,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="w-full space-y-3 animate-fade-in">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-slate-50/70 border border-slate-100 gap-4"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 flex-1 justify-around">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-5 w-12" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-8 w-18 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Placeholder for Clarification / Manual Request List Items
 */
export function SkeletonCardList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-xl" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
