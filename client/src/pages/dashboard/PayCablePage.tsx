import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, CircleUserRound, ShieldCheck, Tv } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/Badge';
import { SandboxNotice } from '@/components/ui/SandboxNotice';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { FormError } from '@/components/ui/FormError';
import { useCablePackages, useCableProviders, useServices, useValidateSmartcard, type MeterValidation } from '@/hooks/useCatalogue';
import { usePurchaseCable } from '@/hooks/usePurchases';
import { useWallet } from '@/hooks/useWallet';
import { cableFormSchema, type CableForm } from '@/lib/schemas';
import { formatNaira } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { newIdempotencyKey } from '@/lib/utils';
import type { Transaction } from '@/types';

export function PayCablePage() {
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validation, setValidation] = useState<MeterValidation | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey('cable'));

  const servicesQuery = useServices();
  const providersQuery = useCableProviders();
  const validateSmartcard = useValidateSmartcard();
  const purchase = usePurchaseCable();
  const walletQuery = useWallet();

  const form = useForm<CableForm>({
    resolver: zodResolver(cableFormSchema),
    defaultValues: { cableProvider: '', smartcardNumber: '', providerPlanId: '' },
  });
  const cableProvider = form.watch('cableProvider');
  const smartcardNumber = form.watch('smartcardNumber');
  const providerPlanId = form.watch('providerPlanId');
  const packagesQuery = useCablePackages(cableProvider);
  const packages = packagesQuery.data ?? [];
  const selectedPackage = packages.find((item) => item.providerPlanId === providerPlanId);

  useEffect(() => {
    setValidation(null);
    setValidationError(null);
    form.setValue('providerPlanId', '');
  }, [cableProvider, smartcardNumber, form]);

  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey('cable');
  }, [cableProvider, smartcardNumber, providerPlanId]);

  const verify = async () => {
    setValidationError(null);
    setValidation(null);
    const valid = await form.trigger(['cableProvider', 'smartcardNumber']);
    if (!valid) return;
    try {
      const result = await validateSmartcard.mutateAsync({
        cableProvider: form.getValues('cableProvider'),
        smartcardNumber: form.getValues('smartcardNumber'),
      });
      if (!(result.valid ?? result.isValid)) {
        setValidationError(result.message ?? 'This smartcard could not be validated.');
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
      setError('Verify the smartcard before paying.');
      return;
    }
    if (!selectedPackage) {
      form.setError('providerPlanId', { message: 'Choose a package' });
      return;
    }
    try {
      const transaction = await purchase.mutateAsync({
        cableProvider: values.cableProvider,
        smartcardNumber: values.smartcardNumber,
        providerPlanId: values.providerPlanId,
        idempotencyKey: idempotencyKey.current,
      });
      setReceipt(transaction);
      toast.success(transaction.duplicate ? 'This subscription was already processed' : 'Cable subscription submitted');
      setValidation(null);
      form.reset({ cableProvider: values.cableProvider, smartcardNumber: '', providerPlanId: '' });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  const providers = providersQuery.data ?? [];
  const serviceEnabled = servicesQuery.data?.services.find((service) => service.key === 'CABLE')?.enabled;

  if (serviceEnabled === false) {
    return (
      <>
        <Helmet>
          <title>Pay cable TV — SubPlug</title>
        </Helmet>
        <PageHeader
          eyebrow="Buy & pay"
          title="Pay cable TV"
          description="Cable subscriptions are temporarily paused while our backup provider is being certified."
        />
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted">
            Cable TV is not accepting new subscriptions right now. Your wallet is unaffected. Please try again later or contact support.
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
        <title>Pay cable TV — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Buy & pay"
        title="Pay cable TV"
        description="Renew or start a DStv, GOtv or Startimes subscription after confirming the smartcard."
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
              <ServiceIcon service="CABLE" />
              <div>
                <h2 className="text-base font-semibold">Subscriber details</h2>
                <p className="text-xs text-muted">Confirm the decoder number before choosing a package.</p>
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
                title="Cable providers unavailable"
                onRetry={() => void providersQuery.refetch()}
                className="py-6"
              />
            ) : (
              <Select
                label="Cable provider"
                error={form.formState.errors.cableProvider?.message}
                {...form.register('cableProvider')}
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Input
                  label="Smartcard / decoder number"
                  inputMode="numeric"
                  placeholder="e.g. 7032123456"
                  error={form.formState.errors.smartcardNumber?.message}
                  {...form.register('smartcardNumber')}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="sm:mt-[27px]"
                onClick={() => void verify()}
                isLoading={validateSmartcard.isPending}
                disabled={!cableProvider || smartcardNumber.length < 8}
              >
                Verify smartcard
              </Button>
            </div>

            {validationError ? <Alert variant="danger">{validationError}</Alert> : null}
            {validation ? (
              <div className="rounded-2xl border border-success/25 bg-success/10 p-4">
                <div className="flex items-start gap-3">
                  <CircleUserRound className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-success">{validation.customerName}</p>
                    {validation.message ? <p className="mt-1 text-[11px] text-subtle">{validation.message}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="label mb-0">Package</p>
                {packages.length > 0 ? <p className="text-[11px] text-subtle">{packages.length} packages</p> : null}
              </div>

              {!cableProvider ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-6 text-center text-xs text-muted">
                  Select a provider to load its packages.
                </div>
              ) : packagesQuery.isLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 w-full rounded-2xl" />
                  ))}
                </div>
              ) : packagesQuery.isError ? (
                <ErrorState
                  title="Packages could not load"
                  onRetry={() => void packagesQuery.refetch()}
                  className="py-6"
                />
              ) : packages.length === 0 ? (
                <EmptyState
                  icon={Tv}
                  title="No packages available"
                  description="This provider has no enabled packages right now."
                  className="py-6"
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Cable package">
                  {packages.map((pkg) => {
                    const selected = pkg.providerPlanId === providerPlanId;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          form.setValue('providerPlanId', pkg.providerPlanId, { shouldValidate: true })
                        }
                        className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/10'
                            : 'border-line bg-surface hover:border-brand-400/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{pkg.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted">{pkg.validity ?? 'Provider-defined duration'}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-brand-800 dark:text-brand-200">
                          {formatNaira(pkg.priceMinor)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
              {form.formState.errors.providerPlanId ? (
                <FormError>{form.formState.errors.providerPlanId.message}</FormError>
              ) : null}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">Package price</span>
                <span className="font-semibold">
                  {selectedPackage ? formatNaira(selectedPackage.priceMinor) : '—'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2">
                <span className="text-sm font-medium">Total to pay</span>
                <span className="text-lg font-semibold text-brand-800 dark:text-brand-200">
                  {selectedPackage ? formatNaira(selectedPackage.priceMinor) : '—'}
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
                disabled={!validation || !selectedPackage}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Pay subscription
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Tv className="h-4 w-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              Find your decoder number
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              The smartcard or decoder number is printed on the decoder, smartcard, or subscription renewal notice. Use
              the number registered with the provider.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
              Subscription timing
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              Package duration is set by the cable provider. Renewals usually start immediately or extend the current
              subscription, depending on your account.
            </p>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(receipt)}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
        title={receipt?.status === 'SUCCESSFUL' ? 'Subscription successful' : 'Subscription submitted'}
        description="The provider's confirmed result is shown on the transaction page."
        footer={
          <>
            <Link to="/dashboard/cable" className={buttonStyles('outline')}>
              Pay another subscription
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
                  <p className="text-sm font-semibold">{receipt.plan?.name ?? 'Cable subscription'}</p>
                  <p className="text-xs text-muted">
                    {receipt.recipient.cableProvider} · {receipt.recipient.smartcardNumber}
                  </p>
                </div>
              </div>
              <StatusBadge status={receipt.status} />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Paid</dt>
                <dd className="font-semibold">{formatNaira(receipt.payableMinor)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Customer</dt>
                <dd className="font-medium">{receipt.fulfillment.customerName ?? validation?.customerName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Reference</dt>
                <dd className="font-mono text-xs">{receipt.reference}</dd>
              </div>
            </dl>
            {receipt.duplicate ? <Alert variant="info">This was an idempotent retry; no second debit was made.</Alert> : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
