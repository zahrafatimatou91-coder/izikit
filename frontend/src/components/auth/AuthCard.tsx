import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Centered single-column card for auth utility screens (verify email,
 * forgot/reset password) that Banani didn't design a screen for — kept
 * visually consistent with the tokens/fonts from the designed screens. */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 font-body">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-8">
        <div className="mb-6">
          <BrandLogo size="sm" />
        </div>
        <h1 className="mb-2 font-headings text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mb-6 font-body text-sm text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}
