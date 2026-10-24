import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onOpenChange(false);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onOpenChange]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      className={cn(
        'm-auto flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-line bg-raised p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-fade-up sm:max-h-[min(85vh,52rem)] sm:w-[calc(100vw-2rem)] sm:rounded-3xl',
        sizes[size]
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface hover:text-ink"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      {footer ? (
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6 [&>button]:w-full sm:[&>button]:w-auto">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
