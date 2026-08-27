import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

/** /progress shell placeholder — mirrors the real page: 3 stat boxes,
 * a 2-column grid of savings-goal cards, and the weekly day-by-day
 * breakdown list. Shown while auth/user or goal data is still loading,
 * in place of a blank white screen or stale content. */
export function ProgressSkeleton() {
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

      <div className="flex flex-1 flex-col pb-24 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 lg:hidden" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:gap-8">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-12" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="mb-3 h-2 w-full rounded-full" />
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-card p-8">
              <Skeleton className="mb-6 h-5 w-48" />
              <div className="space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-input p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
