import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, CircleUserRound, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/Badge';
import { SandboxNotice } from '@/components/ui/SandboxNotice';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { CopyButton } from '@/components/ui/CopyButton';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useElectricityProviders, useServices, useValidateMeter, type MeterValidation } from '@/hooks/useCatalogue';
import { usePurchaseElectricity } from '@/hooks/usePurchases';
import { useWallet } from '@/hooks/useWallet';
import { electricityFormSchema, type ElectricityForm } from '@/lib/schemas';
import { formatNaira, parseNairaToMinor } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { newIdempotencyKey } from '@/lib/utils';
import type { Transaction } from '@/types';

const amountPresets = [1000, 2000, 5000, 10000, 20000];

export function PayElectricityPage() {
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validation, setValidation] = useState<MeterValidation | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey('elec'));

  const servicesQuery = useServices();
  const providersQuery = useElectricityProviders();
  const validateMeter = useValidateMeter();
  const purchase = usePurchaseElectricity();
  const walletQuery = useWallet();

  const form = useForm<ElectricityForm>({
    resolver: zodResolver(electricityFormSchema),
    defaultValues: { disco: '', meterNumber: '', meterType: 'PREPAID', amount: '' },
  });
  const disco = form.watch('disco');
  const meterNumber = form.watch('meterNumber');
  const meterType = form.watch('meterType');
  const amount = form.watch('amount');
  const amountMinor = parseNairaToMinor(amount) ?? 0;
  const feeMinor = providersQuery.data?.feeMinor ?? 0;

  useEffect(() => {
    setValidation(null);
    setValidationError(null);
  }, [disco, meterNumber, meterType]);

  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey('elec');
  }, [disco, meterNumber, meterType, amount]);

  const verify = async () => {
    setValidationError(null);
    setValidation(null);
    const valid = await form.trigger(['disco', 'meterNumber', 'meterType']);
    if (!valid) return;
    try {
      const result = await validateMeter.mutateAsync({
        disco: form.getValues('disco'),
        meterNumber: form.getValues('meterNumber'),
        meterType: form.getValues('meterType'),
      });
      if (!(result.valid ?? result.isValid)) {
        setValidationError(result.message ?? 'This meter could not be validated.');
        return;
      }
      setValidation(result);
    } catch (err) {
      setValidationError(getErrorMessage(err));
    }
  };

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    if (!validation) {
      setError('Verify the meter before paying so we can confirm the customer name.');
      return;
    }
    try {
      const transaction = await purchase.mutateAsync({
        disco: values.disco,
        meterNumber: values.meterNumber,
        meterType: values.meterType,
        amountMinor: parseNairaToMinor(values.amount) ?? 0,
        idempotencyKey: idempotencyKey.current,
      });
      setReceipt(transaction);
      toast.success(transaction.duplicate ? 'This payment was already processed' : 'Electricity payment submitted');
      setValidation(null);
      form.reset({ disco: values.disco, meterNumber: '', meterType: values.meterType, amount: '' });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  const providers = providersQuery.data?.providers ?? [];
  const serviceEnabled = servicesQuery.data?.services.find((service) => service.key === 'ELECTRICITY')?.enabled;

  if (serviceEnabled === false) {
    return (
      <>
        <Helmet>
          <title>Pay electricity — SubPlug</title>
        </Helmet>
        <PageHeader
          eyebrow="Buy & pay"
          title="Pay electricity"
          description="Prepaid and postpaid electricity payments are temporarily paused while our backup provider is being certified."
        />
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted">
            Electricity is not accepting new payments right now. Your wallet is unaffected. Please try again later or contact support.
          </p>
          <Link to="/dashboard" className={buttonStyles('outline', 'sm', 'mt-4')}>
            Back to dashboard
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Pay electricity — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Buy & pay"
        title="Pay electricity"
        description="Buy prepaid units or settle postpaid bills after confirming the meter details with the provider."
        actions={
          <Link to="/dashboard/transactions" className={buttonStyles('outline', 'sm')}>
            History
          </Link>
        }
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <ServiceIcon service="ELECTRICITY" />
              <div>
                <h2 className="text-base font-semibold">Meter details</h2>
                <p className="text-xs text-muted">Verify your meter to see the registered customer.</p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5 sm:p-6" noValidate>
            <SandboxNotice />
            {error ? <Alert variant="danger">{error}</Alert> : null}

            {providersQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : providersQuery.isError ? (
              <ErrorState
                title="Providers unavailable"
                description="We could not load the electricity providers."
                onRetry={() => void providersQuery.refetch()}
                className="py-6"
              />
            ) : (
              <Select
                label="Distribution company"
                error={form.formState.errors.disco?.message}
                {...form.register('disco')}
              >
                <option value="">Choose a provider</option>
                {providers.map((provider) => (
                  <option key={provider.code} value={provider.code}>
                    {provider.name}
                    {provider.isSandbox ? ' (sandbox)' : ''}
                  </option>
                ))}
              </Select>
            )}

            <div>
              <p className="label">Meter type</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Meter type">
                {(['PREPAID', 'POSTPAID'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={meterType === type}
                    onClick={() => form.setValue('meterType', type, { shouldValidate: true })}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold capitalize transition ${
                      meterType === type
                        ? 'border-brand-500 bg-brand-500/10 text-brand-800 dark:text-brand-200'
                        : 'border-line bg-surface text-muted hover:border-brand-400/50'
                    }`}
                  >
                    {type.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Input
                  label="Meter number"
                  inputMode="numeric"
                  placeholder="e.g. 04123456789"
                  error={form.formState.errors.meterNumber?.message}
                  {...form.register('meterNumber')}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="sm:mt-[27px]"
                onClick={() => void verify()}
                isLoading={validateMeter.isPending}
                disabled={!disco || meterNumber.length < 10}
              >
                Verify meter
              </Button>
            </div>

            {validationError ? <Alert variant="danger">{validationError}</Alert> : null}
            {validation ? (
              <div className="rounded-2xl border border-success/25 bg-success/10 p-4">
                <div className="flex items-start gap-3">
                  <CircleUserRound className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-success">{validation.customerName}</p>
                    {validation.customerAddress ? (
                      <p className="mt-0.5 text-xs text-muted">{validation.customerAddress}</p>
                    ) : null}
                    {validation.message ? <p className="mt-1 text-[11px] text-subtle">{validation.message}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

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
                    hint="Minimum ₦500. Prepaid meters receive a token after payment."
                  />
                )}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {amountPresets.map((preset) => (
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
                <span className="text-muted">Meter value</span>
                <span className="font-semibold">{formatNaira(amountMinor)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">Service fee</span>
                <span className="font-semibold">{formatNaira(feeMinor)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
                <span className="font-medium">Total to pay</span>
                <span className="text-lg font-semibold text-brand-800 dark:text-brand-200">
                  {formatNaira(amountMinor + feeMinor)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                Wallet: {walletQuery.data ? formatNaira(walletQuery.data.wallet.balanceMinor) : '—'}
              </p>
              <Button
                type="submit"
                size="lg"
                isLoading={purchase.isPending}
                disabled={!validation}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Pay electricity bill
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
              Prepaid vs postpaid
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              Prepaid meters receive a token that you enter on the meter. Postpaid payments settle an outstanding bill.
              The provider determines what is available for your meter.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
              Keep your token safe
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              Your token appears in the transaction receipt and remains available from transaction history. Never share
              it with someone you do not trust.
            </p>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(receipt)}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
        title={receipt?.status === 'SUCCESSFUL' ? 'Electricity payment successful' : 'Payment submitted'}
        description="Keep the token and reference for your records."
        size="lg"
        footer={
          <>
            <Link to="/dashboard/electricity" className={buttonStyles('outline')}>
              Pay another bill
            </Link>
            {receipt ? (
              <Link to={`/dashboard/transactions/${receipt.reference}`} className={buttonStyles('primary')}>
                View transaction
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
                  <p className="text-xs text-muted">
                    {receipt.recipient.disco} · {receipt.recipient.meterNumber}
                  </p>
                </div>
              </div>
              <StatusBadge status={receipt.status} />
            </div>

            {receipt.fulfillment.token ? (
              <div className="rounded-2xl border border-brand-500/25 bg-brand-500/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-800 dark:text-brand-200">
                    Prepaid token
                  </p>
                  <CopyButton value={receipt.fulfillment.token} />
                </div>
                <p className="mt-2 break-all font-mono text-lg font-semibold text-brand-950 dark:text-brand-100">
                  {receipt.fulfillment.token}
                </p>
                {receipt.fulfillment.units ? (
                  <p className="mt-1 text-xs text-muted">{receipt.fulfillment.units} units</p>
                ) : null}
              </div>
            ) : receipt.status === 'PENDING' || receipt.status === 'PROCESSING' ? (
              <Alert variant="warning">
                The token will appear here and on the transaction page when the provider confirms delivery.
              </Alert>
            ) : null}

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Customer</dt>
                <dd className="font-medium">{receipt.fulfillment.customerName ?? validation?.customerName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Reference</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono text-xs">{receipt.reference}</span>
                  <CopyButton value={receipt.reference} label="" />
                </dd>
              </div>
            </dl>

            {receipt.isSandbox ? (
              <Alert variant="warning" title="Sandbox token">
                This token is test data and will not work on a real meter.
              </Alert>
            ) : null}
            {receipt.duplicate ? <Alert variant="info">This was an idempotent retry; no second debit was made.</Alert> : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
