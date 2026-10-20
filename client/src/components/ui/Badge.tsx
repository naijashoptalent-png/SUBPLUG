import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '@/lib/format';
import type { FundingStatus, TransactionStatus } from '@/types';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface text-muted border-line',
  brand: 'bg-brand-500/10 text-brand-700 border-brand-500/20 dark:text-brand-300',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  info: 'bg-info/10 text-info border-info/25',
  purple: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-300',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5',
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

const statusTones: Record<string, BadgeTone> = {
  SUCCESSFUL: 'success',
  PENDING: 'warning',
  PROCESSING: 'info',
  CREATED: 'neutral',
  FAILED: 'danger',
  REVERSED: 'purple',
  REFUNDED: 'purple',
  REQUIRES_REVIEW: 'warning',
  ABANDONED: 'neutral',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  CLOSED: 'neutral',
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  HEALTHY: 'success',
  DEGRADED: 'warning',
  DOWN: 'danger',
  UNKNOWN: 'neutral',
};

export function StatusBadge({
  status,
  className,
}: {
  status: TransactionStatus | FundingStatus | string;
  className?: string;
}) {
  const label =
    (STATUS_LABELS as Record<string, string>)[status] ??
    status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge tone={statusTones[status] ?? 'neutral'} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}
