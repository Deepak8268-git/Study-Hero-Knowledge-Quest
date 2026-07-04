import React from 'react';

const SkeletonBlock: React.FC<{ rows?: number; className?: string }> = ({ rows = 3, className = '' }) => (
  <div className={`animate-pulse space-y-3 ${className}`} aria-label="Loading">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="h-4 bg-gray-200 rounded w-full" style={{ maxWidth: `${100 - index * 12}%` }}></div>
    ))}
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg p-4 shadow-sm"><SkeletonBlock rows={2} /></div>
      ))}
    </div>
    <div className="bg-white rounded-xl shadow-md p-6"><SkeletonBlock rows={6} /></div>
  </div>
);

export const LoadingOverlay: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center" role="status" aria-live="polite">
    <div className="bg-white rounded-lg shadow-xl px-6 py-5 flex items-center gap-3 text-gray-700">
      <i className="ri-loader-4-line text-2xl text-primary animate-spin"></i>
      {label}
    </div>
  </div>
);

export default SkeletonBlock;