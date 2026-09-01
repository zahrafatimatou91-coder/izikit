'use client';

import { useEffect } from 'react';

/**
 * Re-runs `revalidate` when this page is restored from the browser's
 * back/forward cache (bfcache) instead of freshly mounted.
 *
 * A bfcache restore resumes the page's exact previous JS state without
 * re-running any mount effects — so a data-fetching page you navigate
 * back to (dashboard -> envelopes -> back) can keep showing whatever it
 * last fetched (an old balance, an old envelope list) instead of the
 * real current numbers, until a full reload forces fresh JS execution.
 * `pageshow` with `event.persisted` is the standard signal for "this
 * page just came back from bfcache" — see AuthContext's session check
 * for the same mechanism applied to auth state.
 *
 * Call alongside the page's own mount-fetch effect, passing the same
 * (stable, useCallback-wrapped) function it already uses to load data:
 *
 *   const load = useCallback(async () => { ... }, []);
 *   useEffect(() => { if (user) void load(); }, [user, load]);
 *   useRevalidateOnRestore(load);
 */
export function useRevalidateOnRestore(revalidate: () => void): void {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) revalidate();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [revalidate]);
}
