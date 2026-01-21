'use client';

export function KPICardSkeleton() {
  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-2xl animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="h-4 w-32 bg-slate-700 rounded mb-2"></div>
          <div className="h-8 w-24 bg-slate-700 rounded"></div>
        </div>
        <div className="bg-slate-700 p-2 rounded-lg w-10 h-10"></div>
      </div>
      <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
        <div className="bg-slate-600 h-full w-2/3"></div>
      </div>
      <div className="h-3 w-40 bg-slate-700 rounded mt-3"></div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 min-h-[300px] animate-pulse">
      <div className="h-5 w-48 bg-slate-700 rounded mb-6"></div>
      <div className="flex items-end gap-2 h-48 mt-8 justify-between px-4">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div key={i} className="w-full bg-slate-700/50 rounded-t-lg relative">
            <div
              style={{ height: `${h}%` }}
              className="absolute bottom-0 w-full bg-slate-700 rounded-t-lg"
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4 px-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-3 w-8 bg-slate-700 rounded"></div>
        ))}
      </div>
    </div>
  );
}

export function FiscalHealthSkeleton() {
  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 animate-pulse">
      <div className="h-5 w-40 bg-slate-700 rounded mb-4"></div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-slate-700 rounded"></div>
              <div className="h-4 w-32 bg-slate-700 rounded"></div>
            </div>
            <div className="h-4 w-20 bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-6 border-t border-slate-700">
        <div className="h-10 w-full bg-slate-700 rounded-xl"></div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-10">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex-1">
          <div className="h-10 w-80 bg-slate-800 rounded mb-2 animate-pulse"></div>
          <div className="h-5 w-64 bg-slate-800 rounded animate-pulse"></div>
        </div>
        <div className="h-10 w-48 bg-slate-800 rounded-full animate-pulse"></div>
      </div>

      {/* ANNE Skeleton */}
      <div className="mb-12">
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 flex items-start gap-6 animate-pulse">
          <div className="bg-slate-700 p-4 rounded-xl w-16 h-16"></div>
          <div className="flex-1">
            <div className="h-4 w-32 bg-slate-700 rounded mb-3"></div>
            <div className="h-6 w-full bg-slate-700 rounded"></div>
          </div>
          <div className="h-10 w-32 bg-slate-700 rounded-xl"></div>
        </div>
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <FiscalHealthSkeleton />
      </div>
    </div>
  );
}
