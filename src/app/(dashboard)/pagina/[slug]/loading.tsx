import { Skeleton } from "@/components/ui/skeleton";

export default function PageLoading() {
  return (
    <div className="animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-5">
        <div>
          <Skeleton className="h-6 w-40 mb-1" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-64 rounded-lg mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
