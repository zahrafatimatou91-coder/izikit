import { Skeleton } from '@/components/ui/Skeleton';

/** Generic centered form/detail page placeholder (transaction/goal forms,
 * tip detail, settings) — shown while auth/user data is loading, in place
 * of a blank white screen. */
export function FormPageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 font-body">
      <div className="flex w-full max-w-md flex-col gap-5">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-4 h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="mt-4 h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
