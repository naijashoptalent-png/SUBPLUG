import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from 'date-fns';

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const nairaDecimalFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats integer kobo into Naira. Kobo are hidden unless present. */
export function formatNaira(minor: number | null | undefined, options?: { decimals?: boolean; sign?: boolean }) {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '—';
  const naira = minor / 100;
  const hasKobo = Math.abs(minor % 100) > 0;
  const body = options?.decimals || hasKobo ? nairaDecimalFormatter.format(naira) : nairaFormatter.format(naira);
  if (options?.sign && minor > 0) return `+${body}`;
  return body;
}

export function formatNairaCompact(minor: number | null | undefined) {
  if (minor === null || minor === undefined) return '—';
  const naira = minor / 100;
  if (Math.abs(naira) >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (Math.abs(naira) >= 1_000) return `₦${(naira / 1_000).toFixed(naira >= 10_000 ? 0 : 1)}k`;
  return `₦${Math.round(naira)}`;
}

export function parseNairaToMinor(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '');
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-NG').format(value);
}

export function formatDate(value: string | Date | null | undefined, pattern = 'd MMM yyyy') {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, pattern);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, "d MMM yyyy 'at' h:mm a");
}

export function formatRelative(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;
  if (Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return `${formatDistanceToNowStrict(date)} ago`;
  }
  return format(date, 'd MMM yyyy');
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return '—';
  const local = phone.startsWith('+234') ? `0${phone.slice(4)}` : phone;
  if (local.length === 11) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return local;
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return '—';
  const local = phone.startsWith('+234') ? `0${phone.slice(4)}` : phone;
  return `${local.slice(0, 4)} ••• ${local.slice(-4)}`;
}

export function formatMonthDay(value: string) {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'd MMM');
}

export const SERVICE_LABELS = {
  AIRTIME: 'Airtime',
  DATA: 'Mobile data',
  ELECTRICITY: 'Electricity',
  CABLE: 'Cable TV',
} as const;

export const STATUS_LABELS = {
  CREATED: 'Created',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SUCCESSFUL: 'Successful',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
  REFUNDED: 'Refunded',
  REQUIRES_REVIEW: 'In review',
  ABANDONED: 'Abandoned',
} as const;

export const LEDGER_LABELS = {
  FUNDING_CREDIT: 'Wallet funding',
  PURCHASE_DEBIT: 'Purchase',
  REFUND: 'Refund',
  ADJUSTMENT_CREDIT: 'Adjustment credit',
  ADJUSTMENT_DEBIT: 'Adjustment debit',
  REFERRAL_REWARD: 'Referral reward',
  REVERSAL: 'Reversal',
} as const;
