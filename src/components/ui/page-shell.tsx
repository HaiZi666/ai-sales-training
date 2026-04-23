import * as React from 'react';
import { cn } from '@/lib/utils';

export function PageShell({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-h-screen bg-[var(--color-bg)] px-4 pb-28 pt-8 md:px-6 md:pt-10', className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)] md:text-4xl">{title}</h1>
        {description ? <p className="text-sm leading-6 text-[var(--color-text-secondary)] md:text-base">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
