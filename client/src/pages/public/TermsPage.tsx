import { Helmet } from 'react-helmet-async';
import { SimplePageShell } from '@/components/layout/PublicLayout';

export function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of service — QuickTopUp</title>
        <meta name="description" content="The terms that govern use of the QuickTopUp wallet and VTU services." />
      </Helmet>
      <SimplePageShell
        eyebrow="Legal"
        title="Terms of service"
        description="These terms govern your use of QuickTopUp. By creating an account or using the platform, you agree to them."
      >
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-subtle">Last updated: 20 October 2026</p>

        <div className="prose-page">
          <h2>1. About these terms</h2>
          <p>
            QuickTopUp (“QuickTopUp”, “we”, “us”) provides a wallet and technology platform for purchasing airtime,
            mobile data, electricity and cable television services in Nigeria. These terms form an agreement between you
            and QuickTopUp. If you do not agree, do not use the platform.
          </p>
          <p>
            QuickTopUp is not a bank and does not provide deposit, credit, investment or insurance products. Wallet
            balances are operational balances used to purchase services through the platform and are not interest-bearing
            deposits.
          </p>

          <h2>2. Eligibility and account registration</h2>
          <p>
            You must be at least 18 years old and legally able to enter into a binding contract. You agree to provide
            accurate registration details, keep them current, and use only a phone number and email address that you are
            authorised to use.
          </p>
          <p>
            One account per person unless we agree otherwise. We may refuse, suspend or close accounts where we have
            reasonable grounds to suspect fraud, abuse, impersonation, money laundering or a breach of these terms.
          </p>

          <h2>3. Account security</h2>
          <ul>
            <li>You are responsible for keeping your password, email account and authenticator device secure.</li>
            <li>Do not share passwords or one-time codes. QuickTopUp staff will never ask for your password or OTP.</li>
            <li>You must tell support promptly if you believe your account has been accessed without authorisation.</li>
            <li>We may rate-limit, lock or require additional verification where we detect suspicious activity.</li>
          </ul>

          <h2>4. Services and third-party providers</h2>
          <p>
            VTU and bill-payment services are fulfilled through integrated service providers. Availability, delivery
            times and pricing may depend on those providers and the underlying networks, distribution companies or cable
            operators. We do not control third-party infrastructure and cannot guarantee uninterrupted availability.
          </p>
          <p>
            A purchase is successful only when the provider confirms delivery. A completed payment or page redirect does
            not, by itself, mean the service was delivered. Where a provider result is uncertain, the transaction may be
            held for review.
          </p>

          <h2>5. Wallet funding</h2>
          <ul>
            <li>Funding is completed through the payment gateway configured on the platform.</li>
            <li>Your wallet is credited only after a verified payment result that matches the expected reference, amount and currency.</li>
            <li>You must not fund a wallet on behalf of, or at the request of, a third party you do not trust. Funding requests outside the platform are not protected.</li>
            <li>Wallet balances are not transferable except where the platform explicitly provides a transfer feature.</li>
          </ul>

          <h2>6. Pricing, fees and discounts</h2>
          <p>
            Prices are displayed in Nigerian Naira before you confirm a purchase. Airtime may carry a discount; data and
            cable prices include the platform markup; electricity may include a service fee. The exact amount to be
            debited is shown at checkout and recorded on the receipt. Prices may change when the provider catalogue
            changes. A price shown at checkout applies to that order once confirmed.
          </p>

          <h2>7. Failed purchases, refunds and reviews</h2>
          <ul>
            <li>If a purchase fails before delivery, the amount held for that purchase is refunded to your wallet.</li>
            <li>If the provider reports failure, the transaction is marked failed and refunded, subject to confirmation of the provider result.</li>
            <li>If the outcome is uncertain, the transaction is placed in review. It is not marked successful until the provider confirms delivery.</li>
            <li>Once a service has been delivered to the recipient you supplied, the transaction is generally not reversible. Check phone numbers, meter numbers and smartcard details before confirming.</li>
            <li>Bank reversals for external payments are subject to your bank’s processes and timelines.</li>
          </ul>

          <h2>8. Referrals</h2>
          <p>
            Referral rewards are governed by the terms shown on the referrals page, including the qualifying purchase
            threshold, reward amount and maximum number of rewarded referrals. Self-referral, duplicate accounts and
            fabricated transactions do not qualify. We may reverse or withhold rewards associated with abuse.
          </p>

          <h2>9. Acceptable use</h2>
          <p>You must not use QuickTopUp to:</p>
          <ul>
            <li>commit fraud, launder money, finance unlawful activity or evade sanctions;</li>
            <li>impersonate another person or use a phone number, meter or smartcard without authorisation;</li>
            <li>attack, scrape, reverse engineer or interfere with the platform or its security controls;</li>
            <li>resell services in a manner that breaches a provider’s terms or applicable law;</li>
            <li>create multiple accounts to abuse promotions, referrals or limits.</li>
          </ul>
          <p>
            We may suspend transactions, request information, report suspicious activity to relevant authorities and
            close accounts where required by law or where necessary to protect the platform and its users.
          </p>

          <h2>10. Intellectual property</h2>
          <p>
            The platform, brand, interface and underlying software are owned by or licensed to QuickTopUp. You receive a
            limited, revocable, non-exclusive licence to use the platform for its intended purpose. You may not copy,
            modify or distribute the platform except as permitted by law or with written permission.
          </p>

          <h2>11. Availability and limitation of liability</h2>
          <p>
            The platform is provided on an “as available” basis. To the maximum extent permitted by Nigerian law, we are
            not liable for indirect or consequential loss, loss of profit or loss caused by a third-party provider’s
            failure, network outage or your failure to keep your account secure. Nothing in these terms excludes
            liability that cannot lawfully be excluded.
          </p>
          <p>
            Where a transaction fails, your primary remedy is a refund of the amount held for that transaction, subject
            to verification of the provider result.
          </p>

          <h2>12. Suspension and termination</h2>
          <p>
            We may suspend or close an account for breach of these terms, suspected fraud, legal requirements or
            prolonged inactivity, subject to applicable law. You may stop using the platform at any time. Provisions that
            by their nature survive termination — including record-keeping, liability and dispute provisions — continue
            to apply.
          </p>

          <h2>13. Changes to these terms</h2>
          <p>
            We may update these terms as the platform or applicable law changes. The “last updated” date will change and
            material updates will be communicated through the platform or by email where appropriate. Continued use
            after an update constitutes acceptance of the revised terms.
          </p>

          <h2>14. Governing law and disputes</h2>
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria. Before commencing formal
            proceedings, you agree to contact support and allow a reasonable opportunity to resolve the issue. Subject to
            any mandatory consumer protections, the courts of Nigeria have jurisdiction over disputes arising from these
            terms.
          </p>

          <h2>15. Contact</h2>
          <p>
            Questions about these terms can be sent through the <a href="/contact">contact page</a> or to the support
            email shown in the footer.
          </p>
        </div>
      </SimplePageShell>
    </>
  );
}
