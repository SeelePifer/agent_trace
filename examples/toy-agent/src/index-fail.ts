import 'dotenv/config';
import { configure, flush, run } from '@agenttrace/sdk';

configure({
  apiUrl: process.env.AGENTTRACE_API_URL ?? 'http://localhost:3001',
  apiKey: process.env.AGENTTRACE_API_KEY ?? 'dev-secret-change-me',
  capture: 'always',
  environment: 'dev',
});

const input = { question: 'What is the refund policy?' };

try {
  await run(
    { name: 'toy-agent', version: '1.1.0', input, tags: ['demo', 'failure'] },
    async ({ withLlm, withTool }) => {
      await withLlm(
        {
          model: 'mock-gpt',
          provider: 'mock',
          messages: [{ role: 'user', content: input.question }],
        },
        async () => ({
          response: { tool: 'search_kb', args: { q: 'refund' } },
          usage: { input: 40, output: 10 },
        }),
      );

      await withTool('search_kb', { q: 'refund' }, async () => {
        throw new Error('KB timeout');
      });
    },
  );
} catch {
  // expected
}

await flush();
console.log('Failed toy agent run ingested (v1.1.0).');
