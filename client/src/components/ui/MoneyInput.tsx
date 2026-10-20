import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatNaira, parseNairaToMinor } from '@/lib/format';

interface MoneyInputProps {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  name?: string;
}

/**
 * Accepts Naira input and keeps the raw string in form state. The parsed
 * integer-kobo value is shown underneath so users can verify the exact amount.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = '0',
  disabled,
  required,
  className,
  id,
  autoFocus,
  name,
}: MoneyInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const minor = parseNairaToMinor(value);

  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={inputId} className="label">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">
          ₦
        </span>
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          disabled={disabled}
          required={required}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d.]/g, '');
            const [whole = '', ...rest] = next.split('.');
            const decimals = rest.join('').slice(0, 2);
            onChange(rest.length > 0 ? `${whole}.${decimals}` : whole);
          }}
          placeholder={placeholder}
          className={cn(
            'field h-14 pl-10 pr-4 text-xl font-semibold tracking-tight',
            error && 'field-error'
          )}
          aria-invalid={Boolean(error) || undefined}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{minor !== null && minor > 0 ? formatNaira(minor, { decimals: true }) : hint ?? 'Enter an amount in Naira'}</span>
          <span className="text-subtle">Charged exactly, in kobo</span>
        </div>
      )}
    </div>
  );
}
