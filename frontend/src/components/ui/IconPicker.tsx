'use client';

import { useMemo, useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';

export interface IconChoice {
  icon: IconName;
  /** French search terms, accent-stripped comparison — lets "café" match
   * typing "cafe". */
  keywords: string[];
}

interface IconPickerProps {
  value: IconName;
  onChange: (icon: IconName) => void;
  catalog: IconChoice[];
}

export function stripAccents(s: string): string {
  return s
    .replace(/[àâ]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c');
}

/** Searchable icon grid — closer to a WhatsApp/emoji-picker (search first,
 * then tap) than the fixed 8-16 icon shortlists this app used to ship per
 * form. Filters `catalog` by icon name or keyword as the user types;
 * `catalog` stays caller-supplied so each form (savings goals, envelopes...)
 * can offer its own themed set through the same picker. */
export function IconPicker({ value, onChange, catalog }: IconPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = stripAccents(query.trim().toLowerCase());
    if (!q) return catalog;
    return catalog.filter(
      ({ icon, keywords }) => icon.includes(q) || keywords.some((k) => stripAccents(k).includes(q)),
    );
  }, [query, catalog]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher une icône (ex : repas, sport, voyage…)"
        className="mb-2 w-full rounded-lg border border-border bg-input px-3 py-2 font-body text-sm text-foreground outline-none"
      />
      {filtered.length === 0 ? (
        <p className="py-3 text-center font-body text-xs text-muted-foreground">
          Aucune icône trouvée.
        </p>
      ) : (
        <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto sm:grid-cols-8">
          {filtered.map(({ icon }) => (
            <button
              key={icon}
              type="button"
              onClick={() => onChange(icon)}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${
                value === icon ? 'border-primary bg-primary/10' : 'border-border bg-input'
              }`}
            >
              <Icon
                i={icon}
                size={16}
                className={value === icon ? 'text-primary' : 'text-muted-foreground'}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
