import { useState } from 'react';
import { Banknote, MessageCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { Input } from '@/components/ui/Field';
import { useCreateManualFunding, useManualFundingSettings } from '@/hooks/useWallet';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { getErrorMessage } from '@/lib/errors';
import { formatNaira, parseNairaToMinor } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/utils';

function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : undefined;
}

export function ManualFundingCard({
  embedded = false,
  amountMinor,
}: {
  embedded?: boolean;
  amountMinor?: number | null;
}) {
  const { settings } = usePublicSettings();
  const manualQuery = useManualFundingSettings();
  const manual = manualQuery.data;
  const createRequest = useCreateManualFunding();
  const [amount, setAmount] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderBank, setSenderBank] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [requestReference, setRequestReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (manualQuery.isLoading) {
    return (
      <Card className={embedded ? 'space-y-3 p-5' : 'mt-6 space-y-3 p-5'} aria-label="Loading manual transfer details">
        <div className="h-5 w-48 animate-pulse rounded bg-surface" />
        <div className="h-4 w-full animate-pulse rounded bg-surface" />
        <div className="h-16 w-full animate-pulse rounded-2xl bg-surface" />
      </Card>
    );
  }
  if (manualQuery.isError) {
    return (
      <Card className={embedded ? 'p-5' : 'mt-6 p-5'}>
        <Alert variant="danger" title="Manual transfer details could not load">
          Try again later, or contact support before transferring money.
        </Alert>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => void manualQuery.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!manual?.enabled) {
    return (
      <Card className={embedded ? 'p-5' : 'mt-6 p-5'}>
        <CardHeader
          title="Manual bank transfer"
          description="Bank-transfer wallet funding is not available right now. Please contact support for help."
        />
        <a
          href="/dashboard/support"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-ink hover:bg-surface"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Contact support
        </a>
      </Card>
    );
  }

  const minor = amountMinor === undefined ? parseNairaToMinor(amount) : amountMinor;
  const contactMessage = requestReference
    ? `I made a manual wallet transfer. Request reference: ${requestReference}. Transfer reference: ${transferReference}. Amount: ${amount} NGN.`
    : 'I need help with a manual wallet transfer.';
  const whatsapp = whatsappUrl(settings.support.whatsapp, contactMessage);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (minor === null || minor < 10000) {
      setError('Enter at least ₦100.');
      return;
    }
    try {
      const result = await createRequest.mutateAsync({
        amountMinor: minor,
        senderName,
        senderBank,
        transferReference,
        idempotencyKey: newIdempotencyKey('manual-fund'),
      });
      setRequestReference(result.reference);
      toast.success('Transfer details submitted for review');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  return (
    <Card className={embedded ? '' : 'mt-6'}>
      {!embedded ? (
        <CardHeader
          title="Fund by bank transfer"
          description="Transfer to the account below, then submit your transfer details. Your wallet is credited after verification."
        />
      ) : null}
      <div className="space-y-5 p-5 sm:p-6">
        {embedded ? (
          <p className="text-sm leading-6 text-muted">
            Transfer to this account, then submit your transfer details. Your wallet is credited after verification.
          </p>
        ) : null}
        <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Bank</p>
            <p className="mt-1 text-sm font-semibold text-ink">{manual.bankName}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Account name</p>
            <p className="mt-1 text-sm font-semibold text-ink">{manual.accountName}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Account number</p>
            <p className="mt-1 flex items-center gap-2 font-mono text-sm font-semibold text-ink">
              {manual.accountNumber}
              <CopyButton value={manual.accountNumber} />
            </p>
          </div>
        </div>

        {manual.instructions ? <p className="text-sm leading-6 text-muted">{manual.instructions}</p> : null}
        {minor && minor > 0 ? (
          <p className="text-sm font-semibold text-ink">Amount to transfer: {formatNaira(minor)}</p>
        ) : null}
        <Alert variant="warning" title="Do not submit until you have transferred">
          Submitting a request does not move money automatically. Keep your bank transfer receipt; an administrator will
          check the transfer before crediting your wallet.
        </Alert>

        {requestReference ? (
          <Alert variant="success" title="Transfer request submitted">
            Request <span className="font-mono font-semibold">{requestReference}</span> is pending verification. You can
            contact support with this reference.
          </Alert>
        ) : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}

        {requestReference ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRequestReference(null);
              setAmount('');
              setSenderName('');
              setSenderBank('');
              setTransferReference('');
              setError(null);
            }}
          >
            Submit another transfer
          </Button>
        ) : null}

        {!requestReference ? (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
            {amountMinor === undefined ? (
              <Input
                label="Amount transferred (₦)"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="5,000"
                required
              />
            ) : null}
            <Input
              label="Name on sending bank account"
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              autoComplete="name"
              required
            />
            <Input
              label="Sending bank"
              value={senderBank}
              onChange={(event) => setSenderBank(event.target.value)}
              required
            />
            <Input
              label="Bank transfer reference"
              value={transferReference}
              onChange={(event) => setTransferReference(event.target.value)}
              required
            />
            <Button
              type="submit"
              className="sm:col-span-2 sm:justify-self-start"
              isLoading={createRequest.isPending}
              leftIcon={<Banknote className="h-4 w-4" />}
            >
              I have made the transfer
            </Button>
          </form>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-ink hover:bg-surface"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Contact on WhatsApp
            </a>
          ) : null}
          <a
            href="/dashboard/support"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-ink hover:bg-surface"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Contact support
          </a>
          {requestReference ? (
            <span className="self-center text-xs text-muted">
              Transfer amount: {formatNaira(minor ?? 0)}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
