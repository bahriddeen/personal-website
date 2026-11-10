// Load .env.local for the plain Node scripts (Next.js loads it by itself).
import { existsSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

/** Migrations and seeding prefer a direct (unpooled) connection when one is provided. */
export function databaseUrl() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
    process.exit(1);
  }
  return url;
}
