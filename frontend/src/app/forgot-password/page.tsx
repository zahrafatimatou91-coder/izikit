// Enumeration-resistant — always shows the same "check your email" screen
// regardless of whether the account exists.
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { AuthCard } from '@/components/auth/AuthCard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOO_MANY_RESET_REQUESTS') {
        setError('Trop de demandes pour cet e-mail. Réessaie dans une heure.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AuthCard title="Vérifie ton e-mail">
        <p className="font-body text-sm text-muted-foreground">
          Si un compte existe pour <strong className="text-foreground">{email}</strong>, tu recevras
          un code de réinitialisation dans la minute.
        </p>
        <p className="mt-4 font-body text-sm">
          <Link
            href={`/reset-password?email=${encodeURIComponent(email)}`}
            className="font-medium text-primary"
          >
            Tu as déjà ton code ?
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Mot de passe oublié ?"
      subtitle="Entre ton e-mail et on t'enverra un code de réinitialisation."
    >
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
          {submitting ? 'Envoi…' : 'Envoyer le code'}
        </button>
      </form>
      <p className="mt-6 font-body text-xs text-muted-foreground">
        Tu t&apos;en souviens ?{' '}
        <Link href="/login" className="font-medium text-primary">
          Se connecter
        </Link>
        .
      </p>
    </AuthCard>
  );
}
