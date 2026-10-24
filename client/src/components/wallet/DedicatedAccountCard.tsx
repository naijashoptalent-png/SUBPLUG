import { useState } from 'react';
import { Building2, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { CopyButton } from '@/components/ui/CopyButton';
import { useCreateVirtualAccount, useVirtualAccount } from '@/hooks/useWallet';
import { getErrorMessage } from '@/lib/errors';

export function DedicatedAccountCard() {
  const accountQuery = useVirtualAccount();
  const createAccount = useCreateVirtualAccount();
  const [nin, setNin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = nin.trim();
    if (!/^[1-9]\d{10}$/.test(value)) {
      setError('Enter your 11-digit NIN.');
      return;
    }
    setError(null);
    try {
      await createAccount.mutateAsync(value);
      setNin('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const account = accountQuery.data;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Dedicated funding account"
        description="Fund your wallet by bank transfer using your personal Flutterwave account number."
      />
      <div className="border-t border-line p-5 sm:p-6">
        {accountQuery.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-surface" />
        ) : account?.status === 'ACTIVE' && account.accountNumber ? (
          <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{account.bankName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xl font-semibold tracking-wide text-ink">{account.accountNumber}</p>
                  <CopyButton value={account.accountNumber} label="Copy account number" />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">Transfer any amount to this account. Your wallet is credited only after Flutterwave confirms the transfer.</p>
              </div>
            </div>
          </div>
        ) : account?.status === 'PENDING' ? (
          <p className="text-sm text-muted">Your dedicated account is being created. Refresh this page shortly.</p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="max-w-md">
            <div className="flex items-start gap-3 text-sm text-muted">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
              <p>Enter your NIN to receive a permanent account number. Your NIN is sent securely to Flutterwave to create the account and is not stored by SubPlug.</p>
            </div>
            <Input
              className="mt-4"
              label="National Identification Number (NIN)"
              value={nin}
              onChange={(event) => setNin(event.target.value.replace(/\D/g, '').slice(0, 11))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="11-digit NIN"
              error={error ?? undefined}
              required
            />
            <Button type="submit" className="mt-4" isLoading={createAccount.isPending}>
              Get dedicated account
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
