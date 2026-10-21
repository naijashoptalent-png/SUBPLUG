import { useEffect, useState, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { RotateCcw, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminSettings, useSaveSetting } from '@/hooks/useAdmin';
import { formatNaira, parseNairaToMinor } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import type { SystemSettings } from '@/types';

type SettingKey = keyof SystemSettings;

const limitFields: Array<{ key: keyof SystemSettings['limits']; label: string; hint?: string }> = [
  { key: 'airtimeMinMinor', label: 'Airtime minimum per order' },
  { key: 'airtimeMaxMinor', label: 'Airtime maximum per order' },
  { key: 'dataMinMinor', label: 'Data minimum per order' },
  { key: 'dataMaxMinor', label: 'Data maximum per order' },
  { key: 'electricityMinMinor', label: 'Electricity minimum' },
  { key: 'electricityMaxMinor', label: 'Electricity maximum' },
  { key: 'cableMinMinor', label: 'Cable minimum' },
  { key: 'cableMaxMinor', label: 'Cable maximum' },
  { key: 'fundingMinMinor', label: 'Wallet funding minimum' },
  { key: 'fundingMaxMinor', label: 'Wallet funding maximum' },
  { key: 'manualReviewThresholdMinor', label: 'Manual review threshold', hint: 'Purchases at or above this value are held for review.' },
  { key: 'maxDailySpendMinor', label: 'Maximum daily spend', hint: 'Per customer, across all purchases.' },
];

/** Money input that keeps a friendly Naira string while storing integer kobo. */
function MoneyField({
  label,
  valueMinor,
  onChange,
  hint,
}: {
  label: string;
  valueMinor: number;
  onChange: (minor: number) => void;
  hint?: string;
}) {
  const [text, setText] = useState((valueMinor / 100).toString());

  useEffect(() => {
    setText((valueMinor / 100).toString());
  }, [valueMinor]);

  return (
    <Input
      label={label}
      inputMode="decimal"
      value={text}
      hint={hint ?? `${formatNaira(valueMinor, { decimals: true })} stored as ${valueMinor.toLocaleString('en-NG')} kobo`}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d.]/g, '');
        setText(next);
        const minor = parseNairaToMinor(next);
        if (minor !== null) onChange(minor);
      }}
    />
  );
}

function NumericField({
  label,
  value,
  onChange,
  hint,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <Input
      label={label}
      inputMode="decimal"
      value={text}
      hint={hint}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d.]/g, '');
        setText(next);
        const parsed = Number(next);
        if (next.trim() !== '' && Number.isFinite(parsed) && parsed >= min && (max === undefined || parsed <= max)) {
          onChange(parsed);
        }
      }}
    />
  );
}

function SectionCard({
  title,
  description,
  dirty,
  saving,
  onSave,
  note,
  children,
}: {
  title: string;
  description: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  note?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={title}
        description={description}
        action={dirty ? <Badge tone="warning">Unsaved</Badge> : <Badge tone="success">Saved</Badge>}
      />
      <div className="flex-1 space-y-4 p-5">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <p className="text-[11px] text-subtle">{note ?? 'Changes are audit-logged.'}</p>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!dirty}
          isLoading={saving}
          leftIcon={<Save className="h-3.5 w-3.5" />}
        >
          Save section
        </Button>
      </div>
    </Card>
  );
}

