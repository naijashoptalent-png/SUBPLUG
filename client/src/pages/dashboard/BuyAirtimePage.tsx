import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Phone, ReceiptText, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/Badge';
import { SandboxNotice } from '@/components/ui/SandboxNotice';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { FormError } from '@/components/ui/FormError';
import { useAirtimeQuote } from '@/hooks/useCatalogue';
import { usePurchaseAirtime } from '@/hooks/usePurchases';
import { useWallet } from '@/hooks/useWallet';
import { airtimeFormSchema, type AirtimeForm } from '@/lib/schemas';
import { formatNaira, parseNairaToMinor } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { newIdempotencyKey } from '@/lib/utils';
import type { Transaction } from '@/types';

const networks = [
  { code: 'MTN', label: 'MTN', accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  { code: 'AIRTEL', label: 'Airtel', accent: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  { code: 'GLO', label: 'Glo', accent: 'text-green-700 dark:text-green-400', bg: 'bg-green-500/10' },
  { code: '9MOBILE', label: '9mobile', accent: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
] as const;

const presets = [100, 200, 500, 1000, 2000, 5000];

export function BuyAirtimePage() {
  const walletQuery = useWallet();
  const purchase = usePurchaseAirtime();
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey('air'));

  const form = useForm<AirtimeForm>({
    resolver: zodResolver(airtimeFormSchema),
    defaultValues: { network: 'MTN', phone: '', amount: '' },
  });

  const network = form.watch('network');
  const phone = form.watch('phone');
  const amount = form.watch('amount');
  const amountMinor = parseNairaToMinor(amount) ?? 0;
  const quoteQuery = useAirtimeQuote(network, amountMinor);

  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey('air');
  }, [network, phone, amount]);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const transaction = await purchase.mutateAsync({
        network: values.network,
        phone: values.phone,
        amountMinor: parseNairaToMinor(values.amount) ?? 0,
        idempotencyKey: idempotencyKey.current,
      });
      setReceipt(transaction);
      toast.success(transaction.duplicate ? 'This purchase was already processed' : 'Airtime purchase submitted');
      form.reset({ network: values.network, phone: values.phone, amount: '' });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  const quote = quoteQuery.data;
  const balance = walletQuery.data?.wallet.balanceMinor;

  return (
    <>
      <Helmet>
        <title>Buy airtime — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Buy & pay"
        title="Buy airtime"
        description="Top up any Nigerian network. Airtime discounts are applied to the amount debited from your wallet."
        actions={
          <Link to="/dashboard/transactions" className={buttonStyles('outline', 'sm')}>
            <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
            History
          </Link>
        }
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <ServiceIcon service="AIRTIME" />
              <div>
                <h2 className="text-base font-semibold">Airtime details</h2>
                <p className="text-xs text-muted">Enter the number and amount to top up.</p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5 sm:p-6" noValidate>
            <SandboxNotice />
            {error ? <Alert variant="danger">{error}</Alert> : null}

            <div>
              <p className="label">Network</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Mobile network">
                {networks.map((item) => {
                  const selected = network === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => form.setValue('network', item.code, { shouldValidate: true })}
                      className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/10'
                          : 'border-line bg-surface hover:border-brand-400/50'
                      }`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${item.bg} ${item.accent}`}>
                        <Phone className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              {form.formState.errors.network ? <FormError>{form.formState.errors.network.message}</FormError> : null}
            </div>

            <Input
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0801 234 5678"
              error={form.formState.errors.phone?.message}
              {...form.register('phone')}
            />

            <div>
              <Controller
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <MoneyInput
                    label="Amount"
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    error={form.formState.errors.amount?.message}
                    hint="Minimum ₦50. You pay the discounted price shown below."
                  />
                )}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => form.setValue('amount', String(preset), { shouldValidate: true })}
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-brand-400/50 hover:text-ink"
                  >
                    ₦{preset.toLocaleString('en-NG')}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">Face value</span>
                <span className="font-semibold">{formatNaira(amountMinor)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">
                  Discount {quote ? `(${quote.discountPercent}%)` : ''}
                </span>
                <span className="font-semibold text-success">
                  {quote ? `− ${formatNaira(quote.discountMinor)}` : '—'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
                <span className="font-medium text-ink">You pay</span>
                <span className="text-lg font-semibold text-brand-800 dark:text-brand-200">
                  {quote ? formatNaira(quote.payableMinor) : '—'}
                </span>
              </div>
              {quoteQuery.isError ? (
                <p className="mt-2 text-xs text-danger">{getErrorMessage(quoteQuery.error)}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-muted">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                Balance: {balance === undefined ? '—' : formatNaira(balance)}
              </p>
              <Button
                type="submit"
                size="lg"
                isLoading={purchase.isPending}
                disabled={quoteQuery.isError}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Pay and top up
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Before you pay</h2>
            <ul className="mt-3 space-y-3 text-xs leading-6 text-muted">
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                Check the number carefully. Airtime delivered to a wrong number cannot be recalled.
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                We debit your wallet before sending to the provider. Failed orders are refunded to your ledger.
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                Keep the reference. Support can trace your order end-to-end with it.
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Need a different amount?</p>
            <p className="mt-2 text-sm text-muted">
              Airtime can be any whole Naira amount within your limits. Data bundles have fixed plans and are often
              better value for larger usage.
            </p>
            <Link to="/dashboard/data" className={buttonStyles('outline', 'sm', 'mt-4')}>
              Browse data plans
            </Link>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(receipt)}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
        title={receipt?.status === 'SUCCESSFUL' ? 'Airtime delivered' : 'Purchase submitted'}
        description="This is the current server status. Pending orders refresh on the transaction page."
        footer={
          <>
            <Link to="/dashboard/airtime" className={buttonStyles('outline')}>
              Buy again
            </Link>
            {receipt ? (
              <Link to={`/dashboard/transactions/${receipt.reference}`} className={buttonStyles('primary')}>
                View receipt
              </Link>
            ) : null}
          </>
        }
      >
        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{formatNaira(receipt.payableMinor)}</p>
                  <p className="text-xs text-muted">{receipt.recipient.phone}</p>
                </div>
              </div>
              <StatusBadge status={receipt.status} />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Network</dt>
                <dd className="font-medium">{receipt.recipient.network}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Face value</dt>
                <dd className="font-medium">{formatNaira(receipt.amountMinor)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Reference</dt>
                <dd className="font-mono text-xs">{receipt.reference}</dd>
              </div>
            </dl>
            {receipt.duplicate ? (
              <Alert variant="info">
                This request matched an earlier purchase, so the original result was returned instead of charging twice.
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
