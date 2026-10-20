import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center text-muted', className)}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageSpinner({ label = 'Loading QuickTopUp' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface" role="status">
      <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-brand-700 text-white shadow-glow dark:bg-brand-500 dark:text-brand-950">
        <span className="font-display text-2xl font-bold">Q</span>
        <span className="absolute inset-0 animate-ping rounded-2xl border border-brand-500/40" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted">{label}…</p>
    </div>
  );
}
