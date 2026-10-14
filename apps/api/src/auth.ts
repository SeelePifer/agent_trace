import { timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';

function safeEqualToken(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function requireApiKey(c: Context, next: Next): Promise<Response | void> {
  const expected = process.env.AGENTTRACE_API_KEY;
  if (!expected) {
    return c.json(
      { error: 'Server misconfigured: AGENTTRACE_API_KEY missing', code: 'SERVER_MISCONFIGURED' },
      500,
    );
  }
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token || !safeEqualToken(token, expected)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }
  await next();
}
