import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  errorId?: string;
  hintId?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  errorId,
  hintId,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <div id={hintId} className="hint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leading, trailing, className, containerClassName, id, required, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
      errorId={`${inputId}-error`}
      hintId={`${inputId}-hint`}
    >
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn('field', leading && 'pl-10', trailing && 'pr-11', error && 'field-error', className)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          required={required}
          {...props}
        />
        {trailing ? <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </div>
    </Field>
  );
});

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'trailing'> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      className={cn('pr-11', className)}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      }
      {...props}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, containerClassName, id, required, children, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;
  return (
    <Field
      label={label}
      htmlFor={selectId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
      errorId={`${selectId}-error`}
      hintId={`${selectId}-hint`}
    >
      <select
        ref={ref}
        id={selectId}
        className={cn('field appearance-none bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10', error && 'field-error', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%23808f8c' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        required={required}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, containerClassName, id, required, ...props },
  ref
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const describedBy = error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined;
  return (
    <Field
      label={label}
      htmlFor={textareaId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
      errorId={`${textareaId}-error`}
      hintId={`${textareaId}-hint`}
    >
      <textarea
        ref={ref}
        id={textareaId}
        className={cn('field min-h-[110px] resize-y', error && 'field-error', className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        required={required}
        {...props}
      />
    </Field>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }>(
  function Checkbox({ label, error, className, ...props }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand-700 accent-brand-700 focus:ring-brand-500"
          {...props}
        />
        <label htmlFor={id} className="text-sm leading-5 text-muted">
          {label}
        </label>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
  }
);
