import { cn } from '@/lib/utils';

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--color-fill-soft)]', className)}>
      <div
        className={cn(
          'h-full rounded-full bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] transition-[width] duration-300',
          indicatorClassName
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
