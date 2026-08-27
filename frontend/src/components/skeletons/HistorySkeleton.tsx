import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

/** /history shell placeholder — mirrors the real page: transactions
 * grouped under a month label, each group a bordered card of rows
 * (icon, label/category, amount + time). Shown while auth/user or
 * transaction data is still loading, in place of a blank white screen
 * or stale content. */
export function HistorySkeleton() {
  return (
    <div className="flex min-h-screen bg-background font-body">
      <div className="hidden w-72 flex-shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 hidden h-screen w-72 flex-col gap-6 overflow-y-auto border-r border-border bg-card px-6 py-8 lg:flex">
          <Skeleton className="h-8 w-32" />
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col pb-24 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 lg:hidden" />
            <Skeleton className="h-6 w-52" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg lg:w-44" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
            {Array.from({ length: 2 }).map((_, g) => (
              <div key={g}>
                <Skeleton className="mb-3 h-3 w-28" />
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card px-4 lg:px-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-4">
                      <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                      <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-3 w-2/5" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
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
