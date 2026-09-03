// Admin sidebar navigation model. Kept as data (not JSX) so both the fixed
// desktop rail and the mobile slide-over drawer render from one source.
import type { IconName } from '@/components/ui/Icon';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: IconName;
  /** SUPERADMIN-only entries are hidden for a plain ADMIN. */
  superadminOnly?: boolean;
}

export interface AdminNavGroup {
  title: string | null;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: null,
    items: [
      { href: '/admin', label: "Vue d'ensemble", icon: 'layout-dashboard' },
      { href: '/admin/users', label: 'Utilisateurs', icon: 'users' },
      { href: '/admin/subscriptions', label: 'Abonnements', icon: 'package' },
      { href: '/admin/transactions', label: 'Transactions', icon: 'credit-card' },
    ],
  },
  {
    title: 'Système',
    items: [{ href: '/admin/config', label: 'Configuration', icon: 'settings' }],
  },
];

/** Is `pathname` inside the section owned by `href`? `/admin` matches only
 * itself; every other entry also matches its sub-routes. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}
