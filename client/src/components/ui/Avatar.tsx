import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
  }[size];
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 font-semibold uppercase text-white dark:from-brand-400 dark:to-brand-600 dark:text-brand-950',
        sizes,
        className
      )}
      aria-hidden="true"
    >
      {initials(name) || 'Q'}
    </span>
  );
}
