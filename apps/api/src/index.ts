import { serve } from '@hono/node-server';
import './load-env.js';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3001);
console.log(`AgentTrace API listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
