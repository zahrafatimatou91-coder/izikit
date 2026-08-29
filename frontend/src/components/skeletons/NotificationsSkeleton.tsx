import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

/** /notifications shell placeholder — mirrors the real page: filter
 * pills row, then a stack of notification cards (icon-wrap + title/body
 * + timestamp). Shown while auth/user or notification data is still
 * loading, in place of a blank white screen or stale content. */
export function NotificationsSkeleton() {
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

      <div className="flex flex-1 flex-col pb-32 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 lg:hidden" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-5 w-5" />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 flex-shrink-0 rounded-full" />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 rounded-lg border border-border bg-card p-4">
                  <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
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
