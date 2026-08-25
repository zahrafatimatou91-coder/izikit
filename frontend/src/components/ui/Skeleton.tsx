interface SkeletonProps {
  className?: string;
}

/** Shimmering placeholder block — base primitive for all loading skeletons. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}
