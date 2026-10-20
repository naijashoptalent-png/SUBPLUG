import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Clock, Mail, MessageSquareText, Phone, Send } from 'lucide-react';
import { SimplePageShell } from '@/components/layout/PublicLayout';
import { Input, Textarea } from '@/components/ui/Field';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { useAuth } from '@/hooks/useAuth';
import { postData } from '@/lib/api';
import { contactSchema, type ContactForm } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/errors';

export function ContactPage() {
  const { settings } = usePublicSettings();
  const { isAuthenticated } = useAuth();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { fullName: '', email: '', phone: '', subject: '', message: '' },
  });

  const onSubmit = async (values: ContactForm) => {
    setError(null);
    try {
      const result = await postData<{ message: string }>('/services/contact', {
        ...values,
        phone: values.phone || undefined,
      });
      setSent(result.message);
      reset();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Helmet>
        <title>Contact support — SubPlug</title>
        <meta
          name="description"
          content="Contact SubPlug support about wallet funding, a failed purchase, meter validation or your account."
        />
      </Helmet>

      <SimplePageShell
        eyebrow="Contact"
        title="Talk to a human who can see the record."
        description="For a specific order, include the transaction reference so support can trace the ledger entry and provider status."
      >
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-3">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-subtle">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email
              </div>
              <a href={`mailto:${settings.support.email}`} className="mt-2 block text-sm font-semibold text-ink hover:text-brand-700 dark:hover:text-brand-300">
                {settings.support.email}
              </a>
              <p className="mt-1 text-xs leading-5 text-muted">Best for detailed issues and attachments.</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-subtle">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Phone
              </div>
              <a href={`tel:${settings.support.phone}`} className="mt-2 block text-sm font-semibold text-ink hover:text-brand-700 dark:hover:text-brand-300">
                {settings.support.phone}
              </a>
              <p className="mt-1 text-xs leading-5 text-muted">Call during published support hours.</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-subtle">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Support hours
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">{settings.support.hours}</p>
              <p className="mt-1 text-xs leading-5 text-muted">Response times can vary during provider incidents.</p>
            </Card>

            {isAuthenticated ? (
              <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <p className="text-sm font-semibold">Already signed in?</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Open a ticket from your dashboard to link the conversation to your account and transaction history.
                </p>
                <Link to="/dashboard/support" className={buttonStyles('outline', 'sm', 'mt-3')}>
                  Open a support ticket
                </Link>
              </div>
            ) : null}
          </div>

          <Card className="p-6">
            {sent ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-xl font-semibold">Message received</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{sent}</p>
                <button type="button" onClick={() => setSent(null)} className={buttonStyles('outline', 'sm', 'mt-5')}>
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Send a message</h2>
                <p className="mt-1 text-sm text-muted">We’ll reply using the email address you provide.</p>

                {error ? (
                  <Alert variant="danger" className="mt-4">
                    {error}
                  </Alert>
                ) : null}

                <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
                    <Input label="Email address" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
                  </div>
                  <Input
                    label="Phone number (optional)"
                    type="tel"
                    autoComplete="tel"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                  <Input label="Subject" error={errors.subject?.message} {...register('subject')} />
                  <Textarea
                    label="How can we help?"
                    placeholder="Include the transaction or funding reference if this is about a specific order."
                    error={errors.message?.message}
                    rows={6}
                    {...register('message')}
                  />
                  <Button type="submit" size="lg" className="w-full sm:w-auto" isLoading={isSubmitting} leftIcon={<Send className="h-4 w-4" />}>
                    Send message
                  </Button>
                  <p className="text-[11px] leading-5 text-subtle">
                    Do not include passwords, card details or one-time codes in your message.
                  </p>
                </form>
              </>
            )}
          </Card>
        </div>
      </SimplePageShell>
    </>
  );
}
