import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/nav/BottomNav';

/** /tips shell placeholder — mirrors the real page: an intro banner,
 * then a 3-column grid of tip cards (icon, title, excerpt, savings
 * estimate). Shown while auth/user or tip data is still loading, in
 * place of a blank white screen or stale content. */
export function TipsSkeleton() {
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
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
            <Skeleton className="h-16 w-full rounded-lg" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-6">
                  <Skeleton className="mb-4 h-10 w-10 rounded-lg" />
                  <Skeleton className="mb-2 h-4 w-3/4" />
                  <Skeleton className="mb-1 h-3 w-full" />
                  <Skeleton className="mb-4 h-3 w-2/3" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>

            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
