import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...props} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card space-y-3 p-6" aria-label="Loading content" role="status">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface text-muted">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'We could not load this',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)} role="alert">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description ?? 'Check your connection and try again.'}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function OfflineNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-warning">
        <WifiOff className="h-4 w-4" aria-hidden="true" />
        <span>You appear to be offline. Some actions may not work.</span>
      </div>
      {onRetry ? (
        <button type="button" className="font-semibold text-warning underline underline-offset-4" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
