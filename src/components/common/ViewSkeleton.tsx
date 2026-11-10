import React from 'react';

export const ViewSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse pb-12" aria-busy="true" aria-label="Loading view">
      {/* Header bar skeleton */}
      <div className="h-20 bg-slate-100/80 rounded-2xl border border-slate-200/60 p-4 sm:p-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-slate-200 rounded-md"></div>
          <div className="h-3 w-72 bg-slate-200 rounded-md"></div>
        </div>
        <div className="h-9 w-28 bg-slate-200 rounded-xl"></div>
      </div>

      {/* Metric / summary grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-100/70 border border-slate-200/60 rounded-2xl p-4 space-y-3">
            <div className="h-4 w-20 bg-slate-200 rounded"></div>
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
            <div className="h-3 w-32 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>

      {/* Main card body skeleton */}
      <div className="h-80 bg-slate-100/60 border border-slate-200/60 rounded-2xl p-6 space-y-4">
        <div className="h-5 w-40 bg-slate-200 rounded"></div>
        <div className="h-4 w-full bg-slate-200/80 rounded"></div>
        <div className="h-4 w-5/6 bg-slate-200/80 rounded"></div>
        <div className="h-4 w-4/6 bg-slate-200/80 rounded"></div>
      </div>
    </div>
  );
};
