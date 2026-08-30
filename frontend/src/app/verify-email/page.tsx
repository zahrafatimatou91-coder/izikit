// Reads ?email= and ?code= from the URL (both present when the user clicks
// the emailed link — auto-submits). The form is a fallback for manual entry.
'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, storeCsrfToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthCard } from '@/components/auth/AuthCard';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { useRipple } from '@/hooks/useRipple';

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const ripple = useRipple();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const qEmail = params.get('email');
    const qCode = params.get('code');
    if (qEmail && qCode) void verify(qEmail, qCode);
    // Intentionally runs once on mount only, to auto-submit from the emailed link.
  }, []);

  async function verify(emailValue: string, codeValue: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ csrfToken?: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: { email: emailValue, code: codeValue },
      });
      if (res.csrfToken) storeCsrfToken(res.csrfToken);
      await refresh();
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void verify(email, code);
  }

  async function onResend() {
    if (!email) {
      setError('Renseigne ton adresse e-mail pour recevoir un nouveau code.');
      return;
    }
    setResending(true);
    setResendMessage(null);
    setError(null);
    try {
      await api('/api/auth/resend-verification', { method: 'POST', body: { email } });
      setResendMessage('Un nouveau code a été envoyé si ce compte existe. Vérifie tes spams.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthCard
      title="Vérifie ton e-mail"
      subtitle="On t'a envoyé un code à 8 caractères. Il expire dans 15 minutes."
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
        <div>
          <label
            htmlFor="code"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Code de vérification
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
          disabled={submitting}
          onPointerDown={ripple}
          className="relative w-full overflow-hidden rounded-lg bg-primary px-4 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Vérification…' : 'Vérifier mon e-mail'}
        </button>
      </form>
      {resendMessage && (
        <p className="mt-6 font-body text-sm text-primary" role="status">
          {resendMessage}
        </p>
      )}

      <p className="mt-6 font-body text-xs text-muted-foreground">
        Pas reçu de code ?{' '}
        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          {resending ? 'Envoi…' : 'Renvoyer le code'}
        </button>
      </p>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
