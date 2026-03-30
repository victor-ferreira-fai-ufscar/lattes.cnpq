import { Skeleton } from "@/components/ui/skeleton"

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="space-y-4 w-full max-w-6xl px-4">
        {/* Header skeleton */}
        <Skeleton className="h-8 w-48" />

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="flex gap-2 justify-end pt-4">
          <Skeleton className="h-10 w-32 rounded" />
          <Skeleton className="h-10 w-32 rounded" />
        </div>
      </div>
    </div>
  );
}
