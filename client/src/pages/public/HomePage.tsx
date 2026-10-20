import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Fingerprint,
  History,
  KeyRound,
  LockKeyhole,
  Phone,
  PlugZap,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  Wifi,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { useNetworks } from '@/hooks/useCatalogue';
import { useServices } from '@/hooks/useCatalogue';
import { buttonStyles } from '@/components/ui/Button';
import { SandboxBadge } from '@/components/ui/SandboxNotice';
import { BrandMark } from '@/components/ui/BrandMark';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ServiceType } from '@/types';

const services = [
  {
    key: 'AIRTIME' as ServiceType,
    title: 'Airtime, instantly',
    description: 'Top up any Nigerian mobile number from your wallet, with the discounted price shown before you confirm.',
    icon: Phone,
    points: ['MTN, Airtel, Glo & 9mobile', 'Discount shown upfront', 'Provider-confirmed delivery'],
  },
  {
    key: 'DATA' as ServiceType,
    title: 'Data for every routine',
    description: 'Browse the live catalogue of data bundles, synced from the provider so prices and validity stay current.',
    icon: Wifi,
    points: ['Catalogue synced from provider', 'Clear volume & validity', 'Confirmation before debit'],
  },
  {
    key: 'ELECTRICITY' as ServiceType,
    title: 'Electricity without the queue',
    description: 'Pay prepaid or postpaid bills and receive the provider token as soon as the payment is confirmed.',
    icon: Zap,
    points: ['Prepaid and postpaid meters', 'Meter validation', 'Token stored on your receipt'],
  },
  {
    key: 'CABLE' as ServiceType,
    title: 'Cable TV renewals',
    description: 'Renew DStv, GOtv and StarTimes packages, with the customer name checked before payment.',
    icon: Tv,
    points: ['Smartcard validation', 'Package pricing in Naira', 'Receipt kept in your history'],
  },
];

const steps = [
  {
    icon: Fingerprint,
    title: 'Create your account',
    copy: 'Verify your email and set a strong password. Two-factor authentication can be enabled from settings.',
  },
  {
    icon: Banknote,
    title: 'Fund your wallet',
    copy: 'Pay through the configured gateway. Your balance is credited only after a verified payment result.',
  },
  {
    icon: Smartphone,
    title: 'Pick a service',
    copy: 'Choose airtime, a data plan, electricity or cable. Every price is shown before you approve the debit.',
  },
  {
    icon: ReceiptText,
    title: 'Keep the receipt',
    copy: 'The provider outcome, reference and ledger entry stay in your transaction history for auditing.',
  },
];

const faqPreview = [
  {
    q: 'When is my wallet credited after a payment?',
    a: 'Only after the payment gateway result is verified — through a signed webhook or a server-side verification call. A redirect back to QuickTopUp alone is never treated as proof of payment.',
  },
  {
    q: 'What happens if a provider fails to deliver?',
    a: 'Failed purchases are refunded to your wallet. If the provider result is uncertain, the transaction is held for review and never marked successful without confirmation.',
  },
  {
    q: 'Are my transaction details auditable?',
    a: 'Every wallet movement is written to an immutable ledger with a running balance. Your dashboard shows the same entries support uses during a review.',
  },
];

