import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, CheckCircle2, CircleOff, Compass, HeartHandshake, Layers, LockKeyhole, Scale } from 'lucide-react';
import { SimplePageShell } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { buttonStyles } from '@/components/ui/Button';

const principles = [
  {
    icon: Scale,
    title: 'Financial correctness before features',
    copy: 'Money is stored as integer kobo. Wallet balances are projections of a ledger, not an editable number. Retries cannot double-charge an account.',
  },
  {
    icon: LockKeyhole,
    title: 'Security is part of the product',
    copy: 'HTTP-only session cookies, CSRF protection, login rate limiting, hashed refresh tokens with rotation and optional TOTP two-factor authentication.',
  },
  {
    icon: Compass,
    title: 'Clear outcomes over optimistic screens',
    copy: 'A purchase is successful only when the provider says so. Timeouts become reviewable states, not automatic success messages.',
  },
  {
    icon: HeartHandshake,
    title: 'Support with context',
    copy: 'Support tickets can be linked to a transaction reference, so the agent sees the same status history and ledger entries as the customer.',
  },
];

const scope = {
  yes: [
    'Airtime top-ups for Nigerian mobile networks',
    'Mobile data bundles from the configured provider catalogue',
    'Prepaid and postpaid electricity payments',
    'DStv, GOtv and StarTimes package renewals',
    'A wallet ledger with funding, purchase and refund records',
    'Referral rewards after a qualifying purchase',
  ],
  no: [
    'Interest-bearing deposit accounts or investment products',
    'Loans, credit lines or overdrafts',
    'Direct control of your bank account or card storage',
    'Guaranteed availability when a third-party provider is down',
    'Manual balance edits hidden from the audit trail',
  ],
};

export function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About QuickTopUp — principles and platform scope</title>
        <meta
          name="description"
          content="QuickTopUp is a Nigerian VTU and bill-payment platform built around an auditable wallet ledger, verified payment outcomes and practical security."
        />
      </Helmet>

      <SimplePageShell
        eyebrow="About QuickTopUp"
        title="Everyday payments deserve engineering discipline."
        description="QuickTopUp brings airtime, data, electricity and cable TV into one wallet — and treats the record of every movement as a first-class product."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {principles.map((principle) => (
            <Card key={principle.title} className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                <principle.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="mt-3.5 text-base font-semibold">{principle.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{principle.copy}</p>
            </Card>
          ))}
        </div>

        <section className="mt-14" aria-labelledby="scope-heading">
          <h2 id="scope-heading" className="text-2xl font-semibold">What QuickTopUp is — and what it is not</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Being explicit about scope is part of building trust. QuickTopUp is a technology platform that initiates VTU
            and bill payments through integrated service providers. It is not a bank.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                <h3 className="text-sm font-semibold">What the platform does</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {scope.yes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-muted">
                    <CheckCircle2 className="mt-1 h-3 w-3 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <CircleOff className="h-4 w-4 text-danger" aria-hidden="true" />
                <h3 className="text-sm font-semibold">What it does not do</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {scope.no.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-muted">
                    <CircleOff className="mt-1 h-3 w-3 shrink-0 text-danger/70" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-xl border border-line bg-surface px-3 py-2 text-[11px] leading-5 text-subtle">
                Wallet balances are operational balances for purchasing services on the platform. They are not
                interest-bearing deposits and do not represent a bank account.
              </p>
            </Card>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="approach-heading">
          <h2 id="approach-heading" className="text-2xl font-semibold">How the platform is put together</h2>
          <div className="mt-5 space-y-4">
            {[
              {
                icon: Layers,
                title: 'Provider adapters, not hardcoded integrations',
                copy: 'VTU and payment providers sit behind adapter interfaces. The platform does not hardcode endpoints, and sandbox adapters are clearly flagged and blocked in production.',
              },
              {
                icon: BookOpenCheck,
                title: 'An auditable ledger is the source of truth',
                copy: 'Each financial operation writes a uniquely keyed ledger entry. Reconciliation tooling compares projections with ledger sums and reports drift rather than silently correcting it.',
              },
              {
                icon: LockKeyhole,
                title: 'Sensitive actions are permissioned and logged',
                copy: 'Roles separate customers, support staff and administrators. Wallet adjustments, refund decisions and settings changes produce audit entries with actor and context.',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3.5 rounded-2xl border border-line bg-raised p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-brand-700 dark:text-brand-300">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-brand-500/20 bg-brand-500/5 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-semibold">Built for the realities of the market</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Nigerian networks, Nigerian discos and Nigerian cable providers — with pricing in Naira, meters and
                smartcards validated before payment, and support accessible when a provider behaves unexpectedly.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col gap-2 sm:flex-row">
          <Link to="/register" className={buttonStyles('primary', 'lg')}>
            Create your account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/contact" className={buttonStyles('outline', 'lg')}>
            Contact the team
          </Link>
        </div>
      </SimplePageShell>
    </>
  );
}
