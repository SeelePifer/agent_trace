const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const API_KEY_RE = /\b(sk-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16})\b/g;

function redactString(value: string): string {
  return value
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(BEARER_RE, 'Bearer [REDACTED]')
    .replace(API_KEY_RE, '[REDACTED_SECRET]')
    .replace(PHONE_RE, '[REDACTED_PHONE]');
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      const lower = key.toLowerCase();
      if (['password', 'secret', 'token', 'authorization', 'api_key'].includes(lower)) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = redactValue(nested);
    }
    return out;
  }
  return value;
}

export function redactCapture(capture: unknown): unknown {
  return redactValue(capture);
}
