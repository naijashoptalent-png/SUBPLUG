export interface PaymentInitializeInput {
  reference: string;
  email: string;
  amountMinor: number;
  currency: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitializeResult {
  authorizationUrl: string;
  accessCode?: string;
  gatewayReference: string;
  isSandbox: boolean;
}

export type PaymentVerificationOutcome = 'SUCCESSFUL' | 'FAILED' | 'PENDING' | 'UNCERTAIN';

export interface PaymentVerificationResult {
  outcome: PaymentVerificationOutcome;
  amountMinor?: number;
  currency?: string;
  gatewayReference?: string;
  paidAt?: Date;
  message?: string;
  raw?: unknown;
}

export interface WebhookValidationResult {
  valid: boolean;
  eventId: string;
  eventType: string;
  reference: string;
  payload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly key: string;
  readonly name: string;
  readonly isSandbox: boolean;
  /** Webhook event types that represent a completed payment attempt. */
  readonly paymentEventTypes: readonly string[];
  initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult>;
  verify(reference: string): Promise<PaymentVerificationResult>;
  parseWebhook(rawBody: Buffer | string, signature: string | undefined): WebhookValidationResult;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
