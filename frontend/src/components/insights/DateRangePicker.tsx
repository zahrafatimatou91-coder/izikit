'use client';

import { useEffect, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  isSameDay,
} from 'date-fns';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Calendar } from '@/components/ui/Calendar';
import { useRipple } from '@/hooks/useRipple';

export interface DateRangeValue {
  from: Date;
  to: Date;
}

interface Preset {
  label: string;
  range: DateRangeValue;
}

// weekStartsOn: 1 (Monday) matches the backend's startOfIsoWeek. Full
// calendar periods (not "to date") throughout, matching what the old
// preset row already did for Ce mois-ci / Le mois dernier / 3 derniers
// mois — kept identical so switching pickers doesn't change any numbers
// for an existing preset, only adds the missing year option.
function buildPresets(today: Date): Preset[] {
  const lastMonth = subMonths(today, 1);
  const lastYear = subYears(today, 1);
  return [
    { label: "Aujourd'hui", range: { from: today, to: today } },
    {
      label: 'Cette semaine',
      range: {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
      },
    },
    { label: 'Ce mois-ci', range: { from: startOfMonth(today), to: endOfMonth(today) } },
    {
      label: 'Le mois dernier',
      range: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) },
    },
    {
      label: '3 derniers mois',
      range: { from: startOfMonth(subMonths(today, 2)), to: endOfMonth(today) },
    },
    { label: 'Cette année', range: { from: startOfYear(today), to: endOfYear(today) } },
    {
      label: "L'année dernière",
      range: { from: startOfYear(lastYear), to: endOfYear(lastYear) },
    },
  ];
}

function sameRange(a: DateRangeValue, b: DateRangeValue): boolean {
  return isSameDay(a.from, b.from) && isSameDay(a.to, b.to);
}

/** The friendly preset name for a range ("Ce mois-ci", "Cette année", …),
 * or null when it doesn't exactly match one of the presets below (a
 * genuinely custom calendar selection). Exported so the page can reuse
 * the same "Ce mois-ci" wording in body copy (e.g. the empty state) —
 * the backend's `period.label` is always a literal date range now that
 * every request sends explicit `from`/`to`, so without this the empty
 * state would read "Aucune transaction sur 1 août 2026 – 31 août 2026"
 * instead of "sur ce mois-ci". */
export function matchPresetLabel(value: DateRangeValue): string | null {
  const preset = buildPresets(new Date()).find((p) => sameRange(p.range, value));
  return preset?.label ?? null;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  /** Shown only when `value` doesn't exactly match one of the presets
   * below (a genuinely custom calendar selection) — e.g. the backend's
   * formatted "3 janvier – 15 mars 2026". For any preset, the trigger
   * always shows the preset's own name ("Ce mois-ci", "Cette année", …)
   * computed locally, never this fallback — the picker mustn't lose its
   * own preset name to a generic date-range echo from the API. */
  fallbackLabel: string;
  onChange: (range: DateRangeValue) => void;
}

/** Trigger chip + popover combining quick presets with a free calendar
 * range. Replaces the old fixed 4-preset pill row, which had no way to
 * reach a specific year — the gap that prompted this rebuild. Popover
 * open/close follows the same self-contained pattern as
 * TransactionRow's menu (outside mousedown/touchstart closes it). */
export function DateRangePicker({ value, fallbackLabel, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(value);
  const ripple = useRipple();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    function handleOutsideClick(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [open]);

  const presets = buildPresets(new Date());
  const matchedPreset = presets.find((p) => sameRange(p.range, value));
  const displayLabel = matchedPreset?.label ?? fallbackLabel;

  function applyPreset(range: DateRangeValue) {
    onChange(range);
    setOpen(false);
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    setDraft(range);
    if (range?.from && range.to) {
      onChange({ from: range.from, to: range.to });
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onPointerDown={ripple}
        className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-input px-4 py-2 font-body text-sm text-foreground"
      >
        <Icon i="calendar" size={16} className="text-muted-foreground" />
        {displayLabel}
        <Icon i="chevron-down" size={16} className="ml-1 text-muted-foreground" />
      </button>

      {/* Card width is explicit at sm+, not w-auto: the calendar sits
          inside a w-fit DayPicker root inside a flex row inside a
          shrink-to-fit (w-auto) Card — that chain has a circular
          intrinsic-sizing dependency once the row switches to flex-row
          (sm:), and collapsed the calendar to ~32px in testing. An
          explicit width breaks the cycle. */}
      {open && (
        <Card className="absolute left-0 top-full z-20 mt-2 w-[min(92vw,26rem)] p-3 sm:w-[29rem]">
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Vertical list at every size — a horizontal scrolling row
                here would repeat the BottomNav overflow mistake (7 French
                preset labels don't fit one line on a 375px popover, and
                scroll-with-no-affordance is a bad pattern either way). */}
            <div className="flex flex-col gap-1 sm:w-40 sm:flex-shrink-0 sm:border-r sm:border-border sm:pr-2">
              {presets.map((p) => {
                const active = sameRange(p.range, value);
                return (
                  <Button
                    key={p.label}
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    className="justify-start whitespace-nowrap"
                    onClick={() => applyPreset(p.range)}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
            <div className="flex justify-center overflow-x-auto">
              <Calendar
                mode="range"
                selected={draft}
                onSelect={handleCalendarSelect}
                defaultMonth={value.to}
                className="rounded-none border-0 bg-transparent p-0 shadow-none"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
