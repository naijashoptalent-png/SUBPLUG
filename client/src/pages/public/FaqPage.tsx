import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ChevronDown, CircleHelp, MessageSquareText } from 'lucide-react';
import { SimplePageShell } from '@/components/layout/PublicLayout';
import { buttonStyles } from '@/components/ui/Button';
import { usePublicSettings } from '@/hooks/usePublicSettings';

const groups = [
  {
    title: 'Getting started',
    items: [
      {
        q: 'What do I need to open a SubPlug account?',
        a: 'Your full name, a valid email address and a Nigerian mobile number. Choose a password with at least 10 characters including uppercase, lowercase, a number and a symbol. You may need to verify your email before making purchases.',
      },
      {
        q: 'Can I use SubPlug on my phone?',
        a: 'Yes. The interface is built mobile-first. You can add it to your home screen from your mobile browser for quicker access.',
      },
      {
        q: 'Do I need to verify my email?',
        a: 'Email verification is required for wallet funding and purchases when the platform has verification enabled. You can resend the verification email from the sign-in flow if the original link expires.',
      },
    ],
  },
  {
    title: 'Wallet and payments',
    items: [
      {
        q: 'How is my wallet funded?',
        a: 'You start a funding request, pay through the configured payment gateway, and are returned to SubPlug. The wallet is credited only after a verified payment result — a signed webhook or a server-side verification of the reference, amount and currency.',
      },
      {
        q: 'Why has my payment not reflected yet?',
        a: 'Gateways sometimes confirm a payment a little after you return to the site. Open the funding record from your wallet history and use the verify action. If it remains pending, contact support with the funding reference. Never send money to anyone who asks you to fund an account outside the platform.',
      },
      {
        q: 'Can I withdraw my wallet balance?',
        a: 'Wallet balances are operational balances used to purchase services on the platform. Withdrawal availability depends on the platform’s operating policy and is not automatic. Contact support before funding an amount you intend to withdraw.',
      },
      {
        q: 'Are there fees?',
        a: 'Airtime prices include any applicable discount. Data and cable prices come from the catalogue with the platform markup already applied. Electricity may include a service fee, shown before you confirm. The exact payable amount is always displayed at checkout.',
      },
    ],
  },
  {
    title: 'Transactions and refunds',
    items: [
      {
        q: 'How do I know a purchase was successful?',
        a: 'The receipt shows a successful status only after the provider confirms delivery. Provider references and, for prepaid electricity, the token are stored with the transaction. A redirect or page refresh alone never changes a purchase to successful.',
      },
      {
        q: 'What happens if a purchase fails?',
        a: 'Failed purchases are refunded to your wallet. The refund appears as a separate ledger entry linked to the original transaction. If the provider outcome is uncertain, the order moves to review instead of being marked successful.',
      },
      {
        q: 'How long do refunds take?',
        a: 'Wallet refunds are written as soon as the failure is confirmed by the platform. Bank reversals, where applicable to an external payment, depend on your bank and are outside the platform’s direct control.',
      },
      {
        q: 'Can I cancel a purchase after confirming it?',
        a: 'Once an order has been submitted to the provider it may not be cancellable. If it is still held before submission, support may be able to reject it and refund the wallet. Open a ticket with the transaction reference as soon as possible.',
      },
      {
        q: 'What if I entered the wrong phone number or meter number?',
        a: 'Contact support immediately with the reference. If the provider has already delivered the service, the transaction may not be reversible. Always check the recipient and validated customer name before confirming.',
      },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        q: 'How is my account protected?',
        a: 'Access uses HTTP-only cookies, CSRF protection on mutating requests, rate-limited sign-in and hashed refresh tokens with rotation. Repeated failed sign-ins can lock the account temporarily. You can enable authenticator-based two-factor authentication from settings.',
      },
      {
        q: 'Does SubPlug store my card details?',
        a: 'Card data is entered on the payment gateway’s page, not on SubPlug. The platform stores the gateway reference and payment status needed to reconcile the funding.',
      },
      {
        q: 'What should I do if I suspect unauthorised access?',
        a: 'Change your password immediately from account settings, enable two-factor authentication, and contact support. Changing your password revokes active sessions. If you cannot sign in, use the password reset flow.',
      },
    ],
  },
  {
    title: 'Referrals and support',
    items: [
      {
        q: 'How do referrals work?',
        a: 'Share your referral code from the referrals page. A reward is credited after the referred account completes a qualifying purchase, subject to the reward amount and referral limits shown in your account. Rewards are one per qualifying referral.',
      },
      {
        q: 'How do I contact support?',
        a: 'Open a ticket from the dashboard support page, or use the contact form. Linking a transaction reference helps support find the exact ledger entries and provider status. Include what you expected and what happened.',
      },
      {
        q: 'Can support change my wallet balance?',
        a: 'Only administrators can make wallet adjustments, and every adjustment is recorded in the audit trail and shown as a ledger entry with a reason. Support cannot silently edit a balance.',
      },
    ],
  },
];

export function FaqPage() {
  const { settings } = usePublicSettings();
  const allItems = groups.flatMap((group) => group.items);

  return (
    <>
      <Helmet>
        <title>Help centre & FAQs — SubPlug</title>
        <meta
          name="description"
          content="Answers about SubPlug wallet funding, provider-confirmed purchases, refunds, security and referrals."
        />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: allItems.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          })}
        </script>
      </Helmet>

      <SimplePageShell
        eyebrow="Help centre"
        title="Answers before you need them."
        description="Practical answers about funding, delivery, refunds and account security. If your question is about a specific order, include the reference when you contact support."
      >
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.title} aria-labelledby={group.title.replace(/\s+/g, '-').toLowerCase()}>
              <h2
                id={group.title.replace(/\s+/g, '-').toLowerCase()}
                className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-subtle"
              >
                {group.title}
              </h2>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
                {group.items.map((item) => (
                  <details key={item.q} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink transition hover:bg-surface [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start gap-2.5">
                        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                        {item.q}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-subtle transition group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="px-5 pb-5 pl-[3.1rem] text-sm leading-7 text-muted">{item.a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-line bg-raised p-6">
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">Still stuck?</h2>
              <p className="mt-1 text-sm text-muted">
                Email {settings.support.email} or open a support ticket from your dashboard. Our published hours are{' '}
                {settings.support.hours}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/contact" className={buttonStyles('primary', 'sm')}>
                  Contact support
                </Link>
                <Link to="/dashboard/support" className={buttonStyles('outline', 'sm')}>
                  Open a ticket
                </Link>
              </div>
            </div>
          </div>
        </div>
      </SimplePageShell>
    </>
  );
}
