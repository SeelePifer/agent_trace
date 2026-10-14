import { describe, expect, it } from 'vitest';
import { redactCapture } from './redact.js';

describe('redactCapture', () => {
  it('redacts emails and secret keys', () => {
    const result = redactCapture({
      tool: {
        name: 'email',
        arguments: { to: 'user@example.com', api_key: 'sk-abcdefghijklmnop' },
      },
    }) as { tool: { arguments: Record<string, string> } };

    expect(result.tool.arguments.to).toBe('[REDACTED_EMAIL]');
    expect(result.tool.arguments.api_key).toBe('[REDACTED]');
  });
});
