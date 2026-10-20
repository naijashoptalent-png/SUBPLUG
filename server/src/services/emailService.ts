import nodemailer, { Transporter } from 'nodemailer';
import { env, isProduction } from '../config/env';
import { logger } from '../config/logger';
import { formatNaira } from '../utils/money';

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.EMAIL_HOST || !env.EMAIL_USER) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
      pool: true,
      maxConnections: 3,
    });
  }
  return transporter;
}

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendMail(input: MailInput): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    if (!isProduction) {
      logger.info({ to: input.to, subject: input.subject, preview: input.text.slice(0, 500) }, '[DEV EMAIL] not sent — SMTP not configured');
      return;
    }
    logger.error({ to: input.to, subject: input.subject }, 'SMTP is not configured; email not sent');
    return;
  }
  try {
    await transport.sendMail({ from: env.EMAIL_FROM, ...input });
  } catch (error) {
    // Email must never break a financial workflow.
    logger.error({ err: error, to: input.to, subject: input.subject }, 'Failed to send email');
  }
}

function layout(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-weight:800;font-size:20px;color:#0f766e;margin-bottom:24px">QuickTopUp</div>
    <h1 style="font-size:20px">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="font-size:12px;color:#64748b">This is an automated message. Never share your password or one-time codes. If you did not request this email, contact support.</p>
  </div>`;
}

export async function sendVerificationEmail(to: string, fullName: string, verificationUrl: string) {
  await sendMail({
    to,
    subject: 'Verify your QuickTopUp email',
    text: `Hi ${fullName}, verify your email: ${verificationUrl} (expires in 24 hours).`,
    html: layout('Verify your email', `<p>Hi ${fullName},</p><p>Confirm your email address to activate purchases.</p>
      <p><a href="${verificationUrl}" style="background:#0f766e;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a></p>
      <p style="font-size:12px;color:#64748b">This link expires in 24 hours. If you did not create an account, ignore this email.</p>`),
  });
}

export async function sendPasswordResetEmail(to: string, fullName: string, resetUrl: string) {
  await sendMail({
    to,
    subject: 'Reset your QuickTopUp password',
    text: `Hi ${fullName}, reset your password: ${resetUrl} (expires in 1 hour). If this wasn't you, ignore this email.`,
    html: layout('Reset your password', `<p>Hi ${fullName},</p><p>Use the button below to choose a new password. The link expires in one hour.</p>
      <p><a href="${resetUrl}" style="background:#0f766e;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p>`),
  });
}

export async function sendFundingReceipt(to: string, reference: string, amountMinor: number) {
  await sendMail({
    to,
    subject: `Wallet funding received — ${reference}`,
    text: `Your wallet was credited with ${formatNaira(amountMinor)}. Reference: ${reference}.`,
    html: layout('Wallet funded', `<p>Your wallet has been credited with <strong>${formatNaira(amountMinor)}</strong>.</p><p>Reference: ${reference}</p>`),
  });
}

export async function sendPurchaseStatus(to: string, reference: string, status: string, description: string) {
  await sendMail({
    to,
    subject: `Transaction ${status.toLowerCase()} — ${reference}`,
    text: `${description} Reference: ${reference}. View details in your dashboard.`,
    html: layout(`Transaction ${status.toLowerCase()}`, `<p>${description}</p><p>Reference: <strong>${reference}</strong></p><p>You can view the full receipt in your dashboard.</p>`),
  });
}

export async function sendSecurityAlert(to: string, message: string) {
  await sendMail({
    to,
    subject: 'Security alert for your QuickTopUp account',
    text: message,
    html: layout('Security alert', `<p>${message}</p><p>If this was not you, reset your password immediately and contact support.</p>`),
  });
}

export async function sendContactMessage(input: {
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) {
  await sendMail({
    to: env.EMAIL_FROM.match(/<(.+)>/)?.[1] ?? 'support@example.com',
    subject: `[Website contact] ${input.subject}`,
    text: `From: ${input.fullName} <${input.email}>${input.phone ? ` / ${input.phone}` : ''}\n\n${input.message}`,
    html: layout('Website contact', `<p><strong>${input.fullName}</strong> &lt;${input.email}&gt;${input.phone ? ` · ${input.phone}` : ''}</p><p>${input.message.replace(/\n/g, '<br/>')}</p>`),
  });
}

export async function sendSupportReply(to: string, ticketReference: string, body: string) {
  await sendMail({
    to,
    subject: `Support ticket ${ticketReference} updated`,
    text: body,
    html: layout('Support ticket updated', `<p>${body}</p><p>Ticket: <strong>${ticketReference}</strong></p>`),
  });
}
