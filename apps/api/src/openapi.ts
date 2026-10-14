export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'AgentTrace API',
    version: '0.1.0',
    description: 'Ingest, query, compare, and replay agent execution traces.',
  },
  servers: [{ url: 'http://localhost:3001' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        security: [],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/v1/runs': {
      post: {
        summary: 'Ingest a completed run',
        responses: {
          '201': { description: 'Run created' },
          '400': { description: 'Validation error' },
          '409': { description: 'Duplicate trace_id' },
          '413': { description: 'Payload too large' },
          '429': { description: 'Rate limited' },
        },
      },
      get: {
        summary: 'List runs',
        responses: { '200': { description: 'Run list' } },
      },
    },
    '/v1/runs/stream': {
      post: {
        summary: 'Stream span batches for a long run',
        description: 'Upserts spans by trace_id. Set final=true on the last chunk.',
        responses: {
          '200': { description: 'Chunk accepted' },
          '201': { description: 'Run created' },
        },
      },
    },
    '/v1/runs/{runId}': {
      get: {
        summary: 'Get run with span tree',
        parameters: [{ name: 'runId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Run detail' }, '404': { description: 'Not found' } },
      },
    },
    '/v1/compare': {
      post: { summary: 'Compare two agent versions for the same input_hash' },
    },
    '/v1/replay/{runId}': {
      post: { summary: 'Playback captured spans from a run' },
    },
  },
} as const;
