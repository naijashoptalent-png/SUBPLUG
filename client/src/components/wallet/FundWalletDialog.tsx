import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Wallet } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useInitializeFunding } from '@/hooks/useWallet';
import { newIdempotencyKey } from '@/lib/utils';
import { parseNairaToMinor } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

const presets = [1000, 2000, 5000, 10000, 20000];

export function FundWalletDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey('fund'));
  const initialize = useInitializeFunding();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setAmount('');
      setError(null);
      idempotencyKey.current = newIdempotencyKey('fund');
    }
  }, [open]);

  const updateAmount = (value: string) => {
    setAmount(value);
    idempotencyKey.current = newIdempotencyKey('fund');
    setError(null);
  };

  const minor = parseNairaToMinor(amount);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (minor === null || minor < 10000) {
      setError('Enter at least ₦100 to fund your wallet.');
      return;
    }
    try {
      const result = await initialize.mutateAsync({ amountMinor: minor, idempotencyKey: idempotencyKey.current });
      if (!result.authorizationUrl) {
        setError('The payment gateway did not return a checkout URL. Please try again.');
        return;
      }
      const url = new URL(result.authorizationUrl, window.location.origin);
      onOpenChange(false);
      if (url.origin === window.location.origin) {
        navigate(`${url.pathname}${url.search}`);
      } else {
        window.location.assign(url.toString());
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Fund your wallet"
      description="Choose an amount. You’ll complete payment on the configured gateway."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={initialize.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="fund-wallet-form"
            isLoading={initialize.isPending}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Continue to payment
          </Button>
        </>
      }
    >
      <form id="fund-wallet-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <MoneyInput
          label="Amount to add"
          value={amount}
          onChange={updateAmount}
          placeholder="5,000"
          hint="Minimum ₦100. Maximum and daily limits apply."
          autoFocus
        />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Quick amounts</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => updateAmount(String(preset))}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted transition hover:border-brand-400/50 hover:text-ink"
              >
                ₦{preset.toLocaleString('en-NG')}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-2.5">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <p className="text-xs leading-6 text-muted">
              Your wallet is credited only after the gateway result is verified. Returning to SubPlug does not credit
              the balance by itself. If you are in sandbox mode, the next page lets you approve or fail the test payment.
            </p>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
