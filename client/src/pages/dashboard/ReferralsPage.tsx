import { Helmet } from 'react-helmet-async';
import { CheckCircle2, Clock3, Gift, Link2, Share2, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { CopyButton } from '@/components/ui/CopyButton';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useReferrals } from '@/hooks/useReferrals';
import { formatDate, formatNaira } from '@/lib/format';

const statusTone = {
  PENDING: 'warning',
  QUALIFIED: 'info',
  REWARDED: 'success',
  REJECTED: 'neutral',
} as const;

export function ReferralsPage() {
  const referralsQuery = useReferrals();
  const data = referralsQuery.data;
  const link = data?.code ? `${window.location.origin}/register?ref=${encodeURIComponent(data.code)}` : '';

  return (
    <>
      <Helmet>
        <title>Referrals — QuickTopUp</title>
      </Helmet>

      <PageHeader
        eyebrow="Earn"
        title="Referrals"
        description="Share your code. When a new customer completes a qualifying purchase, the reward is credited to your wallet."
      />

      {referralsQuery.isError ? (
        <Card className="mt-6">
          <ErrorState
            title="Referral information could not load"
            onRetry={() => void referralsQuery.refetch()}
          />
        </Card>
      ) : null}

      {data && !data.enabled ? (
        <Alert variant="info" className="mt-6">
          The referral programme is currently paused. Your existing referrals and rewards remain visible.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total referrals"
          value={data ? data.totals.referrals : '—'}
          icon={Users}
          loading={referralsQuery.isLoading}
          hint="People who joined with your code"
        />
        <StatCard
          label="Pending"
          value={data ? data.totals.pending : '—'}
          icon={Clock3}
          tone="warning"
          loading={referralsQuery.isLoading}
          hint="Awaiting a qualifying purchase"
        />
        <StatCard
          label="Rewarded"
          value={data ? data.totals.rewarded : '—'}
          icon={CheckCircle2}
          tone="success"
          loading={referralsQuery.isLoading}
          hint="Successful rewards"
        />
        <StatCard
          label="Total earned"
          value={data ? formatNaira(data.totals.earnedMinor) : '—'}
          icon={Gift}
          tone="info"
          loading={referralsQuery.isLoading}
          hint="Credited to your wallet ledger"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Your referral code" description="Share the code or the invite link" />
          <div className="p-5 sm:p-6">
            {referralsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/10 to-brand-500/5 p-5 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
                    Invite code
                  </p>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-[0.18em] text-brand-900 dark:text-brand-100">
                    {data?.code || '—'}
                  </p>
                  {data?.code ? (
                    <div className="mt-3 flex justify-center">
                      <CopyButton value={data.code} label="Copy code" />
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  <label className="label" htmlFor="referral-link">
                    Invite link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="referral-link"
                      readOnly
                      value={link}
                      className="field truncate text-xs"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <CopyButton value={link} label="Copy" />
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-xs leading-6 text-muted">
                  <p className="flex items-start gap-2">
                    <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                    Your friend must sign up with the code or link and complete a purchase of at least{' '}
                    {data ? formatNaira(data.qualifyingPurchaseMinor) : '—'}.
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                    The reward of {data ? formatNaira(data.rewardMinor) : '—'} is credited once, after a successful
                    qualifying purchase.
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Referral history"
            description="Names are limited to protect customer privacy"
            action={
              data?.code ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard?.writeText(link)}
                  leftIcon={<Link2 className="h-3.5 w-3.5" />}
                >
                  Copy invite
                </Button>
              ) : null
            }
          />
          {referralsQuery.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.referrals.length ? (
            <ul className="divide-y divide-line">
              {data.referrals.map((referral) => (
                <li key={referral.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500/10 text-sm font-semibold text-brand-800 dark:text-brand-200">
                    {referral.referredName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{referral.referredName}</p>
                    <p className="mt-0.5 text-[11px] text-muted">Joined {formatDate(referral.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={statusTone[referral.status]}>{referral.status.toLowerCase()}</Badge>
                    <p className="mt-1 text-[11px] text-muted">
                      {referral.rewardMinor ? formatNaira(referral.rewardMinor) : 'Pending reward'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Gift}
              title="No referrals yet"
              description="Share your code with friends and family. Rewards appear here after they qualify."
              className="py-12"
            />
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="p-5 text-xs leading-6 text-muted sm:p-6">
          <p className="font-semibold text-ink">Fair use</p>
          <p className="mt-1">
            Self-referrals, duplicate accounts, and fraudulent purchases do not qualify. Rewards may be withheld or
            reversed where abuse is detected. Referral payouts are recorded in your wallet ledger as referral rewards and
            can be reconciled with support.
          </p>
        </div>
      </Card>
    </>
  );
}
