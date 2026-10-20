import { Phone, Tv, Wifi, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServiceType } from '@/types';

const config: Record<ServiceType, { icon: typeof Phone; classes: string; label: string }> = {
  AIRTIME: { icon: Phone, classes: 'bg-amber-500/12 text-amber-600 dark:text-amber-400', label: 'Airtime' },
  DATA: { icon: Wifi, classes: 'bg-info/10 text-info', label: 'Mobile data' },
  ELECTRICITY: { icon: Zap, classes: 'bg-brand-500/12 text-brand-700 dark:text-brand-300', label: 'Electricity' },
  CABLE: { icon: Tv, classes: 'bg-purple-500/12 text-purple-600 dark:text-purple-400', label: 'Cable TV' },
};

export function ServiceIcon({
  service,
  size = 'md',
  className,
}: {
  service: ServiceType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const entry = config[service] ?? config.AIRTIME;
  const Icon = entry.icon;
  const sizeClasses = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-12 w-12 rounded-2xl',
  }[size];
  const iconClasses = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }[size];

  return (
    <span className={cn('grid shrink-0 place-items-center', sizeClasses, entry.classes, className)} title={entry.label}>
      <Icon className={iconClasses} aria-hidden="true" />
      <span className="sr-only">{entry.label}</span>
    </span>
  );
}

export function serviceLabel(service: ServiceType) {
  return config[service]?.label ?? service;
}
