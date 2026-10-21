import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, PasswordInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Dialog } from '@/components/ui/Dialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { useAuth } from '@/hooks/useAuth';
import {
  useChangePassword,
  useDisableTwoFactor,
  useEnableTwoFactor,
  useSetupTwoFactor,
  useUpdateProfile,
  type TwoFactorSetup,
} from '@/hooks/useAccount';
import { changePasswordSchema, profileSchema, type ChangePasswordForm, type ProfileForm } from '@/lib/schemas';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

export function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const setupTwoFactor = useSetupTwoFactor();
  const enableTwoFactor = useEnableTwoFactor();
  const disableTwoFactor = useDisableTwoFactor();

  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [enableCode, setEnableCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName ?? '', phone: user?.phone ?? '' },
  });
  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({ fullName: user.fullName, phone: user.phone });
    }
  }, [user, profileForm]);

  const saveProfile = profileForm.handleSubmit(async (values) => {
    setProfileError(null);
    try {
      await updateProfile.mutateAsync(values);
      toast.success('Profile updated');
    } catch (err) {
      setProfileError(getErrorMessage(err));
    }
  });

  const savePassword = passwordForm.handleSubmit(async (values) => {
    setPasswordError(null);
    try {
      await changePassword.mutateAsync(values);
      toast.success('Password changed. Please sign in again.');
      await logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    }
  });

  const startTwoFactor = async () => {
    setTwoFactorError(null);
    try {
      const result = await setupTwoFactor.mutateAsync();
      setSetup(result);
      setEnableCode('');
      setSetupOpen(true);
    } catch (err) {
      setTwoFactorError(getErrorMessage(err));
    }
  };

  const confirmEnable = async () => {
    setTwoFactorError(null);
    if (!/^\d{6}$/.test(enableCode)) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      await enableTwoFactor.mutateAsync({ code: enableCode });
      await refreshUser();
      setSetupOpen(false);
      setSetup(null);
      toast.success('Two-factor authentication enabled');
    } catch (err) {
      setTwoFactorError(getErrorMessage(err));
    }
  };

  const confirmDisable = async () => {
    setTwoFactorError(null);
    if (!/^\d{6}$/.test(disableCode) || !disablePassword) {
      setTwoFactorError('Enter your current password and the 6-digit authenticator code.');
      return;
    }
    try {
      await disableTwoFactor.mutateAsync({ code: disableCode, password: disablePassword });
      toast.success('Two-factor authentication disabled. Please sign in again.');
      await logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (err) {
      setTwoFactorError(getErrorMessage(err));
    }
  };

  return (
    <>
      <Helmet>
        <title>Settings — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, password, and sign-in security."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Profile" description="Your name and phone number appear on receipts and support tickets." />
            <form onSubmit={saveProfile} className="space-y-4 p-5 sm:p-6" noValidate>
              {profileError ? <Alert variant="danger">{profileError}</Alert> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  autoComplete="name"
                  error={profileForm.formState.errors.fullName?.message}
                  {...profileForm.register('fullName')}
                />
                <Input
                  label="Phone number"
                  type="tel"
                  autoComplete="tel"
                  error={profileForm.formState.errors.phone?.message}
                  {...profileForm.register('phone')}
                />
              </div>
              <Input label="Email address" value={user?.email ?? ''} disabled hint="Email changes require support verification." />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  isLoading={updateProfile.isPending}
                  disabled={!profileForm.formState.isDirty}
                >
                  Save profile
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Password" description="Changing your password signs out every session." />
            <form onSubmit={savePassword} className="space-y-4 p-5 sm:p-6" noValidate>
              {passwordError ? <Alert variant="danger">{passwordError}</Alert> : null}
              <PasswordInput
                label="Current password"
                autoComplete="current-password"
                error={passwordForm.formState.errors.currentPassword?.message}
                {...passwordForm.register('currentPassword')}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <PasswordInput
                  label="New password"
                  autoComplete="new-password"
                  hint="At least 10 characters with upper, lower, number, and symbol."
                  error={passwordForm.formState.errors.newPassword?.message}
                  {...passwordForm.register('newPassword')}
                />
                <PasswordInput
                  label="Confirm new password"
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register('confirmPassword')}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  isLoading={changePassword.isPending}
                  leftIcon={<KeyRound className="h-4 w-4" />}
                >
                  Change password
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Account" />
            <div className="p-5">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Full name', value: user?.fullName ?? '—' },
                  { label: 'Email', value: user?.email ?? '—' },
                  { label: 'Phone', value: user?.phone ?? '—' },
                  {
                    label: 'Account status',
                    value: user ? <StatusBadge status={user.status} /> : '—',
                  },
                  { label: 'Member since', value: formatDate(user?.createdAt) },
                  { label: 'Referral code', value: <span className="font-mono text-xs">{user?.referralCode ?? '—'}</span> },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Two-factor authentication"
              description="Protect your account with an authenticator app."
              action={
                user?.twoFactorEnabled ? (
                  <Badge tone="success">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" /> On
                  </Badge>
                ) : (
                  <Badge tone="neutral">Off</Badge>
                )
              }
            />
            <div className="p-5">
              {twoFactorError && !setupOpen && !disableOpen ? (
                <Alert variant="danger" className="mb-4">
                  {twoFactorError}
                </Alert>
              ) : null}
              {user?.twoFactorEnabled ? (
                <>
                  <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success/10 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <p className="text-xs leading-6 text-muted">
                      Two-factor authentication is active. You will need a 6-digit code from your authenticator app when
                      signing in.
                    </p>
                  </div>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => setDisableOpen(true)}>
                    Disable two-factor
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                    <p className="text-xs leading-6 text-muted">
                      Use Google Authenticator, Authy, or another TOTP app. Setup takes about a minute and protects against
                      stolen passwords.
                    </p>
                  </div>
                  <Button
                    className="mt-4 w-full"
                    onClick={() => void startTwoFactor()}
                    isLoading={setupTwoFactor.isPending}
                    leftIcon={<LockKeyhole className="h-4 w-4" />}
                  >
                    Set up two-factor
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Laptop className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Session security</p>
                <p className="mt-1 text-xs leading-6 text-muted">
                  Refresh tokens rotate on use. Reuse of an old token revokes the session. Password changes and disabling
                  two-factor sign out all devices.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={setupOpen}
        onOpenChange={(open) => {
          setSetupOpen(open);
          if (!open) setTwoFactorError(null);
        }}
        title="Set up two-factor authentication"
        description="Scan the QR code, then enter a code to confirm."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSetupOpen(false)} disabled={enableTwoFactor.isPending}>
              Cancel
            </Button>
            <Button onClick={() => void confirmEnable()} isLoading={enableTwoFactor.isPending}>
              Enable two-factor
            </Button>
          </>
        }
      >
        {setup ? (
          <div className="space-y-4">
            {twoFactorError ? <Alert variant="danger">{twoFactorError}</Alert> : null}
            <div className="flex justify-center rounded-2xl border border-line bg-white p-4">
              <img src={setup.qrCodeDataUrl} alt="Authenticator QR code" className="h-48 w-48" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Manual entry key</p>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{setup.secret}</code>
                <CopyButton value={setup.secret} />
              </div>
            </div>
            <Input
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={enableCode}
              onChange={(event) => setEnableCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              leading={<Smartphone className="h-4 w-4" />}
            />
            <p className="text-[11px] leading-5 text-subtle">
              Store the manual key somewhere safe. If you lose your authenticator and recovery options, contact support.
            </p>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={disableOpen}
        onOpenChange={(open) => {
          setDisableOpen(open);
          if (!open) {
            setDisableCode('');
            setDisablePassword('');
            setTwoFactorError(null);
          }
        }}
        title="Disable two-factor authentication"
        description="This reduces your account security. Confirm with your password and current authenticator code."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisableOpen(false)} disabled={disableTwoFactor.isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDisable()} isLoading={disableTwoFactor.isPending}>
              Disable two-factor
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {twoFactorError ? <Alert variant="danger">{twoFactorError}</Alert> : null}
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={disablePassword}
            onChange={(event) => setDisablePassword(event.target.value)}
          />
          <Input
            label="6-digit authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={disableCode}
            onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <p className="flex items-start gap-2 text-[11px] leading-5 text-subtle">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            All existing sessions are signed out after disabling two-factor.
          </p>
        </div>
      </Dialog>
    </>
  );
}
