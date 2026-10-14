export function getCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}
