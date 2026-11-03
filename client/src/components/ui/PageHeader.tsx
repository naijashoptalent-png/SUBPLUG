import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border border-line bg-raised px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-6', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-brand-700 dark:text-brand-300">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-base text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
