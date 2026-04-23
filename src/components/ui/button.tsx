import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] text-white shadow-[var(--shadow-button)] hover:brightness-[1.03] disabled:bg-[var(--color-fill-muted)] disabled:text-[var(--color-text-muted)] disabled:shadow-none',
  secondary:
    'bg-[var(--color-fill-soft)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-fill-soft-hover)] disabled:bg-[var(--color-fill-muted)] disabled:text-[var(--color-text-muted)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-text)]',
  danger:
    'bg-[var(--color-danger)] text-white shadow-[0_12px_24px_-18px_rgba(220,38,38,0.7)] hover:brightness-[1.03] disabled:bg-[var(--color-fill-muted)] disabled:text-[var(--color-text-muted)] disabled:shadow-none',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
  icon: 'h-10 w-10',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed active:scale-[0.99]',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
