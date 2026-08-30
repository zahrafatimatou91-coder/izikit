'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { useRipple } from '@/hooks/useRipple';

/** Bell icon button shared by every authenticated page header — was a dead
 * decorative button on 5 pages (dashboard, envelopes, history, progress,
 * tips) before Phase 5; now fetches the real unread count and links to
 * /notifications. */
export function NotificationBell() {
  const router = useRouter();
  const ripple = useRipple();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ count: number }>('/api/notifications/count')
      .then((res) => {
        if (!cancelled) setCount(res.count);
      })
      .catch(() => {
        // Non-critical — badge just stays at 0 on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => router.push('/notifications')}
      onPointerDown={ripple}
      aria-label={count > 0 ? `Notifications (${count} non lues)` : 'Notifications'}
      className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground hover:bg-border"
    >
      <Icon i="bell" size={20} />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-body text-[10px] font-bold leading-none text-accent-foreground">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
