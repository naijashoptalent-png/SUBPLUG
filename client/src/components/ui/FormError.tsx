import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FormError({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p className={cn('mt-1.5 text-xs font-medium text-danger', className)} role="alert">
      {children}
    </p>
  );
}
