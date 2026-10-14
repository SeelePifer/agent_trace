import type { Context, Next } from 'hono';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getLimit(): number {
  const parsed = Number(process.env.INGEST_RATE_LIMIT_PER_MINUTE ?? 120);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
}

export async function ingestRateLimit(c: Context, next: Next): Promise<Response | void> {
  const key = c.req.header('x-forwarded-for') ?? c.req.header('authorization') ?? 'anonymous';
  const now = Date.now();
  const windowMs = 60_000;
  const limit = getLimit();

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    await next();
    return;
  }

  if (current.count >= limit) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        retry_after_seconds: Math.ceil((current.resetAt - now) / 1000),
      },
      429,
    );
  }

  current.count += 1;
  await next();
}
