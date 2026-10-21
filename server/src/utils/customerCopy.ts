const PROVIDER_NAME_PATTERN = /\b(maskawasub|maskawa\s*sub|maskawa|sme\s*api|smeapi|sme)\b/gi;

/**
 * Removes VTU provider names from customer-facing copy. Live provider response
 * messages are still not returned verbatim; this is a defensive layer for
 * validation messages and legacy records.
 */
export function sanitiseCustomerCopy(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(PROVIDER_NAME_PATTERN, 'provider').replace(/\s+/g, ' ').trim();
}
