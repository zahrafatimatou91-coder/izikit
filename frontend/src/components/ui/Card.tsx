import * as React from 'react';
import { cn } from '@/lib/utils';

// Minimal — only the bare wrapper is needed today (DateRangePicker). Add
// CardHeader/CardTitle/CardContent/CardFooter if a second consumer needs
// them; no point building unused axes now.
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export { Card };
