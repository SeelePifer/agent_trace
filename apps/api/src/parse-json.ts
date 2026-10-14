import type { Context } from 'hono';
import { getMaxBodyBytes } from './body-limit.js';

function isTooLarge(byteLength: number): boolean {
  return byteLength > getMaxBodyBytes();
}

export async function parseJsonBody(c: Context): Promise<unknown | Response> {
  const text = await c.req.text();
  if (isTooLarge(Buffer.byteLength(text, 'utf8'))) {
    return c.json(
      { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE', max_bytes: getMaxBodyBytes() },
      413,
    );
  }
  if (!text.trim()) {
    return c.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, 400);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, 400);
  }
}

/** Allows empty body (defaults to {}). Use when all fields are optional. */
export async function parseJsonBodyOptional(c: Context): Promise<unknown | Response> {
  const text = await c.req.text();
  if (!text.trim()) {
    return {};
  }
  if (isTooLarge(Buffer.byteLength(text, 'utf8'))) {
    return c.json(
      { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE', max_bytes: getMaxBodyBytes() },
      413,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, 400);
  }
}
