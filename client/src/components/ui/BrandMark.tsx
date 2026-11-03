import { cn } from '@/lib/utils';

type BrandVariant = 'full' | 'mark' | 'inverse';

export function BrandMark({
  className,
  showName = true,
  name = 'SubPlug',
  variant,
}: {
  className?: string;
  showName?: boolean;
  name?: string;
  variant?: BrandVariant;
}) {
  const selectedVariant = variant ?? (showName ? 'full' : 'mark');
  const src = selectedVariant === 'mark'
    ? '/brand/subplug-mark.svg'
    : selectedVariant === 'inverse'
      ? '/brand/subplug-logo-inverse.svg'
      : '/brand/subplug-logo.svg';

  return (
    <span className={cn('inline-flex items-center', className)} title={name}>
      <img
        src={src}
        alt={name}
        className={cn('block w-auto object-contain', selectedVariant === 'mark' ? 'h-9 aspect-square' : 'h-10 max-w-[10.5rem]')}
      />
    </span>
  );
}
