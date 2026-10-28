import { useState } from 'react';
import { Building2, Landmark, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
    <Card className="relative overflow-hidden border-brand-500/20 bg-gradient-to-r from-brand-500/[0.08] via-raised to-raised">
      <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full border border-brand-500/10" aria-hidden="true" />
      <div className="relative p-4 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-700 dark:text-brand-300">
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Dedicated funding account</h2>
              <p className="mt-0.5 text-xs text-muted">Your personal Flutterwave bank-transfer details</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Secure
          </span>
        </div>

        <div className="mt-4 border-t border-line/70 pt-4">
        {accountQuery.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-surface" />
        ) : account?.status === 'ACTIVE' && account.accountNumber ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-raised text-brand-700 shadow-sm dark:text-brand-300">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{account.bankName}</p>
                <p className="mt-0.5 font-mono text-lg font-semibold tracking-[0.08em] text-ink sm:text-xl">{account.accountNumber}</p>
              </div>
            </div>
            <CopyButton value={account.accountNumber} label="Copy number" className="self-start sm:self-auto" />
          </div>
        ) : account?.status === 'PENDING' ? (
          <p className="text-sm text-muted">Your dedicated account is being created. Refresh this page shortly.</p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
            <p className="text-xs leading-5 text-muted">Enter your NIN once to receive a permanent Flutterwave account number. It is securely sent to Flutterwave and never stored by SubPlug.</p>
            <Input
              label="NIN"
              value={nin}
              onChange={(event) => setNin(event.target.value.replace(/\D/g, '').slice(0, 11))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="11-digit NIN"
              error={error ?? undefined}
              required
            />
            <Button type="submit" isLoading={createAccount.isPending}>
              Create account
            </Button>
          </form>
        )}
        </div>
        {account?.status === 'ACTIVE' && account.accountNumber ? (
          <p className="mt-3 text-[11px] text-muted">Transfer any amount to this account. Your wallet is credited after Flutterwave confirms the transfer.</p>
        ) : null}
      </div>
    </Card>
  );
}
