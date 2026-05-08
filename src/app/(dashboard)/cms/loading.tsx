import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CmsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <Skeleton className="h-6 w-16 mb-1" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-48 rounded-lg mb-4" />
      <SkeletonTable rows={6} />
    </div>
  );
}
