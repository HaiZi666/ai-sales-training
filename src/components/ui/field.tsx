import * as React from 'react';
import { cn } from '@/lib/utils';

const fieldClassName =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-ring)]';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(fieldClassName, 'h-11', className)} {...props} />;
  }
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(fieldClassName, 'min-h-[132px] resize-y py-3 leading-6', className)}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
