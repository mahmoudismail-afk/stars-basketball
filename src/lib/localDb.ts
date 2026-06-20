import path from 'path';
import fs from 'fs';

// Finds the local Wrangler D1 SQLite file at runtime.
// Returns null if not found (fallback to mock data).
export function getLocalDb() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const d1Dir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
    if (!fs.existsSync(d1Dir)) return null;
    const files = fs.readdirSync(d1Dir).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
    if (files.length === 0) return null;
    const dbPath = path.join(d1Dir, files[0]);
    return new Database(dbPath, { readonly: false });
  } catch {
    return null;
  }
}
