import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { copyText } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await copyText(value);
          setCopied(true);
          toast.success('Copied to clipboard');
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error('Could not copy. Select the text and copy manually.');
        }
      }}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-xs font-medium text-muted transition hover:border-brand-400/50 hover:text-ink',
        className
      )}
      aria-label={`${label} ${value}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
