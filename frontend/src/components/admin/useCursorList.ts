'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface CursorListState<T> {
  items: T[] | null;
  error: string | null;
  busy: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  next: () => void;
  prev: () => void;
  reload: () => void;
}

/**
 * Cursor-pagination driver for the admin list screens. The backend returns
 * `{ items, nextCursor }` and has no page numbers, so we keep a stack of the
 * cursors we've walked through: `prev` pops, `next` pushes `nextCursor`.
 * Changing `params` (a filter/search change) resets to the first page.
 *
 * `params` is shallow-compared via its JSON — callers can pass a fresh
 * object literal each render.
 */
export function useCursorList<T>(path: string, params: Record<string, string>): CursorListState<T> {
  const paramsKey = JSON.stringify(params);
  const [stack, setStack] = useState<(string | null)[]>([null]);
  const [items, setItems] = useState<T[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  const cursor = stack[stack.length - 1] ?? null;

  const fetchPage = useCallback(
    async (activeCursor: string | null) => {
      const id = ++reqId.current;
      setBusy(true);
      setError(null);
      // Rebuild the query from paramsKey (not the `params` object) so this
      // callback's deps are complete without depending on a fresh object
      // identity each render.
      const qs = new URLSearchParams(JSON.parse(paramsKey) as Record<string, string>);
      if (activeCursor) qs.set('cursor', activeCursor);
      try {
        const res = await api<Page<T>>(`${path}?${qs.toString()}`);
        if (reqId.current !== id) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
      } catch (err) {
        if (reqId.current !== id) return;
        setItems([]);
        setNextCursor(null);
        setError(err instanceof ApiError ? err.message : 'Erreur de chargement.');
      } finally {
        if (reqId.current === id) setBusy(false);
      }
    },
    [path, paramsKey],
  );

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setStack([null]);
    setItems(null);
  }, [paramsKey]);

  useEffect(() => {
    void fetchPage(cursor);
  }, [fetchPage, cursor]);

  const next = useCallback(() => {
    if (nextCursor) setStack((s) => [...s, nextCursor]);
  }, [nextCursor]);

  const prev = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const reload = useCallback(() => {
    void fetchPage(cursor);
  }, [fetchPage, cursor]);

  return {
    items,
    error,
    busy,
    hasPrev: stack.length > 1,
    hasNext: nextCursor !== null,
    next,
    prev,
    reload,
  };
}
