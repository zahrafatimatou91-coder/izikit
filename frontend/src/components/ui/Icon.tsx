'use client';

import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

interface IconProps {
  /** Icon name in lucide's kebab-case registry, e.g. "alert-triangle". */
  i: IconName;
  size?: number;
  className?: string;
}

/** Lazy-loaded lucide icon by kebab-case name — only the icons actually
 * rendered get fetched, no bundle bloat from importing the whole set. */
export function Icon({ i, size = 20, className }: IconProps) {
  return <DynamicIcon name={i} size={size} className={className} />;
}
