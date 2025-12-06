import { StatsCardsSkeleton, DataTableSkeleton } from '@/components/shared/data-table-skeleton'

export default function ResellerTeamLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-5 w-72 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="mb-8">
          <StatsCardsSkeleton count={4} />
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          <DataTableSkeleton rows={5} columns={4} />
        </div>
      </div>
    </div>
  )
}
