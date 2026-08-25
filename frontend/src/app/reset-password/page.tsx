// No auto-login after reset — resetting bumps tokenVersion to invalidate
// any stolen sessions, so the user logs in fresh with the new password.
//
// Two-step flow (was one form with email+code+newPassword submitted
// together): step 1 verifies the code via POST /api/auth/verify-reset-code
// (read-only check, doesn't consume the code) before the new-password field
// is even shown, so a wrong/expired code is caught immediately instead of
// only surfacing after the user has typed a new password. The real
// verify+consume+update still only happens in POST /api/auth/reset-password
// — step 1 is a UX gate, not a security boundary; step 2 re-validates
// everything server-side regardless of what step 1 said.
'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { AuthCard } from '@/components/auth/AuthCard';
import { Icon } from '@/components/ui/Icon';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';

function resetErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'TOO_MANY_RESET_ATTEMPTS') {
      return 'Trop de tentatives. Attends 10 minutes et réessaie.';
    }
    if (err.code === 'VERIFICATION_CODE_EXPIRED') {
      return 'Ce code a expiré. Demande un nouveau code.';
    }
    if (err.code === 'VERIFICATION_CODE_INVALID') {
      return 'Ce code est invalide. Vérifie-le ou demande un nouveau code.';
    }
    return err.message;
  }
  return 'Une erreur est survenue.';
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<'verify' | 'reset'>('verify');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const qEmail = params.get('email');
    const qCode = params.get('code');
    if (qEmail && qCode) void verifyCode(qEmail, qCode);
    // Intentionally runs once on mount only, to auto-verify from the emailed link.
  }, []);

  async function verifyCode(emailValue: string, codeValue: string) {
    setVerifying(true);
    setError(null);
    try {
      await api('/api/auth/verify-reset-code', {
        method: 'POST',
        body: { email: emailValue, code: codeValue },
      });
      setStep('reset');
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  function onVerifySubmit(e: FormEvent) {
    e.preventDefault();
    void verifyCode(email, code);
  }

  async function onResetSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { email, code, newPassword } });
      router.push('/login?reset=ok');
    } catch (err) {
      setError(resetErrorMessage(err));
      // The code may have expired or been consumed elsewhere between step 1
      // and this submit — send the user back to re-verify rather than
      // leaving them stuck on a password field for a code that no longer works.
      if (
        err instanceof ApiError &&
        (err.code === 'VERIFICATION_CODE_INVALID' || err.code === 'VERIFICATION_CODE_EXPIRED')
      ) {
        setStep('verify');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'verify') {
    return (
      <AuthCard
        title="Réinitialise ton mot de passe"
        subtitle="Entre le code reçu par e-mail pour continuer."
      >
        <form onSubmit={onVerifySubmit} className="flex flex-col gap-4">
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
          {error && (
            <p role="alert" className="font-body text-sm text-accent">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={verifying}
            className="w-full rounded-lg bg-primary px-4 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {verifying ? 'Vérification…' : 'Vérifier le code'}
          </button>
        </form>
        <p className="mt-6 font-body text-xs text-muted-foreground">
          Pas de code ?{' '}
          <Link href="/forgot-password" className="font-medium text-primary">
            Redemande-en un
          </Link>
        </p>
        <p className="mt-2 font-body text-xs text-muted-foreground">
          <Link href="/login" className="font-medium text-primary">
            Retour à la connexion
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choisis un nouveau mot de passe">
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2.5">
        <Icon i="check-circle" size={16} className="flex-shrink-0 text-primary" />
        <p className="font-body text-sm text-primary">Code vérifié — {email}</p>
      </div>
      <form onSubmit={onResetSubmit} className="flex flex-col gap-4">
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
        <button
          type="button"
          onClick={() => setStep('verify')}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Ce n&apos;est pas le bon code ?
        </button>
      </p>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
