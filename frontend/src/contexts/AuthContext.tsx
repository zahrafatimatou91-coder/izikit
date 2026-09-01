'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, ApiError, clearCsrfToken, storeCsrfToken } from '@/lib/api';
import { invalidateCachePrefix } from '@/lib/useApi';
import { COOKIE_PREFIX } from '@/lib/constants';

export interface User {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** false when the account was created via OAuth and never set a password. */
  hasPassword: boolean;
  /** Provider names already linked, e.g. ['google']. Empty for pure email/password accounts. */
  linkedProviders: string[];
  name: string | null;
  avatarUrl: string | null;
  totalBudget: number | null;
  budgetFrequency: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loggingOut: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ user: User; csrfToken?: string }>('/api/auth/me');
      setUser(res.user);
      if (res.csrfToken) storeCsrfToken(res.csrfToken);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else if (err instanceof ApiError && err.status === 429) {
        setError('Too many requests. Wait a few minutes and try again.');
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'Cannot reach the server. Check your network and try again.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip /me for anonymous visitors — the JS-readable CSRF cookie is only
    // set after login, so its absence is a reliable "no session" signal.
    const checkSession = () => {
      const csrfCookieName = `${COOKIE_PREFIX}-csrf`;
      const hasCookie = document.cookie
        .split(';')
        .some((c) => c.trim().startsWith(`${csrfCookieName}=`));
      if (!hasCookie) {
        setUser(null);
        setLoading(false);
        return;
      }
      void fetchUser();
    };

    checkSession();

    // Back/forward navigation can restore this exact page from the
    // browser's bfcache instead of re-running any JS — the mount effect
    // above never fires again, so a session that changed while the page
    // sat cached (logged in elsewhere, logged out, expired) stayed stuck
    // showing whatever `user` last held until a real reload forced fresh
    // JS execution. `pageshow` with `event.persisted` is the standard
    // signal for "this page just came back from bfcache" — re-run the
    // same check when it fires.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) checkSession();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
    // Run once on mount; fetchUser is stable.
  }, [fetchUser]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore — cookie will expire anyway
    }
    clearCsrfToken();
    invalidateCachePrefix('/api/');
    setUser(null);
    setLoggingOut(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loggingOut, error, refresh: fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const SSR_STUB: AuthContextValue = {
  user: null,
  loading: true,
  loggingOut: false,
  error: null,
  refresh: async () => {},
  logout: async () => {},
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (typeof window === 'undefined') return SSR_STUB;
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}

/**
 * Auth-required helper — returns the user, or redirects to the configured
 * login path if logged out. Use on pages that require an authenticated
 * session so each page doesn't reimplement the same `if (!user) router.push`.
 *
 *   export default function DashboardPage() {
 *     const user = useUser();         // never null inside the body
 *     if (!user) return null;         // null while redirecting / loading
 *     return <div>Hello {user.email}</div>;
 *   }
 *
 * Default redirect target is `/login`; override via the `redirectTo` arg.
 * Returns `null` while loading OR while the redirect is in flight, so the
 * UI can render a stub. Use the `loading` field of useAuth() if you want
 * to render a spinner explicitly.
 */
export function useUser(redirectTo: string = '/login'): User | null {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`${redirectTo}${next}`);
    }
  }, [loading, user, redirectTo, pathname, router]);

  if (loading || !user) return null;
  return user;
}

/**
 * Guest-only helper — the inverse of useUser(): bounces an already
 * authenticated visitor away from a page meant for logged-out people
 * (/login, /signup) instead of showing them a stale form for a session
 * they're already in.
 *
 *   export default function LoginPage() {
 *     const isGuest = useGuestOnly();  // false while redirecting/loading
 *     if (!isGuest) return null;
 *     return <LoginForm />;
 *   }
 *
 * Default redirect target is `/dashboard`; override via `redirectTo`.
 * Returns `false` while loading OR while the redirect is in flight, so the
 * caller can render nothing rather than flash the guest-only content.
 */
export function useGuestOnly(redirectTo: string = '/dashboard'): boolean {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo);
    }
  }, [loading, user, redirectTo, router]);

  return !loading && !user;
}
