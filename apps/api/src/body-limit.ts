import type { Context, Next } from 'hono';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export function getMaxBodyBytes(): number {
  const parsed = Number(process.env.MAX_BODY_BYTES ?? DEFAULT_MAX_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BYTES;
}

export async function enforceBodyLimit(c: Context, next: Next): Promise<Response | void> {
  const maxBytes = getMaxBodyBytes();
  const contentLength = c.req.header('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    return c.json(
      { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE', max_bytes: maxBytes },
      413,
    );
  }

  await next();
}
