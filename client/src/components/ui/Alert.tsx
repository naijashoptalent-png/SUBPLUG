import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  info: { icon: Info, classes: 'border-info/25 bg-info/10 text-info' },
  success: { icon: CheckCircle2, classes: 'border-success/25 bg-success/10 text-success' },
  warning: { icon: AlertTriangle, classes: 'border-warning/30 bg-warning/10 text-warning' },
  danger: { icon: ShieldAlert, classes: 'border-danger/30 bg-danger/10 text-danger' },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  icon,
}: {
  variant?: keyof typeof variants;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const config = variants[variant];
  const Icon = config.icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', config.classes, className)} role="note">
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="h-4 w-4" aria-hidden="true" />}</span>
      <div className="min-w-0 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn('text-current/90', title && 'mt-0.5')}>{children}</div> : null}
      </div>
    </div>
  );
}
