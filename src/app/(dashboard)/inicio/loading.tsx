import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-7 w-56 mb-1" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-ink-100 bg-white px-5 py-5">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Banner */}
      <Skeleton className="h-[220px] rounded-[14px]" />

      {/* Table */}
      <SkeletonTable rows={4} />
    </div>
  );
}
