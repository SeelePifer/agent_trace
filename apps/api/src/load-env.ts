import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = resolve(apiRoot, '../..');

const envFiles = [
  resolve(monorepoRoot, '.env'),
  resolve(monorepoRoot, '.env.local'),
  resolve(apiRoot, '.env'),
  resolve(apiRoot, '.env.local'),
];

for (const path of envFiles) {
  if (existsSync(path)) {
    config({ path, override: false });
  }
}
