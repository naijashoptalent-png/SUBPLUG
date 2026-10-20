import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, MailWarning, Send } from 'lucide-react';
import { postData } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';

type State = 'loading' | 'success' | 'error' | 'missing';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>(token ? 'loading' : 'missing');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    postData('/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch((err) => {
        setError(getErrorMessage(err));
        setState('error');
      });
  }, [token]);

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setIsResending(true);
    setResendMessage(null);
    try {
      const result = await postData<{ message: string; devVerificationUrl?: string }>(
        '/auth/resend-verification',
        { email }
      );
      setResendMessage(result.message);
      setDevUrl(result.devVerificationUrl ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>Verify your email — QuickTopUp</title>
      </Helmet>

      {state === 'loading' ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Spinner className="h-8 w-8" label="Verifying your email" />
          <h1 className="mt-4 text-2xl font-semibold">Verifying your email…</h1>
          <p className="mt-1.5 text-sm text-muted">This only takes a moment.</p>
        </div>
      ) : null}

      {state === 'success' ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">Email verified</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Your account is ready. Sign in to fund your wallet and make your first purchase.
          </p>
          <Link to="/login" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950">
            Continue to sign in
          </Link>
        </div>
      ) : null}

      {state === 'error' || state === 'missing' ? (
        <>
          <div className="mb-6">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-warning/10 text-warning">
              <MailWarning className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold">
              {state === 'missing' ? 'Verification link missing' : 'This link did not work'}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {state === 'missing'
                ? 'Open the verification link from your email, or request a new one below.'
                : error ?? 'The link may have expired or already been used.'}
            </p>
          </div>

          {resendMessage ? (
            <Alert variant="success" className="mb-5">
              {resendMessage}
              {devUrl ? (
                <>
                  {' '}
                  <a href={devUrl} className="font-semibold underline">
                    Open the development link
                  </a>
                  .
                </>
              ) : null}
            </Alert>
          ) : null}

          <form onSubmit={handleResend} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button type="submit" size="lg" className="w-full" isLoading={isResending} leftIcon={<Send className="h-4 w-4" />}>
              Send a new verification email
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            <Link to="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Back to sign in
            </Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
