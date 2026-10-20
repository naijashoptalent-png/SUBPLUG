import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/hooks/useAuth';
import { twoFactorCodeSchema } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/errors';

interface LocationState {
  challengeToken?: string;
  redirect?: string | null;
}

type TwoFactorForm = { code: string };

export function TwoFactorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeTwoFactor } = useAuth();
  const state = (location.state ?? {}) as LocationState;
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TwoFactorForm>({
    resolver: zodResolver(twoFactorCodeSchema),
    defaultValues: { code: '' },
  });

  if (!state.challengeToken) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = async (values: TwoFactorForm) => {
    setError(null);
    try {
      const user = await completeTwoFactor({ challengeToken: state.challengeToken!, code: values.code });
      toast.success('Two-factor check complete');
      const destination = state.redirect && state.redirect.startsWith('/') ? state.redirect : user.role === 'CUSTOMER' ? '/dashboard' : '/admin';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>Two-factor verification — SubPlug</title>
      </Helmet>

      <div className="mb-8">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Enter your authenticator code</h1>
        <p className="mt-1.5 text-sm text-muted">
          Open your authenticator app and enter the current 6-digit code for SubPlug.
        </p>
      </div>

      {error ? (
        <Alert variant="danger" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="text-center text-2xl font-semibold tracking-[0.35em]"
          error={errors.code?.message}
          autoFocus
          {...register('code')}
        />
        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Verify and continue
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Lost access to your authenticator?{' '}
        <Link to="/contact" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Contact support
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-subtle">
        <Link to="/login" className="hover:text-ink">
          Start over
        </Link>
      </p>
    </div>
  );
}
