'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, isNavActive } from './nav';
import { useAdmin } from './AdminContext';

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6">
      {ADMIN_NAV.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {group.title && (
            <p className="mb-2 px-3 font-headings text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              {group.title}
            </p>
          )}
          {group.items.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground',
                )}
              >
                <Icon i={item.icon} size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <Icon i="layout-dashboard" size={18} className="text-primary-foreground" />
      </span>
      <div>
        <p className="font-headings text-sm font-bold text-foreground">Admin</p>
        <p className="font-body text-[11px] text-muted-foreground">Chaque Franc</p>
      </div>
    </div>
  );
}

function Footer() {
  const { admin } = useAdmin();
  const { logout } = useAuth();
  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
      <div className="min-w-0">
        <p className="truncate font-body text-xs font-medium text-foreground">{admin.email}</p>
        <p className="font-body text-[11px] text-muted-foreground">{admin.role}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 font-body text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <Icon i="arrow-left" size={14} />
          Retour à l&apos;app
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex items-center gap-2 rounded-lg px-3 py-2 font-body text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <Icon i="log-out" size={14} />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background font-body">
      {/* Fixed desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto border-r border-border bg-input px-5 py-6 lg:flex">
        <div className="mb-8">
          <Brand />
        </div>
        <NavLinks pathname={pathname} />
        <Footer />
      </aside>

      {/* Mobile slide-over drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col overflow-y-auto border-r border-border bg-input px-5 py-6">
            <div className="mb-8 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-background"
                aria-label="Fermer le menu"
              >
                <Icon i="x" size={18} />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <Footer />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-input"
            aria-label="Ouvrir le menu"
          >
            <Icon i="ellipsis" size={20} />
          </button>
          <Brand />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
