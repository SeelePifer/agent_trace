import 'dotenv/config';
import { configure, flush, run } from '@agenttrace/sdk';

configure({
  apiUrl: process.env.AGENTTRACE_API_URL ?? 'http://localhost:3001',
  apiKey: process.env.AGENTTRACE_API_KEY ?? 'dev-secret-change-me',
  capture: 'always',
  environment: 'dev',
});

const input = { question: 'What is the refund policy?' };

await run(
  { name: 'toy-agent', version: '1.0.0', input, tags: ['demo'] },
  async ({ withLlm, withTool }) => {
    const plan = await withLlm(
      {
        model: 'mock-gpt',
        provider: 'mock',
        messages: [{ role: 'user', content: input.question }],
      },
      async () => ({
        response: { tool: 'search_kb', args: { q: 'refund' } },
        usage: { input: 42, output: 12 },
      }),
    );

    const kb = await withTool('search_kb', { q: 'refund' }, async () => ({
      hits: [{ id: 'doc-1', snippet: 'Refunds within 30 days.' }],
    }));

    await withLlm(
      {
        model: 'mock-gpt',
        provider: 'mock',
        messages: [
          { role: 'user', content: input.question },
          { role: 'assistant', content: JSON.stringify(plan.response) },
        ],
      },
      async () => ({
        response: { answer: `Based on KB: ${kb.hits[0].snippet}` },
        usage: { input: 80, output: 24 },
      }),
    );

    return { ok: true };
  },
);

await flush();
console.log('Toy agent run ingested (v1.0.0).');
