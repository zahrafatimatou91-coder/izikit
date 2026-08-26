import type { Icon } from '@/components/ui/Icon';

// 'notifications' has no entry below (not a primary nav destination —
// reachable via the bell icon on every page instead, same as Banani's own
// NotificationsDesktop.jsx source, which doesn't highlight any sidebar item
// either). Included in the union purely so pages can pass it and get the
// (correct) "nothing highlighted" result.
export type NavId =
  | 'dashboard'
  | 'envelopes'
  | 'progress'
  | 'tips'
  | 'history'
  | 'settings'
  | 'notifications';

/** Shared by DesktopSidebarNav and MobileDrawerNav — both render the same
 * destinations, just in a different shell (always-visible column vs.
 * hamburger-triggered slide-in). */
export const NAV_ITEMS: {
  id: NavId;
  href: string;
  icon: Parameters<typeof Icon>[0]['i'];
  label: string;
}[] = [
  { id: 'dashboard', href: '/dashboard', icon: 'layout-dashboard', label: 'Tableau' },
  { id: 'envelopes', href: '/envelopes', icon: 'package', label: 'Enveloppes' },
  { id: 'progress', href: '/progress', icon: 'target', label: 'Objectifs' },
  { id: 'tips', href: '/tips', icon: 'lightbulb', label: 'Conseils' },
  { id: 'history', href: '/history', icon: 'clock', label: 'Historique' },
  { id: 'settings', href: '/settings', icon: 'settings', label: 'Paramètres' },
];
