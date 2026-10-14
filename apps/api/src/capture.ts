import { redactCapture } from '@agenttrace/shared';

export function shouldRedactCaptures(): boolean {
  return process.env.REDACT_CAPTURES !== 'false';
}

export function serializeCapture(capture: unknown | undefined): string | null {
  if (capture === undefined || capture === null) {
    return null;
  }
  const value = shouldRedactCaptures() ? redactCapture(capture) : capture;
  return JSON.stringify(value);
}
