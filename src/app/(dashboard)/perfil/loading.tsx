import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="max-w-lg">
      <Skeleton className="h-6 w-24 mb-1" />
      <Skeleton className="h-4 w-56 mb-6" />
      <div className="rounded-xl border border-ink-100 bg-white p-5 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
