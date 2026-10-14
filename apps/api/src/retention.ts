import './load-env.js';
import { closePool, getPool } from './db.js';

async function runRetention(): Promise<void> {
  const days = Number(process.env.RETENTION_DAYS ?? 0);
  if (!Number.isFinite(days) || days <= 0) {
    console.log('RETENTION_DAYS not set or <= 0; retention job skipped.');
    await closePool();
    return;
  }

  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `WITH deleted AS (
      DELETE FROM runs
      WHERE created_at < NOW() - make_interval(days => $1)
      RETURNING id
    )
    SELECT COUNT(*)::text AS count FROM deleted`,
    [days],
  );

  const deleted = Number(result.rows[0]?.count ?? 0);
  console.log(`Retention: deleted ${deleted} run(s) older than ${days} day(s).`);
  await closePool();
}

runRetention().catch((error) => {
  console.error(error);
  process.exit(1);
});
