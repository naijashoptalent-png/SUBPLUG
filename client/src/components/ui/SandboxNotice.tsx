import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { cn } from '@/lib/utils';

export function SandboxNotice({ className }: { className?: string }) {
  const { settings } = usePublicSettings();
  const { paymentSandbox, vtuSandbox } = settings.environment;
  if (!paymentSandbox && !vtuSandbox) return null;

  let message: ReactNode;
  if (paymentSandbox && vtuSandbox) {
    message = (
      <>
        <span className="font-semibold">Sandbox environment.</span> No real money moves and no real airtime or
        electricity is delivered. Use the mock payment controls to complete test transactions.
      </>
    );
  } else if (vtuSandbox) {
    message = (
      <>
        <span className="font-semibold">Sandbox VTU provider.</span> Purchases are simulated and no real airtime, data,
        electricity or cable service is delivered.
      </>
    );
  } else {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning',
        className
      )}
      role="note"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function SandboxBadge({ className }: { className?: string }) {
  const { settings } = usePublicSettings();
  const { paymentSandbox, vtuSandbox } = settings.environment;
  if (!paymentSandbox && !vtuSandbox) return null;
  const label = paymentSandbox && vtuSandbox ? 'Sandbox' : vtuSandbox ? 'Test VTU' : 'Test funding';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning',
        className
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
