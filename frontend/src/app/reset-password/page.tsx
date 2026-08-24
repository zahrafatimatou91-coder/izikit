// No auto-login after reset — resetting bumps tokenVersion to invalidate
// any stolen sessions, so the user logs in fresh with the new password.
'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { AuthCard } from '@/components/auth/AuthCard';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { email, code, newPassword } });
      router.push('/login?reset=ok');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOO_MANY_RESET_ATTEMPTS') {
        setError('Trop de tentatives. Attends 10 minutes et réessaie.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Réinitialise ton mot de passe">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="code"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Code de réinitialisation
          </label>
          <input
            id="code"
            type="text"
            required
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-foreground outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="newPassword"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Nouveau mot de passe
          </label>
          <input
            id="newPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
          />
          <p className="mt-1 font-body text-xs text-muted-foreground">Au moins 10 caractères.</p>
        </div>
        {error && (
          <p role="alert" className="font-body text-sm text-accent">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary px-4 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
        </button>
      </form>
      <p className="mt-6 font-body text-xs text-muted-foreground">
        <Link href="/login" className="font-medium text-primary">
          Retour à la connexion
        </Link>
      </p>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
