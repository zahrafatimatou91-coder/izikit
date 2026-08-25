import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

interface ListPageSkeletonProps {
  rows?: number;
}

/** Generic list/table page shell placeholder (envelopes, history,
 * notifications, tips) — shown while auth/user or list data is loading,
 * in place of a blank white screen. */
export function ListPageSkeleton({ rows = 5 }: ListPageSkeletonProps) {
  return (
    <div className="flex min-h-screen bg-background font-body">
      <div className="hidden w-72 flex-col gap-6 border-r border-border bg-card px-6 py-8 lg:flex">
        <Skeleton className="h-8 w-32" />
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-6 lg:px-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        <div className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
              >
                <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
