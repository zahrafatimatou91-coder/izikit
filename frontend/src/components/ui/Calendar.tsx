'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/Button';

// Adapted from a 21st.dev/shadcn reference component. Two changes from the
// original beyond token mapping:
//  1. `accent` in this app means "alert/over-budget" (orange, see
//     globals.css) — NOT a neutral hover tint like shadcn's default
//     palette. The original used `hover:bg-accent` for plain day hovers,
//     which here would look like a warning. Replaced with `bg-muted`.
//  2. No separate `dark:` overrides: this app's tokens (`--color-primary`
//     etc.) already swap value under `[data-theme='dark']` /
//     `prefers-color-scheme`, so a single `bg-primary` adapts on its own.
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  locale = fr,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: 'relative flex flex-col sm:flex-row gap-6',
    month: 'w-full',
    month_caption:
      'relative mb-2 flex h-9 items-center justify-center font-headings text-base font-bold text-foreground',
    caption_label: 'text-sm font-medium',
    nav: 'absolute top-1 flex w-full justify-between px-2 z-10',
    button_previous: cn(
      buttonVariants({ variant: 'ghost', size: 'icon' }),
      'size-8 rounded-full text-muted-foreground hover:text-foreground',
    ),
    button_next: cn(
      buttonVariants({ variant: 'ghost', size: 'icon' }),
      'size-8 rounded-full text-muted-foreground hover:text-foreground',
    ),
    weekdays: 'grid grid-cols-7 text-center text-xs font-medium uppercase text-muted-foreground/80',
    weekday: 'py-1',
    week: 'grid grid-cols-7',
    day_button:
      'relative flex size-9 items-center justify-center rounded-full text-sm transition-all ' +
      'hover:bg-muted hover:text-foreground ' +
      'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70 ' +
      'group-data-[selected]:bg-primary group-data-[selected]:text-primary-foreground group-data-[selected]:shadow-md ' +
      'group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-40 group-data-[disabled]:hover:bg-transparent group-data-[disabled]:hover:text-muted-foreground/40',
    day: 'text-center',
    range_start: 'rounded-l-full bg-primary text-primary-foreground shadow-md',
    range_end: 'rounded-r-full bg-primary text-primary-foreground shadow-md',
    range_middle: 'rounded-none bg-primary/10 text-foreground transition-colors',
    today:
      'after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary',
    outside: 'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
    hidden: 'invisible',
    week_number: 'size-9 p-0 text-xs font-medium text-muted-foreground/80',
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(
            defaultClassNames[key as keyof typeof defaultClassNames],
            classNames[key as keyof typeof classNames],
          )
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {} as typeof defaultClassNames,
  );

  const defaultComponents = {
    Chevron: ({ orientation, ...chevronProps }: { orientation?: string }) => {
      const ChevronIcon = orientation === 'left' ? ChevronLeft : ChevronRight;
      return <ChevronIcon size={18} strokeWidth={2} {...chevronProps} aria-hidden="true" />;
    },
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn('w-fit rounded-xl border border-border bg-card p-3 shadow-sm', className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
