import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-[rgba(15,23,42,0.36)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-[1] w-full max-w-md rounded-[24px] border border-white/70 bg-white shadow-[var(--shadow-modal)]',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
            {description ? <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children ? <div className="px-6 pb-2">{children}</div> : null}
        {footer ? <div className="flex gap-3 border-t border-[var(--color-border-soft)] px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