export function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const { settings } = usePublicSettings();
  const { data: networkData } = useNetworks();
  const { data: serviceData } = useServices();

  const networks = networkData?.length
    ? networkData
    : [
        { code: 'MTN', name: 'MTN' },
        { code: 'AIRTEL', name: 'Airtel' },
        { code: 'GLO', name: 'Glo' },
        { code: '9MOBILE', name: '9mobile' },
      ];
  const electricityCount = serviceData?.services.find((service) => service.key === 'ELECTRICITY')?.providers?.length ?? 0;
  const cableCount = serviceData?.services.find((service) => service.key === 'CABLE')?.providers?.length ?? 0;
  const dashboardHref = user?.role === 'CUSTOMER' ? '/dashboard' : '/admin';
  const registerHref = isAuthenticated ? dashboardHref : '/register';

  return (
    <>
      <Helmet>
        <title>QuickTopUp — Airtime, data, electricity & cable in one wallet</title>
        <meta
          name="description"
          content="Fund one secure wallet and pay for airtime, mobile data, electricity and cable TV in Nigeria. Provider-confirmed results and an auditable ledger."
        />
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 grid-lines opacity-70" />
          <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-brand-400/15 blur-3xl" />
          <div className="absolute -right-24 top-24 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        </div>

        <div className="container-page grid items-center gap-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:pb-24 lg:pt-24">
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-eyebrow">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Everyday bills, one wallet
              </span>
              <SandboxBadge />
            </div>

            <h1 className="mt-6 max-w-2xl font-display text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-6xl lg:text-[4.2rem]">
              Top up life, <span className="text-gradient">simply.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Airtime, mobile data, electricity and cable TV — paid from one secure wallet, with prices in Naira and a
              provider-confirmed result on every order.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={registerHref} className={buttonStyles('primary', 'lg', 'shadow-glow')}>
                {isAuthenticated ? 'Open your dashboard' : 'Create a free account'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/how-it-works" className={buttonStyles('outline', 'lg')}>
                See how it works
              </Link>
            </div>

            <dl className="mt-9 grid max-w-xl gap-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: 'Verified payments', copy: 'Signed webhooks & server checks' },
                { icon: LockKeyhole, label: 'Protected account', copy: 'Session rotation & 2FA' },
                { icon: History, label: 'Auditable ledger', copy: 'Every movement recorded' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-semibold text-ink">{item.label}</dt>
                    <dd className="mt-0.5 text-[11px] leading-5 text-muted">{item.copy}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* Wallet visual */}
          <div className="relative mx-auto w-full max-w-md animate-fade-up lg:mx-0" style={{ animationDelay: '120ms' }}>
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-500/15 via-transparent to-brand-300/10 blur-2xl" aria-hidden="true" />
            <div className="relative rotate-[-2deg] overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700 p-6 text-white shadow-lift transition duration-500 hover:rotate-0">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
              <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-white/5" aria-hidden="true" />

              <div className="relative flex items-start justify-between">
                <BrandMark showName={false} className="[&>span]:bg-white/10" />
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">QuickTopUp wallet</p>
                  <p className="mt-1 text-[11px] text-white/70">NGN · Nigeria</p>
                </div>
              </div>

              <p className="relative mt-14 font-display text-2xl font-medium leading-snug text-white/90">
                One balance for
                <br />
                the bills that matter.
              </p>

              <div className="relative mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                <span className="h-1 w-1 rounded-full bg-brand-300" aria-hidden="true" />
                Provider-confirmed
              </div>

              <div className="relative mt-3 flex flex-wrap gap-1.5">
                {['Airtime', 'Data', 'Electricity', 'Cable TV'].map((label) => (
                  <span key={label} className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-8 -left-4 w-[15rem] rounded-2xl border border-line bg-raised p-4 shadow-lift sm:-left-8">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">Latest result</p>
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">Purchase confirmed</p>
              <p className="mt-0.5 text-[11px] text-muted">Outcome received from provider</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full w-full rounded-full bg-success/70" />
              </div>
            </div>

            <div className="absolute -right-3 -top-6 hidden w-[12.5rem] rotate-3 rounded-2xl border border-line bg-raised p-3.5 shadow-soft sm:block">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300">
                  <ReceiptText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Ledger entry</p>
                  <p className="text-xs font-semibold text-ink">Credits & debits</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {['Wallet funding', 'Airtime purchase', 'Refund issued'].map((label, index) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted">{label}</span>
                    <span className={`text-[10px] font-semibold ${index === 1 ? 'text-ink' : 'text-success'}`}>
                      {index === 1 ? 'Debit' : 'Credit'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-y border-line bg-raised/60">
          <div className="container-page flex flex-wrap items-center gap-x-8 gap-y-3 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">Networks supported</p>
            <div className="flex flex-wrap items-center gap-2">
              {networks.map((network) => (
                <span key={network.code} className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-muted">
                  {network.name}
                </span>
              ))}
            </div>
            <p className="ml-auto hidden text-[11px] text-subtle sm:block">
              {electricityCount > 0 ? `${electricityCount} electricity providers` : 'Electricity providers synced from the live catalogue'}
              {cableCount > 0 ? ` · ${cableCount} cable networks` : ' · DStv, GOtv & StarTimes'}
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="container-page py-16 sm:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-eyebrow">What you can pay for</span>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold sm:text-4xl">Four essentials. One checkout.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              No separate apps, no saved card for every bill. Fund the wallet once and pay from the same balance.
            </p>
          </div>
          <Link to="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Explore all services
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <Card key={service.key} className="card-hover group relative overflow-hidden p-6">
              <div className="flex items-start justify-between">
                <ServiceIcon service={service.key} size="lg" />
                <Link
                  to={isAuthenticated ? `/dashboard/${service.key.toLowerCase() === 'electricity' ? 'electricity' : service.key.toLowerCase()}` : '/register'}
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition group-hover:border-brand-400/50 group-hover:text-brand-700 dark:group-hover:text-brand-300"
                  aria-label={`Open ${service.title}`}
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{service.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{service.description}</p>
              <ul className="mt-4 space-y-1.5">
                {service.points.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-xs text-muted">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-raised">
        <div className="container-page py-16 sm:py-24">
          <div className="max-w-2xl">
            <span className="section-eyebrow">How it works</span>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">From sign-up to receipt in four steps.</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The flow is deliberately short. The controls behind it are not.
            </p>
          </div>

          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="absolute right-0 top-0 font-display text-xs font-bold text-subtle">0{index + 1}</span>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{step.copy}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link to="/how-it-works" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Read the full flow
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & ledger */}
      <section className="container-page py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="section-eyebrow">Built with financial discipline</span>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Money that behaves like money.</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Balances are not edited in place. They are projected from an append-only ledger, written in integer kobo,
              with a unique idempotency key on every financial operation.
            </p>

            <div className="mt-7 space-y-5">
              {[
                {
                  icon: CircleDollarSign,
                  title: 'Integer kobo, always',
                  copy: 'No floating-point arithmetic on balances, discounts or fees. ₦1 is stored as 100 kobo.',
                },
                {
                  icon: PlugZap,
                  title: 'No fake success',
                  copy: 'A purchase only becomes successful from a provider result. A redirect or page refresh cannot mark it paid.',
                },
                {
                  icon: KeyRound,
                  title: 'Idempotent by design',
                  copy: 'Retrying a funding or purchase request with the same key cannot double-charge your wallet.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Verified webhooks',
                  copy: 'Gateway webhooks are checked against their signature and the expected reference, amount and currency.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-brand-700 dark:text-brand-300">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-0.5 text-sm leading-6 text-muted">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Ledger, illustrated</p>
                <p className="text-xs text-muted">How movements appear in your history</p>
              </div>
              <Badge tone="brand">
                <History className="h-3 w-3" aria-hidden="true" />
                Append-only
              </Badge>
            </div>
            <div className="divide-y divide-line">
              {[
                { label: 'Wallet funding', type: 'FUNDING_CREDIT', direction: 'CREDIT' as const, icon: Banknote },
                { label: 'Mobile data purchase', type: 'PURCHASE_DEBIT', direction: 'DEBIT' as const, icon: Wifi },
                { label: 'Refund for failed order', type: 'REFUND', direction: 'CREDIT' as const, icon: ReceiptText },
              ].map((entry) => (
                <div key={entry.type} className="flex items-center gap-3 px-5 py-4">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted">
                    <entry.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{entry.label}</p>
                    <p className="text-[11px] text-subtle">{entry.type}</p>
                  </div>
                  <span className={entry.direction === 'CREDIT' ? 'text-xs font-bold text-success' : 'text-xs font-bold text-ink'}>
                    {entry.direction === 'CREDIT' ? 'Credit' : 'Debit'}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-line bg-surface/60 px-5 py-3 text-[11px] leading-5 text-subtle">
              Illustrative entry types. Your actual history contains the reference, balance after each movement and the
              linked transaction.
            </div>
          </Card>
        </div>
      </section>

      {/* Catalogue reach */}
      <section className="border-y border-line bg-brand-950 text-white">
        <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <Zap className="h-3 w-3 text-brand-300" aria-hidden="true" />
              Live catalogue
            </span>
            <h2 className="mt-5 max-w-xl text-3xl font-semibold text-white sm:text-4xl">
              Prices and packages come from the provider, not a screenshot.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              The catalogue syncs with the configured VTU provider and applies the platform markup once. Plans that
              disappear from the provider are disabled instead of deleted, so old receipts remain intact.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {networks.map((network) => (
                <span key={network.code} className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85">
                  {network.name}
                </span>
              ))}
              <span className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85">DSTV</span>
              <span className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85">GOtv</span>
              <span className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/85">StarTimes</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Zap, title: 'Electricity', copy: 'Prepaid tokens and postpaid bill payments, validated before payment.' },
              { icon: Tv, title: 'Cable TV', copy: 'Provider packages with smartcard checks and stored receipts.' },
              { icon: Wifi, title: 'Mobile data', copy: 'Bundle prices kept in step with the provider catalogue.' },
              { icon: Phone, title: 'Airtime', copy: 'Discounted top-ups with the exact payable amount shown first.' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <item.icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-white/60">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="container-page py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <span className="section-eyebrow">Questions, answered</span>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">The things people ask first.</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Straight answers about timing, failures and the records behind each payment.
            </p>
            <Link to="/faq" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Read all FAQs
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y divide-line rounded-3xl border border-line bg-raised">
            {faqPreview.map((item) => (
              <div key={item.q} className="p-5 sm:p-6">
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-[2rem] border border-brand-500/20 bg-gradient-to-br from-brand-500/10 via-raised to-raised p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-brand-500/15" aria-hidden="true" />
          <div className="absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-brand-400/10 blur-2xl" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-semibold sm:text-4xl">Ready when your day needs it.</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Create an account, fund your wallet and make your first payment in minutes. Your ledger and receipts stay
              with you.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link to={registerHref} className={buttonStyles('primary', 'lg')}>
                {isAuthenticated ? 'Go to dashboard' : 'Create your account'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/contact" className={buttonStyles('outline', 'lg')}>
                Talk to support
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-subtle">
              Support hours: {settings.support.hours} · {settings.support.email}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
