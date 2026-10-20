import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { postData } from '@/lib/api';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/errors';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordForm) => {
    setError(null);
    try {
      const result = await postData<{ message: string; devResetUrl?: string }>('/auth/forgot-password', values);
      setMessage(result.message);
      setDevResetUrl(result.devResetUrl ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>Reset your password — SubPlug</title>
      </Helmet>

      <div className="mb-8">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter the email on your account. If it exists, we’ll send a reset link that expires in one hour.
        </p>
      </div>

      {message ? (
        <div className="space-y-4">
          <Alert variant="success" title="Check your inbox">
            {message}
          </Alert>
          {devResetUrl ? (
            <Alert variant="warning" title="Development mode">
              Email delivery is disabled locally. Use this one-time link:{' '}
              <a href={devResetUrl} className="break-all font-semibold underline">
                reset your password
              </a>
              .
            </Alert>
          ) : null}
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {error ? (
            <Alert variant="danger" className="mb-5">
              {error}
            </Alert>
          ) : null}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
              Send reset link
            </Button>
          </form>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}
