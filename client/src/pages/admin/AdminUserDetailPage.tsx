import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  MailCheck,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminUser, useAdjustWallet, useSetUserStatus } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatDateTime, formatNaira, formatRelative } from '@/lib/format';
import { parseNairaToMinor } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { newIdempotencyKey } from '@/lib/utils';

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: sessionUser, isAdmin } = useAuth();
  const userQuery = useAdminUser(id);
  const setStatus = useSetUserStatus();
  const adjustWallet = useAdjustWallet();

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletDirection, setWalletDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [walletReason, setWalletReason] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey('adjust'));

  const data = userQuery.data;
  const targetIsSelf = sessionUser?.id === data?.user.id;
  const canManage = isAdmin && !targetIsSelf;

  useEffect(() => {
    if (walletOpen) {
      setWalletAmount('');
      setWalletReason('');
      setWalletError(null);
      idempotencyKey.current = newIdempotencyKey('adjust');
    }
  }, [walletOpen]);

  const submitStatus = async () => {
    if (!data) return;
    setStatusError(null);
    if (statusReason.trim().length < 5) {
      setStatusError('Provide a reason of at least 5 characters.');
      return;
    }
    try {
      const next = data.user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await setStatus.mutateAsync({ id: data.user.id, status: next, reason: statusReason.trim() });
      toast.success(next === 'SUSPENDED' ? 'User suspended' : 'User reactivated');
      setStatusOpen(false);
      setStatusReason('');
    } catch (err) {
      setStatusError(getErrorMessage(err));
    }
  };

  const submitWallet = async () => {
    if (!data) return;
    setWalletError(null);
    const minor = parseNairaToMinor(walletAmount);
    if (minor === null || minor < 100) {
      setWalletError('Enter an amount of at least ₦1.');
      return;
    }
    if (walletReason.trim().length < 10) {
      setWalletError('Provide a detailed reason of at least 10 characters.');
      return;
    }
    try {
      await adjustWallet.mutateAsync({
        userId: data.user.id,
        amountMinor: minor,
        direction: walletDirection,
        reason: walletReason.trim(),
        idempotencyKey: idempotencyKey.current,
      });
      toast.success('Wallet adjustment recorded');
      setWalletOpen(false);
    } catch (err) {
      setWalletError(getErrorMessage(err));
    }
  };

  if (userQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        <Card className="space-y-4 p-6">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </Card>
      </div>
    );
  }

  if (userQuery.isError || !data) {
    return (
      <Card>
        <ErrorState
          title="User could not load"
          description="The user may not exist or the API could not be reached."
          onRetry={() => void userQuery.refetch()}
        />
      </Card>
    );
  }

  const statusCounts = data.transactionCounts;

  return (
    <>
      <Helmet>
        <title>{data.user.fullName} — SubPlug operations</title>
      </Helmet>

      <div className="mb-4">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All users
        </Link>
      </div>

      <PageHeader
        eyebrow="User detail"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.user.fullName}
            <Badge tone={data.user.role === 'ADMIN' ? 'brand' : data.user.role === 'SUPPORT' ? 'info' : 'neutral'}>
              {data.user.role}
            </Badge>
            <StatusBadge status={data.user.status} />
          </span>
        }
        description={`Joined ${formatDate(data.user.createdAt)} · Last login ${data.user.lastLoginAt ? formatDateTime(data.user.lastLoginAt) : 'never'}`}
        actions={
          <>
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWalletOpen(true)}
                disabled={targetIsSelf}
                leftIcon={<CircleDollarSign className="h-3.5 w-3.5" />}
              >
                Adjust wallet
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant={data.user.status === 'ACTIVE' ? 'outline' : 'primary'}
                size="sm"
                onClick={() => {
                  setStatusError(null);
                  setStatusReason('');
                  setStatusOpen(true);
                }}
                leftIcon={
                  data.user.status === 'ACTIVE' ? (
                    <Ban className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )
                }
              >
                {data.user.status === 'ACTIVE' ? 'Suspend user' : 'Reactivate user'}
              </Button>
            ) : null}
          </>
        }
      />

      {targetIsSelf ? (
        <Alert variant="info" className="mt-5">
          You cannot suspend or adjust your own account from this screen.
        </Alert>
      ) : null}
      {!isAdmin ? (
        <Alert variant="info" className="mt-5">
          Support access is read-only. Ask an administrator for account status and wallet adjustments.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Account" description="Customer identity and verification" />
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
              <Avatar name={data.user.fullName} size="lg" />
              <div className="flex-1">
                <DescriptionList
                  items={[
                    { label: 'Email', value: data.user.email },
                    { label: 'Phone', value: data.user.phone },
                    { label: 'User ID', value: <span className="font-mono text-xs">{data.user.id}</span>, mono: true },
                    { label: 'Referral code', value: <span className="font-mono text-xs">{data.user.referralCode}</span> },
                    {
                      label: 'Email verification',
                      value: data.user.emailVerified ? (
                        <Badge tone="success"><MailCheck className="h-3 w-3" aria-hidden="true" /> Verified</Badge>
                      ) : (
                        <Badge tone="warning">Unverified</Badge>
                      ),
                    },
                    {
                      label: 'Two-factor',
                      value: data.user.twoFactorEnabled ? (
                        <Badge tone="success"><ShieldCheck className="h-3 w-3" aria-hidden="true" /> Enabled</Badge>
                      ) : (
                        <Badge tone="neutral">Disabled</Badge>
                      ),
                    },
                  ]}
                  columns={2}
                />
                {data.user.suspensionReason ? (
                  <Alert variant="danger" title="Suspension reason" className="mt-4">
                    {data.user.suspensionReason}
                  </Alert>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent transactions"
              description="Latest ten purchases on this account"
              action={
                <Link
                  to={`/admin/transactions?userId=${data.user.id}`}
                  className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  View all
                </Link>
              }
            />
            {data.recentTransactions.length ? (
              <ul className="divide-y divide-line">
                {data.recentTransactions.map((transaction) => (
                  <li key={transaction.reference}>
                    <Link
                      to={`/admin/transactions/${transaction.reference}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-ink">{transaction.service}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-subtle">{transaction.reference}</p>
                      </div>
                      <p className="text-xs font-semibold">{formatNaira(transaction.payableMinor)}</p>
                      <StatusBadge status={transaction.status} />
                      <ChevronRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No transactions" className="py-10" />
            )}
          </Card>

          <Card>
            <CardHeader title="Recent fundings" description="Wallet funding attempts" />
            {data.recentFundings.length ? (
              <ul className="divide-y divide-line">
                {data.recentFundings.map((funding) => (
                  <li key={funding.reference} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{formatNaira(funding.amountMinor)}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-subtle">{funding.reference}</p>
                    </div>
                    <StatusBadge status={funding.status} />
                    <p className="text-[10px] text-subtle">{formatRelative(funding.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No funding attempts" className="py-10" />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">Wallet balance</p>
              <p className="mt-2 font-display text-3xl font-semibold">
                {data.wallet ? formatNaira(data.wallet.balanceMinor) : 'No wallet'}
              </p>
              <p className="mt-1 text-xs text-white/55">
                {data.wallet ? `${data.wallet.status} · ${data.wallet.currency}` : 'Wallet not created'}
              </p>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">Transaction counts</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(statusCounts).length ? (
                  Object.entries(statusCounts).map(([status, count]) => (
                    <div key={status} className="rounded-xl border border-line bg-surface p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{status.replace(/_/g, ' ')}</p>
                      <p className="mt-1 text-lg font-semibold">{count}</p>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-muted">No transactions recorded.</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Account facts" />
            <div className="p-5">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Role', value: data.user.role },
                  { label: 'Status', value: data.user.status },
                  { label: 'Created', value: formatDateTime(data.user.createdAt) },
                  { label: 'Last login', value: data.user.lastLoginAt ? formatDateTime(data.user.lastLoginAt) : 'Never' },
                ]}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/admin/transactions?userId=${data.user.id}`} className={buttonStyles('outline', 'sm')}>
                  Transactions
                </Link>
                <Link to={`/admin/fundings?userId=${data.user.id}`} className={buttonStyles('outline', 'sm')}>
                  Fundings
                </Link>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-2.5">
              <UserRound className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
              <p className="text-[11px] leading-5 text-muted">
                Actions on this page are audit-logged. Wallet adjustments create a ledger entry with an idempotency key
                and notify the customer.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-subtle">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {data.user.phone}
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={statusOpen}
        onOpenChange={(open) => {
          setStatusOpen(open);
          if (!open) setStatusError(null);
        }}
        title={data.user.status === 'ACTIVE' ? 'Suspend this user?' : 'Reactivate this user?'}
        description={
          data.user.status === 'ACTIVE'
            ? 'Suspending revokes all sessions and blocks sign-in and purchases. The reason is sent to the customer.'
            : 'The customer will be able to sign in and use their wallet again.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusOpen(false)} disabled={setStatus.isPending}>
              Cancel
            </Button>
            <Button
              variant={data.user.status === 'ACTIVE' ? 'danger' : 'primary'}
              onClick={() => void submitStatus()}
              isLoading={setStatus.isPending}
            >
              {data.user.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {statusError ? <Alert variant="danger">{statusError}</Alert> : null}
          <Textarea
            label="Reason"
            rows={3}
            placeholder="Explain the reason for this action. It will be visible to the customer."
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
          />
        </div>
      </Dialog>

      <Dialog
        open={walletOpen}
        onOpenChange={(open) => {
          setWalletOpen(open);
          if (!open) setWalletError(null);
        }}
        title="Adjust wallet balance"
        description="This creates an audited ledger entry. It is not a bank transfer."
        footer={
          <>
            <Button variant="ghost" onClick={() => setWalletOpen(false)} disabled={adjustWallet.isPending}>
              Cancel
            </Button>
            <Button
              variant={walletDirection === 'DEBIT' ? 'danger' : 'primary'}
              onClick={() => void submitWallet()}
              isLoading={adjustWallet.isPending}
            >
              Record adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {walletError ? <Alert variant="danger">{walletError}</Alert> : null}
          <Alert variant="warning">
            Debit adjustments cannot make the balance negative. Use a clear, auditable reason.
          </Alert>
          <Select
            label="Direction"
            value={walletDirection}
            onChange={(event) => setWalletDirection(event.target.value as 'CREDIT' | 'DEBIT')}
          >
            <option value="CREDIT">Credit — add money</option>
            <option value="DEBIT">Debit — remove money</option>
          </Select>
          <MoneyInput label="Amount" value={walletAmount} onChange={setWalletAmount} />
          <Textarea
            label="Reason"
            rows={3}
            placeholder="e.g. Refund for failed transaction TXN-..."
            value={walletReason}
            onChange={(event) => setWalletReason(event.target.value)}
          />
          <Input label="Idempotency key" value={idempotencyKey.current} readOnly className="font-mono text-xs" />
        </div>
      </Dialog>
    </>
  );
}
