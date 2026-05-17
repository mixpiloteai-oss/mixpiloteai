// ============================================================
// NEUROTEK AI — Loading Skeletons
// ============================================================
import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ className, width, height, rounded = 'md' }: SkeletonProps) {
  const roundedClass = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={clsx('animate-pulse', roundedClass, className)}
      style={{
        width,
        height,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'rgba(26,26,46,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <Skeleton width={40} height={40} rounded="lg" className="flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton height={14} width="60%" />
        <Skeleton height={10} width="40%" />
      </div>
      <Skeleton width={80} height={20} rounded="md" className="flex-shrink-0 hidden md:block" />
    </div>
  );
}

export function TrackRowSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2" style={{ background: 'rgba(20,20,32,0.8)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <Skeleton width={14} height={28} rounded="sm" className="flex-shrink-0" />
      <Skeleton width={4} height={32} rounded="full" className="flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton height={12} width="45%" />
        <Skeleton height={9} width="30%" />
      </div>
      <Skeleton width={80} height={24} className="hidden md:block flex-shrink-0" />
      <Skeleton width={28} height={28} rounded="md" className="flex-shrink-0" />
      <Skeleton width={28} height={28} rounded="md" className="flex-shrink-0" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(26,26,46,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center justify-between mb-2">
        <Skeleton height={10} width="50%" />
        <Skeleton width={28} height={28} rounded="lg" />
      </div>
      <Skeleton height={28} width="40%" className="mt-1" />
      <Skeleton height={10} width="35%" className="mt-2" />
    </div>
  );
}
