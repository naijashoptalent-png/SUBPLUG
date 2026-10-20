import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { postData } from '@/lib/api';
import { resetPasswordSchema, type ResetPasswordForm } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/errors';
import { PasswordInput } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <div className="animate-fade-up">
        <Helmet>
          <title>Invalid reset link — SubPlug</title>
        </Helmet>
        <Alert variant="danger" title="This reset link is incomplete">
          Request a new password reset email to continue.
        </Alert>
        <Link to="/forgot-password" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Request a new link
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: ResetPasswordForm) => {
    setError(null);
    try {
      await postData('/auth/reset-password', {
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>Choose a new password — SubPlug</title>
      </Helmet>

      <div className="mb-8">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted">
          Use at least 10 characters with uppercase, lowercase, a number and a symbol.
        </p>
      </div>

      {error ? (
        <Alert variant="danger" title="Could not reset your password" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
