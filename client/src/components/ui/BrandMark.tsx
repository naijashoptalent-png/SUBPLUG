import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({
  className,
  showName = true,
  name = 'SubPlug',
}: {
  className?: string;
  showName?: boolean;
  name?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm dark:from-brand-400 dark:to-brand-600 dark:text-brand-950">
        <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full border border-white/25" aria-hidden="true" />
        <Zap className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </span>
      {showName ? <span className="font-display text-lg font-bold tracking-tight text-ink">{name}</span> : null}
    </span>
  );
}
