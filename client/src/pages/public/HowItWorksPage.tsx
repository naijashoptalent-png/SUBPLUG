import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Fingerprint,
  History,
  ReceiptText,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import { SimplePageShell } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { buttonStyles } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const journey = [
  {
    icon: Fingerprint,
    title: 'Create and secure your account',
    body: 'Register with your name, email and Nigerian mobile number. Verify your email, then sign in. You can enable an authenticator app for two-factor authentication from account settings.',
    detail: 'Sessions use short-lived access tokens and rotating refresh tokens. Reuse of an old refresh token revokes the session family.',
  },
  {
    icon: Banknote,
    title: 'Fund the wallet',
    body: 'Start a funding request for the amount you need. You are redirected to the configured payment gateway, then returned to SubPlug.',
    detail: 'The return redirect is not proof of payment. Your wallet is credited only after a verified webhook or a server-side verification of the reference, amount and currency.',
  },
  {
    icon: Smartphone,
    title: 'Choose the service and confirm',
    body: 'Pick airtime, a data bundle, an electricity meter or a cable package. Check the recipient, price and any fee, then confirm the debit from your wallet.',
    detail: 'Every financial request carries an idempotency key, so a network retry cannot debit the same wallet twice.',
  },
  {
    icon: ReceiptText,
    title: 'Receive a provider-confirmed result',
    body: 'The order is submitted to the VTU provider. When the provider confirms delivery, the transaction becomes successful and the receipt is stored in your history.',
    detail: 'Electricity tokens and provider references are kept with the transaction. If the outcome is uncertain, the order is held for review — not marked successful.',
  },
];

const failureRules = [
  {
    icon: RotateCcw,
    title: 'Failed before submission',
    copy: 'If the wallet debit cannot be completed, or the order is rejected before reaching the provider, the held amount is returned to your wallet.',
    tone: 'success' as const,
  },
  {
    icon: TriangleAlert,
    title: 'Provider reports failure',
    copy: 'The transaction is marked failed and refunded to your wallet. The failed status stays visible with the provider reason where available.',
    tone: 'warning' as const,
  },
  {
    icon: SearchCheck,
    title: 'Provider outcome is uncertain',
    copy: 'The transaction moves to review. Support checks the provider before deciding. It is not treated as successful because of a timeout.',
    tone: 'info' as const,
  },
  {
    icon: Clock3,
    title: 'Pending at the provider',
    copy: 'Pending orders appear in your history and are reconciled automatically where the provider supports status checks. You can also open a support ticket.',
    tone: 'brand' as const,
  },
];

export function HowItWorksPage() {
  return (
    <>
      <Helmet>
        <title>How SubPlug works — wallet, purchases and refunds</title>
        <meta
          name="description"
          content="Understand the SubPlug flow: account security, wallet funding, provider submission, confirmed outcomes and refund rules."
        />
      </Helmet>

      <SimplePageShell
        eyebrow="How it works"
        title="A short flow with serious controls behind it."
        description="SubPlug is built around a simple rule: money moves only when the platform can verify what happened. Here is the full journey."
      >
        <div className="space-y-4">
          {journey.map((step, index) => (
            <Card key={step.title} className="p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">Step {index + 1}</Badge>
                    <h2 className="text-lg font-semibold">{step.title}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-muted">{step.body}</p>
                  <p className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs leading-6 text-muted">
                    {step.detail}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="text-2xl font-semibold">When something goes wrong</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            Outcomes are explicit. The platform does not invent a success state to make a screen look better.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {failureRules.map((rule) => (
              <Card key={rule.title} className="p-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted">
                    <rule.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <Badge tone={rule.tone}>{rule.title}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{rule.copy}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-14 rounded-3xl bg-brand-950 p-6 text-white sm:p-8">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand-300" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-semibold text-white">Your records are the same records support sees</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Each wallet movement has a reference, direction, amount, running balance and timestamp. Each purchase has
                a status history. That shared record is what makes support resolution concrete rather than guesswork.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: History, label: 'Ledger entries', copy: 'Append-only wallet movements' },
              { icon: ReceiptText, label: 'Purchase receipts', copy: 'Provider references & tokens' },
              { icon: CircleHelp, label: 'Support tickets', copy: 'Linked to transaction references' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <item.icon className="h-4 w-4 text-brand-300" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-white">{item.label}</p>
                <p className="mt-0.5 text-[11px] leading-5 text-white/60">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link to="/register" className={buttonStyles('primary', 'lg')}>
            Create an account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/faq" className={buttonStyles('outline', 'lg')}>
            Read the FAQs
          </Link>
        </div>

        <div className="mt-8 flex items-start gap-2 text-xs leading-6 text-subtle">
          <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Service availability depends on the connected VTU and payment providers. Where a provider is temporarily
          unavailable, the affected action is blocked rather than simulated.
        </div>
      </SimplePageShell>
    </>
  );
}
