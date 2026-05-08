import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CollectionLoading() {
  return (
    <div>
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="flex items-center justify-between mb-5">
        <div>
          <Skeleton className="h-6 w-40 mb-1" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
