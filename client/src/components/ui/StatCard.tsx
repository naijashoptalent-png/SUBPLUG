import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './States';

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  tone = 'brand',
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  trend?: { value: string; positive?: boolean };
  tone?: 'brand' | 'success' | 'warning' | 'info';
  loading?: boolean;
  className?: string;
}) {
  const toneClasses = {
    brand: 'bg-brand-500/10 text-brand-700 dark:text-brand-300',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  }[tone];

  return (
    <div className={cn('card relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{label}</p>
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', toneClasses)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-4 h-8 w-28" />
      ) : (
        <p className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">{value}</p>
      )}
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'text-xs font-semibold',
              trend.positive === false ? 'text-danger' : 'text-success'
            )}
          >
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
    </div>
  );
}
