/**
 * Supported wallet-funding gateways. The keys are persisted on WalletFunding and
 * on PaymentEvent, so they must remain stable.
 */
export const PAYMENT_GATEWAY_KEYS = ['mock', 'paystack', 'flutterwave'] as const;

export type PaymentGatewayKey = (typeof PAYMENT_GATEWAY_KEYS)[number];

export function isPaymentGatewayKey(value: string): value is PaymentGatewayKey {
  return (PAYMENT_GATEWAY_KEYS as readonly string[]).includes(value);
}

/** Parses the comma-separated PAYMENT_GATEWAYS setting. */
export function parsePaymentGatewayList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
