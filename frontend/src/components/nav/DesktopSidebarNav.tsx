import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { NAV_ITEMS, type NavId } from './nav-items';

export type { NavId };

interface DesktopSidebarNavProps {
  active: NavId;
  userName: string;
  userEmail: string;
  avatarUrl?: string | null;
}

/** Left sidebar shared by every desktop-width authenticated page (dashboard,
 * envelopes, history, and later tips/progress/settings) — Banani repeated
 * this exact block across 8+ screens verbatim, so it's extracted once here
 * rather than copy-pasted per page. Hidden below `lg:` — mobile uses
 * `BottomNav` instead. */
export function DesktopSidebarNav({
  active,
  userName,
  userEmail,
  avatarUrl = null,
}: DesktopSidebarNavProps) {
  return (
    <div className="hidden w-64 flex-col border-r border-border bg-card px-6 py-8 lg:flex">
      <div className="mb-12">
        <h1 className="font-headings text-2xl font-bold text-primary">
          Chaque
          <br />
          Franc
        </h1>
      </div>

      <nav className="mb-auto flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
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
  );
}
