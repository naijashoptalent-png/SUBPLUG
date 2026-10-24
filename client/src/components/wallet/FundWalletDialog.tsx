import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CreditCard, Wallet } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { useInitializeFunding } from '@/hooks/useWallet';
import { newIdempotencyKey, cn } from '@/lib/utils';
import { parseNairaToMinor } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { useManualFundingSettings } from '@/hooks/useWallet';
import { ManualFundingCard } from '@/components/wallet/ManualFundingCard';

const presets = [1000, 2000, 5000, 10000, 20000];

export function FundWalletDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState('');
  const [gateway, setGateway] = useState('');
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey('fund'));
  const initialize = useInitializeFunding();
  const manualFundingQuery = useManualFundingSettings();
  const { settings } = usePublicSettings();
  const methods = settings.environment.paymentMethods;
  const paymentChoices = [
    ...methods,
    ...(manualFundingQuery.data?.enabled
      ? [{ key: 'manual', name: 'Bank transfer', isSandbox: false }]
      : []),
  ];
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setError(null);
    idempotencyKey.current = newIdempotencyKey('fund');
  }, [open]);

  // Keep the selected method valid when settings load or the offered methods change.
  useEffect(() => {
    if (!open) return;
    setGateway((current) =>
      paymentChoices.some((method) => method.key === current) ? current : paymentChoices[0]?.key ?? ''
    );
  }, [open, methods, manualFundingQuery.data]);

  const updateAmount = (value: string) => {
    setAmount(value);
    idempotencyKey.current = newIdempotencyKey('fund');
    setError(null);
  };

  const updateGateway = (key: string) => {
    setGateway(key);
    // The gateway is part of the idempotency request hash.
    idempotencyKey.current = newIdempotencyKey('fund');
    setError(null);
  };

  const minor = parseNairaToMinor(amount);
  const selectedMethod = methods.find((method) => method.key === gateway);
  const isManualFunding = gateway === 'manual' && manualFundingQuery.data?.enabled === true;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!gateway) {
      setError('Choose a payment method to continue.');
      return;
    }
    if (minor === null || minor < 10000) {
      setError('Enter at least ₦100 to fund your wallet.');
      return;
    }
    try {
      const result = await initialize.mutateAsync({
        amountMinor: minor,
        idempotencyKey: idempotencyKey.current,
        gateway,
      });
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
      size="lg"
      title="Fund your wallet"
      description={
        isManualFunding
          ? 'Transfer to the configured bank account and submit your details for verification.'
          : 'Choose an amount and payment method. You’ll complete payment on the gateway’s secure checkout.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={initialize.isPending}>
            Cancel
          </Button>
          {!isManualFunding ? (
            <Button
              type="submit"
              form="fund-wallet-form"
              isLoading={initialize.isPending}
              disabled={!gateway || !selectedMethod}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue to payment
            </Button>
          ) : null}
        </>
      }
    >
      <form
        id="fund-wallet-form"
        onSubmit={isManualFunding ? (event) => event.preventDefault() : handleSubmit}
        className="space-y-6"
        noValidate
      >
        {error ? <Alert variant="danger">{error}</Alert> : null}

        {paymentChoices.length === 0 && !manualFundingQuery.isLoading ? (
          <Alert variant="warning" title="Wallet funding is unavailable">
            No payment method is configured right now. Please try again later or contact support.
          </Alert>
        ) : null}

        <MoneyInput
          label="Amount to add"
          value={amount}
          onChange={updateAmount}
          placeholder="5,000"
          hint="Minimum ₦100. Maximum and daily limits apply."
          autoFocus
        />

        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Quick amounts</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => updateAmount(String(preset))}
                className={cn(
                  'min-h-10 rounded-xl border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  minor === preset * 100
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                    : 'border-line bg-surface text-muted hover:border-brand-400/50 hover:text-ink'
                )}
              >
                ₦{preset.toLocaleString('en-NG')}
              </button>
            ))}
          </div>
        </div>

        {paymentChoices.length > 1 || paymentChoices.some((method) => method.key === 'manual') ? (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              Payment method
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {paymentChoices.map((method) => {
                const selected = gateway === method.key;
                return (
                  <label
                    key={method.key}
                    className={cn(
                      'flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition focus-within:ring-2 focus-within:ring-brand-500 sm:px-3.5',
                      selected
                        ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/30'
                        : 'border-line bg-surface hover:border-brand-400/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={method.key}
                      checked={selected}
                      onChange={() => updateGateway(method.key)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                        selected ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'bg-raised text-muted'
                      )}
                    >
                      {method.key === 'manual' ? (
                        <Wallet className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <CreditCard className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">{method.name}</span>
                      {method.key === 'manual' ? (
                        <span className="mt-0.5 block text-[10px] text-muted">Transfer to the account shown below</span>
                      ) : method.isSandbox ? (
                        <span className="mt-1 inline-flex">
                          <Badge tone="warning">Test mode</Badge>
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-[10px] text-muted">Secure hosted checkout</span>
                      )}
                    </span>
                    {selected ? <Check className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" /> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : selectedMethod ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Payment method</p>
              <p className="truncate text-sm font-semibold text-ink">{selectedMethod.name}</p>
            </div>
            {selectedMethod.isSandbox ? <Badge tone="warning">Test mode</Badge> : null}
          </div>
        ) : null}

        {!isManualFunding ? <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-2.5">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <p className="text-xs leading-6 text-muted">
              Your wallet is credited only after the gateway result is verified. Returning to SubPlug does not credit
              the balance by itself. If wallet funding is in test mode, the next page lets you approve or fail the test payment.
            </p>
          </div>
        </div> : null}
      </form>
      {isManualFunding ? (
        <div className="border-t border-line bg-surface/30 p-3 sm:p-5">
          <ManualFundingCard embedded amountMinor={minor} />
        </div>
      ) : null}
    </Dialog>
  );
}
