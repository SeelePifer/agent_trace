export interface PgErrorShape {
  code: string;
  detail?: string;
  constraint?: string;
  table?: string;
}

export function getPgError(error: unknown): PgErrorShape | null {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }
  const record = error as PgErrorShape;
  if (typeof record.code !== 'string') {
    return null;
  }
  return record;
}

/** Postgres unique_violation */
export function isUniqueViolation(error: unknown): boolean {
  return getPgError(error)?.code === '23505';
}

export function logServerError(error: unknown, context: { method: string; path: string }): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const pg = getPgError(error);

  console.error('[agenttrace-api]', {
    ...context,
    message,
    pgCode: pg?.code,
    pgConstraint: pg?.constraint,
    stack,
  });
}

export function publicErrorBody(
  error: unknown,
  fallbackMessage = 'Internal server error',
): { error: string; code?: string } {
  if (error instanceof Error && error.message && process.env.NODE_ENV !== 'production') {
    return { error: fallbackMessage, code: 'INTERNAL_ERROR' };
  }
  return { error: fallbackMessage, code: 'INTERNAL_ERROR' };
}
