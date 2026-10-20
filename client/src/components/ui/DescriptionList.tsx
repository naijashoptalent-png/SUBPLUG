import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: DescriptionItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const columnClass = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
  }[columns];

  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', columnClass, className)}>
      {items.map((item, index) => (
        <div key={index} className={cn('min-w-0', item.className)}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">{item.label}</dt>
          <dd className={cn('mt-1 break-words text-sm text-ink', item.mono && 'font-mono text-xs')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
