// Flow: signup → "check your email" → /verify-email (8-char code) → cookies
// issued → /onboarding. Signup never logs in directly (see api/auth/signup),
// and is enumeration-resistant — the response is identical whether the email
// is new or already registered.
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { Icon } from '@/components/ui/Icon';

// Top-level navigation (not fetch) — same-origin Next.js API route.
const googleSignInHref = '/api/auth/oauth/google/start?next=/onboarding';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/signup', { method: 'POST', body: { email, password } });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell activeTab="signup">
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
          <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2.5">
            <Icon i="lock" size={16} className="flex-shrink-0 text-muted-foreground" />
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={10}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mt-1 font-body text-xs text-muted-foreground">Au moins 10 caractères.</p>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 border-primary accent-primary"
          />
          <span className="font-body text-xs leading-relaxed text-muted-foreground">
            J&apos;accepte les{' '}
            <span className="font-medium text-primary">
              Conditions Générales d&apos;Utilisation
            </span>{' '}
            et la <span className="font-medium text-primary">Politique de Confidentialité</span>
          </span>
        </label>

        {error && (
          <p role="alert" className="font-body text-sm text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !agreed}
          className="w-full rounded-lg bg-primary px-4 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Création…' : 'Créer mon compte'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="font-body text-xs text-muted-foreground">ou continuer avec</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <a
          href={googleSignInHref}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5"
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
