import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

/** /envelopes shell placeholder — mirrors the real page: a 3-stat budget
 * summary bar, then a 2-column grid of envelope cards (icon + name,
 * progress bar, budget line). Shown while auth/user or envelope data is
 * still loading, in place of a blank white screen or stale content. */
export function EnvelopesSkeleton() {
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
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
            <div className="flex flex-col gap-4 rounded-lg bg-input p-6 sm:flex-row sm:items-center sm:justify-between">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 sm:items-end">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-28" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Skeleton className="h-11 w-56 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
