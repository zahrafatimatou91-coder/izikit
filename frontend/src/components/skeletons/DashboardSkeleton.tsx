import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

/** Full dashboard shell placeholder — shown while auth/user or dashboard
 * data is still loading, in place of a blank white screen. */
export function DashboardSkeleton() {
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
          <div className="mt-auto flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-6 lg:px-8">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        <div className="flex-1 px-4 pb-32 pt-6 lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
              <Skeleton className="h-40 rounded-lg lg:col-span-2" />
              <Skeleton className="hidden h-40 rounded-lg lg:block" />
              <Skeleton className="hidden h-40 rounded-lg lg:block" />
            </div>

            <div>
              <Skeleton className="mb-4 h-5 w-36" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            </div>

            <div>
              <Skeleton className="mb-4 h-5 w-40" />
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-4 w-16" />
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
