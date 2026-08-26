'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { NAV_ITEMS, type NavId } from './nav-items';

interface MobileDrawerNavProps {
  active: NavId;
  userName: string;
  userEmail: string;
  avatarUrl?: string | null;
  open: boolean;
  onClose: () => void;
}

/** Hamburger-triggered slide-in nav drawer for mobile — same destinations
 * as `DesktopSidebarNav`. `BottomNav` stays the primary always-visible
 * mobile nav; this covers the classic side-menu pattern on top of it. */
export function MobileDrawerNav({
  active,
  userName,
  userEmail,
  avatarUrl = null,
  open,
  onClose,
}: MobileDrawerNavProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`}>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-card px-6 py-8 shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-12 flex items-center justify-between">
          <h1 className="font-headings text-2xl font-bold text-primary">
            Chaque
            <br />
            Franc
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon i="x" size={22} />
          </button>
        </div>

        <nav className="mb-auto flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 font-body text-sm font-medium ${
                active === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Icon i={item.icon} size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 border-t border-border pt-6">
          <UserAvatar
            name={userName}
            avatarUrl={avatarUrl}
            className="h-10 w-10 flex-shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <p className="font-body text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate font-body text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
