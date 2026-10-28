import React from 'react';
import { Skeleton, SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Metrics Row Skeleton */}
      <SkeletonStats count={4} />

      {/* Content Card Skeleton */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <SkeletonTable rows={5} />
      </div>
    </div>
  );
}