export function AdminSettingsPage() {
  const settingsQuery = useAdminSettings();
  const saveSetting = useSaveSetting();
  const [draft, setDraft] = useState<SystemSettings | null>(null);
  const [dirty, setDirty] = useState<Set<SettingKey>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(JSON.parse(JSON.stringify(settingsQuery.data)) as SystemSettings);
      setDirty(new Set());
    }
  }, [settingsQuery.data]);

  const edit = (key: SettingKey, updater: (current: SystemSettings) => SystemSettings) => {
    setDraft((current) => (current ? updater(current) : current));
    setDirty((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const isSaving = (key: SettingKey) => saveSetting.isPending && saveSetting.variables?.key === key;

  const commit = async (key: SettingKey) => {
    if (!draft) return;
    try {
      await saveSetting.mutateAsync({
        key,
        value: draft[key] as unknown as Record<string, unknown>,
        ...(key === 'maintenance' && draft.maintenance.enabled ? { confirm: 'ENABLE MAINTENANCE' } : {}),
      });
      setDirty((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setConfirmOpen(false);
      setConfirmText('');
      setConfirmError(null);
      toast.success('Settings saved');
    } catch (error) {
      const message = getErrorMessage(error);
      if (confirmOpen) setConfirmError(message);
      else toast.error(message);
    }
  };

  const requestSave = (key: SettingKey) => {
    if (!draft) return;
    const enablingMaintenance = key === 'maintenance' && draft.maintenance.enabled && !settingsQuery.data?.maintenance.enabled;
    if (enablingMaintenance) {
      setConfirmError(null);
      setConfirmText('');
      setConfirmOpen(true);
      return;
    }
    void commit(key);
  };

  const discard = () => {
    if (!settingsQuery.data) return;
    setDraft(JSON.parse(JSON.stringify(settingsQuery.data)) as SystemSettings);
    setDirty(new Set());
    toast.success('Draft reset to the saved settings');
  };

  if (settingsQuery.isLoading && !draft) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (settingsQuery.isError || !draft) {
    return (
      <Card>
        <ErrorState
          title="Settings could not load"
          description="The API may be unavailable, or your account may not have administrator access."
          onRetry={() => void settingsQuery.refetch()}
        />
      </Card>
    );
  }

  const hasUnsaved = dirty.size > 0;

  return (
    <>
      <Helmet>
        <title>System settings — SubPlug operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Platform"
        title="System settings"
        description="Branding, support contacts, limits, pricing, referrals, and notification behaviour. Each section saves independently and is audit-logged."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={discard}
            disabled={!hasUnsaved}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Discard changes
          </Button>
        }
      />

      {hasUnsaved ? (
        <Alert variant="warning" className="mt-5">
          You have unsaved changes in {dirty.size} section{dirty.size === 1 ? '' : 's'}. Save each section before leaving.
        </Alert>
      ) : null}

      <div className="mt-6 space-y-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard
            title="Branding"
            description="Public name, tagline, and contact details"
            dirty={dirty.has('branding')}
            saving={isSaving('branding')}
            onSave={() => requestSave('branding')}
          >
            <Input
              label="Brand name"
              value={draft.branding.name}
              onChange={(event) =>
                edit('branding', (current) => ({ ...current, branding: { ...current.branding, name: event.target.value } }))
              }
            />
            <Input
              label="Tagline"
              value={draft.branding.tagline}
              onChange={(event) =>
                edit('branding', (current) => ({ ...current, branding: { ...current.branding, tagline: event.target.value } }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Support email"
                type="email"
                value={draft.branding.supportEmail}
                onChange={(event) =>
                  edit('branding', (current) => ({
                    ...current,
                    branding: { ...current.branding, supportEmail: event.target.value },
                  }))
                }
              />
              <Input
                label="Support phone"
                value={draft.branding.supportPhone}
                onChange={(event) =>
                  edit('branding', (current) => ({
                    ...current,
                    branding: { ...current.branding, supportPhone: event.target.value },
                  }))
                }
              />
            </div>
            <div>
              <Input
                label="Primary colour"
                value={draft.branding.primaryColor}
                placeholder="#0f766e"
                onChange={(event) =>
                  edit('branding', (current) => ({
                    ...current,
                    branding: { ...current.branding, primaryColor: event.target.value },
                  }))
                }
              />
              <div className="mt-2 flex items-center gap-2 text-[11px] text-subtle">
                <span
                  className="h-5 w-5 rounded-md border border-line"
                  style={{ backgroundColor: draft.branding.primaryColor }}
                  aria-hidden="true"
                />
                Preview uses the configured colour value.
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Support contacts"
            description="Shown on public pages and ticket replies"
            dirty={dirty.has('support')}
            saving={isSaving('support')}
            onSave={() => requestSave('support')}
          >
            <Input
              label="Support email"
              type="email"
              value={draft.support.email}
              onChange={(event) =>
                edit('support', (current) => ({ ...current, support: { ...current.support, email: event.target.value } }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                value={draft.support.phone}
                onChange={(event) =>
                  edit('support', (current) => ({ ...current, support: { ...current.support, phone: event.target.value } }))
                }
              />
              <Input
                label="WhatsApp"
                value={draft.support.whatsapp}
                placeholder="+234..."
                onChange={(event) =>
                  edit('support', (current) => ({
                    ...current,
                    support: { ...current.support, whatsapp: event.target.value },
                  }))
                }
              />
            </div>
            <Input
              label="Support hours"
              value={draft.support.hours}
              onChange={(event) =>
                edit('support', (current) => ({ ...current, support: { ...current.support, hours: event.target.value } }))
              }
            />
          </SectionCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard
            title="Maintenance mode"
            description="Take the customer app offline while keeping staff access"
            dirty={dirty.has('maintenance')}
            saving={isSaving('maintenance')}
            onSave={() => requestSave('maintenance')}
            note="Enabling maintenance requires explicit confirmation."
          >
            {draft.maintenance.enabled ? (
              <Alert variant="warning" title="Maintenance mode is on">
                Customers are blocked from purchasing and funding while this is enabled.
              </Alert>
            ) : null}
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="maintenance-enabled"
                label="Enable maintenance mode"
                description="Blocks customer-facing purchases, funding, and registration."
                checked={draft.maintenance.enabled}
                onCheckedChange={(checked) =>
                  edit('maintenance', (current) => ({
                    ...current,
                    maintenance: { ...current.maintenance, enabled: checked },
                  }))
                }
              />
            </div>
            <Textarea
              label="Maintenance message"
              rows={3}
              value={draft.maintenance.message}
              onChange={(event) =>
                edit('maintenance', (current) => ({
                  ...current,
                  maintenance: { ...current.maintenance, message: event.target.value },
                }))
              }
            />
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="maintenance-admins"
                label="Allow administrators to bypass"
                description="Administrator and support sessions can still sign in and access operations."
                checked={draft.maintenance.allowAdmins}
                onCheckedChange={(checked) =>
                  edit('maintenance', (current) => ({
                    ...current,
                    maintenance: { ...current.maintenance, allowAdmins: checked },
                  }))
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Registration"
            description="Sign-up availability and referral controls"
            dirty={dirty.has('registration')}
            saving={isSaving('registration')}
            onSave={() => requestSave('registration')}
          >
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="registration-enabled"
                label="Allow new registrations"
                description="Turning this off closes public sign-up."
                checked={draft.registration.enabled}
                onCheckedChange={(checked) =>
                  edit('registration', (current) => ({
                    ...current,
                    registration: { ...current.registration, enabled: checked },
                  }))
                }
              />
            </div>
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="registration-phone"
                label="Require phone verification"
                description="Adds a phone verification step before purchases."
                checked={draft.registration.requirePhoneVerification}
                onCheckedChange={(checked) =>
                  edit('registration', (current) => ({
                    ...current,
                    registration: { ...current.registration, requirePhoneVerification: checked },
                  }))
                }
              />
            </div>
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="registration-referrals"
                label="Allow referrals"
                description="Customers can share referral codes and earn rewards."
                checked={draft.registration.allowReferrals}
                onCheckedChange={(checked) =>
                  edit('registration', (current) => ({
                    ...current,
                    registration: { ...current.registration, allowReferrals: checked },
                  }))
                }
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Transaction and wallet limits"
          description="Enforced server-side on every quote and purchase"
          dirty={dirty.has('limits')}
          saving={isSaving('limits')}
          onSave={() => requestSave('limits')}
          note="Amounts are entered in Naira and stored as integer kobo."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {limitFields.map((field) => (
              <MoneyField
                key={field.key}
                label={field.label}
                valueMinor={draft.limits[field.key] ?? 0}
                hint={field.hint}
                onChange={(minor) =>
                  edit('limits', (current) => ({
                    ...current,
                    limits: { ...current.limits, [field.key]: minor },
                  }))
                }
              />
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard
            title="Discounts and fees"
            description="Airtime discount per network and service fee"
            dirty={dirty.has('discounts')}
            saving={isSaving('discounts')}
            onSave={() => requestSave('discounts')}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(draft.discounts.airtimePercent).map(([network, percent]) => (
                <NumericField
                  key={network}
                  label={`${network} discount (%)`}
                  value={percent}
                  min={0}
                  max={100}
                  hint="Percentage off the face value."
                  onChange={(value) =>
                    edit('discounts', (current) => ({
                      ...current,
                      discounts: {
                        ...current.discounts,
                        airtimePercent: { ...current.discounts.airtimePercent, [network]: value },
                      },
                    }))
                  }
                />
              ))}
            </div>
            <NumericField
              label="Service fee (%)"
              value={draft.discounts.serviceFeePercent}
              min={0}
              max={100}
              hint="Applied to purchases that support a percentage fee."
              onChange={(value) =>
                edit('discounts', (current) => ({
                  ...current,
                  discounts: { ...current.discounts, serviceFeePercent: value },
                }))
              }
            />
          </SectionCard>

          <SectionCard
            title="Pricing"
            description="Markups, fixed fees, and manual price protection"
            dirty={dirty.has('pricing')}
            saving={isSaving('pricing')}
            onSave={() => requestSave('pricing')}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumericField
                label="Data markup (%)"
                value={draft.pricing.dataMarkupPercent}
                min={0}
                max={100}
                onChange={(value) =>
                  edit('pricing', (current) => ({ ...current, pricing: { ...current.pricing, dataMarkupPercent: value } }))
                }
              />
              <NumericField
                label="Cable markup (%)"
                value={draft.pricing.cableMarkupPercent}
                min={0}
                max={100}
                onChange={(value) =>
                  edit('pricing', (current) => ({ ...current, pricing: { ...current.pricing, cableMarkupPercent: value } }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                label="Electricity fee"
                valueMinor={draft.pricing.electricityFeeMinor}
                onChange={(minor) =>
                  edit('pricing', (current) => ({
                    ...current,
                    pricing: { ...current.pricing, electricityFeeMinor: minor },
                  }))
                }
              />
              <MoneyField
                label="Cable fee"
                valueMinor={draft.pricing.cableFeeMinor}
                onChange={(minor) =>
                  edit('pricing', (current) => ({ ...current, pricing: { ...current.pricing, cableFeeMinor: minor } }))
                }
              />
            </div>
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="pricing-manual"
                label="Preserve manual plan pricing"
                description="Catalogue syncs update provider cost but keep prices you set manually."
                checked={draft.pricing.preserveManualPlanPricing}
                onCheckedChange={(checked) =>
                  edit('pricing', (current) => ({
                    ...current,
                    pricing: { ...current.pricing, preserveManualPlanPricing: checked },
                  }))
                }
              />
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard
            title="Referrals"
            description="Reward rules for customer referrals"
            dirty={dirty.has('referrals')}
            saving={isSaving('referrals')}
            onSave={() => requestSave('referrals')}
          >
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="referrals-enabled"
                label="Enable referral rewards"
                description="Rewards are credited only after a qualifying purchase."
                checked={draft.referrals.enabled}
                onCheckedChange={(checked) =>
                  edit('referrals', (current) => ({ ...current, referrals: { ...current.referrals, enabled: checked } }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                label="Reward amount"
                valueMinor={draft.referrals.rewardMinor}
                onChange={(minor) =>
                  edit('referrals', (current) => ({ ...current, referrals: { ...current.referrals, rewardMinor: minor } }))
                }
              />
              <MoneyField
                label="Qualifying purchase"
                valueMinor={draft.referrals.qualifyingPurchaseMinor}
                onChange={(minor) =>
                  edit('referrals', (current) => ({
                    ...current,
                    referrals: { ...current.referrals, qualifyingPurchaseMinor: minor },
                  }))
                }
              />
            </div>
            <NumericField
              label="Maximum referrals per customer"
              value={draft.referrals.maxReferralsPerUser}
              min={0}
              onChange={(value) =>
                edit('referrals', (current) => ({
                  ...current,
                  referrals: { ...current.referrals, maxReferralsPerUser: Math.round(value) },
                }))
              }
            />
          </SectionCard>

          <SectionCard
            title="Notifications"
            description="Operational and customer notification channels"
            dirty={dirty.has('notifications')}
            saving={isSaving('notifications')}
            onSave={() => requestSave('notifications')}
            note="Email delivery depends on configured SMTP credentials."
          >
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="notifications-purchase-email"
                label="Email on purchase"
                description="Send a receipt after a purchase reaches a final state."
                checked={draft.notifications.emailOnPurchase}
                onCheckedChange={(checked) =>
                  edit('notifications', (current) => ({
                    ...current,
                    notifications: { ...current.notifications, emailOnPurchase: checked },
                  }))
                }
              />
            </div>
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="notifications-funding-email"
                label="Email on wallet funding"
                description="Send a confirmation after a verified funding is credited."
                checked={draft.notifications.emailOnFunding}
                onCheckedChange={(checked) =>
                  edit('notifications', (current) => ({
                    ...current,
                    notifications: { ...current.notifications, emailOnFunding: checked },
                  }))
                }
              />
            </div>
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="notifications-purchase-sms"
                label="SMS on purchase"
                description="Requires an SMS provider; leave off until one is configured."
                checked={draft.notifications.smsOnPurchase}
                onCheckedChange={(checked) =>
                  edit('notifications', (current) => ({
                    ...current,
                    notifications: { ...current.notifications, smsOnPurchase: checked },
                  }))
                }
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-line bg-raised px-4 py-3 text-[11px] leading-5 text-muted">
        <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
        <p>
          Settings are cached for 15 seconds; a saved change may take a moment to affect public pages. Financial limits
          are always read from the server before a purchase, not from the browser.
        </p>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!saveSetting.isPending) setConfirmOpen(open);
        }}
        title="Enable maintenance mode?"
        description="Customers will be unable to sign in, fund wallets, or purchase services until maintenance mode is disabled."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saveSetting.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void commit('maintenance')}
              isLoading={saveSetting.isPending}
              disabled={confirmText.trim().toUpperCase() !== 'ENABLE MAINTENANCE'}
            >
              Enable maintenance
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {confirmError ? <Alert variant="danger">{confirmError}</Alert> : null}
          <Alert variant="warning">
            Only enable this when you are ready to block customer activity. Staff can continue using the operations
            console when administrator bypass is on.
          </Alert>
          <Input
            label="Type ENABLE MAINTENANCE to confirm"
            value={confirmText}
            placeholder="ENABLE MAINTENANCE"
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
          />
        </div>
      </Dialog>
    </>
  );
}
