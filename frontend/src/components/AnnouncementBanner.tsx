'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

interface Announcement {
  message: string;
  tone: 'info' | 'warn';
}

const DISMISS_KEY = 'app-announcement-dismissed';

/**
 * App-wide banner set by an admin (AppSetting "announcement"). Mounted once
 * in the root layout, above every page. Dismissible per message — the
 * dismissed text is stored so a NEW announcement re-appears while the same
 * one stays hidden. Renders nothing when there's no announcement, on
 * failure, or while loading (no layout shift).
 */
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissedText, setDismissedText] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedText(localStorage.getItem(DISMISS_KEY));
    } catch {
      /* private mode / storage disabled — treat as not dismissed */
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<{ announcement: Announcement | null }>('/api/announcement');
        if (!cancelled) setAnnouncement(res.announcement);
      } catch {
        /* non-critical — banner just stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || announcement.message === dismissedText) return null;

  const warn = announcement.tone === 'warn';

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, announcement!.message);
    } catch {
      /* ignore */
    }
    setDismissedText(announcement!.message);
  }

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 px-4 py-2.5 font-body text-sm ${
        warn ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
      }`}
    >
      <Icon i={warn ? 'alert-triangle' : 'megaphone'} size={16} className="mt-0.5 flex-shrink-0" />
      <p className="flex-1">{announcement.message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer l'annonce"
        className="flex-shrink-0 rounded p-0.5 opacity-80 hover:opacity-100"
      >
        <Icon i="x" size={16} />
      </button>
    </div>
  );
}
