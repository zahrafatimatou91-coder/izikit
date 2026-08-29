import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

/** /insights shell placeholder — mirrors the real page: the date-range
 * trigger button, 3 stat cards, the per-envelope breakdown list, and the
 * goal projections list. */
export function InsightsSkeleton() {
  return (
    <div className="flex min-h-screen bg-background font-body">
      <div className="hidden w-72 flex-shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 hidden h-screen w-72 flex-col gap-6 overflow-y-auto border-r border-border bg-card px-6 py-8 lg:flex">
          <Skeleton className="h-8 w-32" />
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col pb-32 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 lg:hidden" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:gap-8">
            <Skeleton className="h-9 w-40 max-w-full rounded-lg" />

            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-6">
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Skeleton className="mb-4 h-5 w-48" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Skeleton className="mb-4 h-5 w-40" />
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
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
