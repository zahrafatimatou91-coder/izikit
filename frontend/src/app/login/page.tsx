'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, storeCsrfToken } from '@/lib/api';
import { useAuth, useGuestOnly } from '@/contexts/AuthContext';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { PasswordField } from '@/components/auth/PasswordField';
import { Icon } from '@/components/ui/Icon';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { useRipple } from '@/hooks/useRipple';

// Same-origin Next.js API route — top-level navigation, not a fetch.
const googleSignInHref = '/api/auth/oauth/google/start?next=/dashboard';

// Guards against an open-redirect: only a same-origin relative path (not
// starting with `//`, which the browser treats as protocol-relative) is
// honored. Anything else falls back to the default post-login destination.
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const ripple = useRipple();
  const isGuest = useGuestOnly();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isGuest) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ csrfToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (res.csrfToken) storeCsrfToken(res.csrfToken);
      await refresh();
      router.push(safeNext(params.get('next')) ?? '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell activeTab="login">
      {params.get('reset') === 'ok' && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-primary/10 px-3 py-2.5 font-body text-sm text-primary"
        >
          Mot de passe réinitialisé. Connecte-toi avec ton nouveau mot de passe.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Adresse e-mail
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2.5">
            <Icon i="mail" size={16} className="flex-shrink-0 text-muted-foreground" />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Mot de passe
          </label>
          <PasswordField
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <p className="mt-1 text-right">
            <Link href="/forgot-password" className="font-body text-xs font-medium text-primary">
              Mot de passe oublié ?
            </Link>
          </p>
        </div>

        {error && (
          <p role="alert" className="font-body text-sm text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          onPointerDown={ripple}
          className="relative w-full overflow-hidden rounded-lg bg-primary px-4 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="font-body text-xs text-muted-foreground">ou continuer avec</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <a
          href={googleSignInHref}
          onPointerDown={ripple}
          className="relative flex items-center justify-center gap-2 overflow-hidden rounded-lg border border-border bg-card px-4 py-2.5"
        >
          <GoogleIcon />
          <span className="font-body text-sm font-medium text-foreground">
            Continuer avec Google
          </span>
        </a>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
