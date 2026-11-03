import { cn } from '@/lib/utils';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('relative inline-flex h-5 w-5 items-center justify-center', className)}>
      <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="text-brand-500/20" />
        <path d="M12 3a9 9 0 0 1 8.3 5.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand-600 dark:text-brand-300" />
      </svg>
      <svg className="relative h-[38%] w-[38%] text-success" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 2.5 9 6 3 9.5V2.5Z" fill="currentColor" /></svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageSpinner({ label = 'Loading SubPlug' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface" role="status">
      <div className="relative grid h-20 w-20 place-items-center" aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full animate-spin text-brand-500" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="3" className="opacity-15" /><path d="M40 5a35 35 0 0 1 31 19" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg>
        <span className="grid h-14 w-14 place-items-center rounded-[1.15rem] bg-raised p-2 shadow-soft ring-1 ring-brand-500/10"><img src="/brand/subplug-mark.svg" alt="" className="h-full w-full object-contain" /></span>
        <span className="absolute inset-1 animate-ping rounded-full border border-brand-500/20" />
      </div>
      <p className="text-sm text-muted">{label}…</p>
    </div>
  );
}
