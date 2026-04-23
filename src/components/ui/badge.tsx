import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--color-fill-soft)] text-[var(--color-text-secondary)]',
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success-strong)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-strong)]',
};

export function Badge({
  className,
  variant = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
