import { Helmet } from 'react-helmet-async';
import { SimplePageShell } from '@/components/layout/PublicLayout';

export function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy policy — SubPlug</title>
        <meta
          name="description"
          content="How SubPlug collects, uses, shares and protects personal data under Nigerian data protection law."
        />
      </Helmet>
      <SimplePageShell
        eyebrow="Legal"
        title="Privacy policy"
        description="This policy explains what personal data SubPlug processes, why we process it, and the choices available to you."
      >
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-subtle">Last updated: 20 October 2026</p>

        <div className="prose-page">
          <h2>1. Who we are</h2>
          <p>
            SubPlug operates a wallet and VTU platform for airtime, mobile data, electricity and cable TV payments in
            Nigeria. For the purposes of the Nigeria Data Protection Act 2023, SubPlug is the data controller for the
            personal data described below, except where a payment or service provider processes data as an independent
            controller.
          </p>

          <h2>2. Personal data we collect</h2>
          <ul>
            <li><strong>Account data:</strong> full name, email address, phone number, password hash, account status, role, referral code and security settings.</li>
            <li><strong>Identity and verification data:</strong> email and phone verification status, and two-factor authentication secrets stored in encrypted/secret form.</li>
            <li><strong>Transaction data:</strong> service type, recipient phone number, meter number, smartcard number, package or plan, amount, provider reference, status and fulfilment details such as electricity tokens.</li>
            <li><strong>Wallet data:</strong> funding references, ledger entries, balances, refunds and adjustments.</li>
            <li><strong>Payment data:</strong> gateway reference and payment status. Card details are entered on the payment gateway’s page and are not stored by SubPlug.</li>
            <li><strong>Support data:</strong> messages, ticket references and any attachments or information you choose to provide.</li>
            <li><strong>Technical data:</strong> IP address, user agent, session metadata, request identifiers and security logs.</li>
          </ul>

          <h2>3. How we collect data</h2>
          <p>
            We collect data you provide when registering, funding a wallet, making a purchase, contacting support or
            enabling security features. We also generate transaction and security records automatically when you use the
            platform, and receive payment status information from the configured payment gateway.
          </p>

          <h2>4. Why we process personal data</h2>
          <ul>
            <li>To create and secure your account, authenticate you and prevent fraud or abuse.</li>
            <li>To process wallet funding, purchases, refunds and provider submissions.</li>
            <li>To maintain financial and audit records, reconcile balances and investigate disputes.</li>
            <li>To provide support and respond to your requests.</li>
            <li>To comply with legal, tax, accounting and regulatory obligations.</li>
            <li>To operate and improve the platform, including diagnostics, rate limiting and service reliability.</li>
            <li>To administer referrals and rewards where you participate in the programme.</li>
          </ul>
          <p>
            Our lawful bases include performance of a contract with you, compliance with legal obligations, your consent
            where required (for example optional communications), and our legitimate interests in operating a secure,
            reliable service. Where we rely on legitimate interests, we consider the impact on you and provide safeguards.
          </p>

          <h2>5. When we share data</h2>
          <ul>
            <li><strong>Service providers:</strong> VTU and bill-payment providers receive the recipient details needed to fulfil a transaction (for example a phone number, meter number or smartcard number).</li>
            <li><strong>Payment gateways:</strong> receive the information needed to process a funding request, such as your email, amount and a reference.</li>
            <li><strong>Infrastructure and communications providers:</strong> process data on our behalf for hosting, database, email and messaging, under appropriate confidentiality and security obligations.</li>
            <li><strong>Professional advisers and authorities:</strong> where required by law, a valid legal request, or to establish or defend legal claims.</li>
            <li><strong>Business transactions:</strong> if the platform is reorganised, merged or transferred, data may be transferred as part of that transaction subject to appropriate safeguards.</li>
          </ul>
          <p>We do not sell personal data. We do not share your password or authenticator secret with third parties.</p>

          <h2>6. Cookies and similar technologies</h2>
          <p>
            SubPlug uses strictly necessary cookies for authentication, session rotation and CSRF protection. These
            cookies are HTTP-only where appropriate and are not used for advertising. The theme preference is stored in
            your browser’s local storage. You can clear cookies and local storage through your browser, but doing so will
            sign you out and may reset preferences.
          </p>

          <h2>7. Retention</h2>
          <p>
            We retain account and transaction records for as long as needed to provide the service and to meet legal,
            accounting, tax and dispute-resolution requirements. Security and audit logs are retained for a limited period
            appropriate to their purpose. When data is no longer required, we delete it or de-identify it, subject to
            backup and legal retention obligations.
          </p>

          <h2>8. Security</h2>
          <p>
            We use measures designed to protect personal data, including password hashing, short-lived access tokens,
            hashed refresh tokens with rotation, CSRF protection, rate limiting, role-based access control, audit logging
            and encryption in transit where HTTPS is configured. No system is completely secure; if you believe your
            account has been compromised, contact support immediately.
          </p>

          <h2>9. Your rights</h2>
          <p>Subject to applicable law and verification of your identity, you may have the right to:</p>
          <ul>
            <li>access the personal data we hold about you;</li>
            <li>request correction of inaccurate or incomplete data;</li>
            <li>request deletion where the data is no longer necessary or processing is unlawful;</li>
            <li>object to or request restriction of certain processing;</li>
            <li>request portability of data you provided, where applicable;</li>
            <li>withdraw consent where processing relies on consent; and</li>
            <li>lodge a complaint with the Nigeria Data Protection Commission.</li>
          </ul>
          <p>
            To exercise a right, contact support. We may need to verify your identity and may retain certain records where
            the law requires it. Withdrawing consent does not affect processing carried out before withdrawal.
          </p>

          <h2>10. Children</h2>
          <p>
            The platform is intended for people aged 18 and above. We do not knowingly collect personal data from
            children. If you believe a child has created an account, contact support so the account can be reviewed and
            closed.
          </p>

          <h2>11. International transfers</h2>
          <p>
            Some service providers or infrastructure processors may process data outside Nigeria. Where that happens, we
            take steps designed to ensure an appropriate level of protection consistent with the Nigeria Data Protection
            Act and applicable regulations.
          </p>

          <h2>12. Changes to this policy</h2>
          <p>
            We may update this policy as the platform, our processors or the law change. The “last updated” date will
            change, and material updates will be communicated through the platform or by email where appropriate.
          </p>

          <h2>13. Contact</h2>
          <p>
            Privacy questions can be sent through the <a href="/contact">contact page</a> or to the support email shown
            in the footer. Include “Privacy request” in the subject so it can be routed appropriately.
          </p>
        </div>
      </SimplePageShell>
    </>
  );
}
