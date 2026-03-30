import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

function loadDotEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let val = trimmed.slice(idx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

(async ()=>{
  try{
    const repoRoot = process.cwd();
    const envPath = path.join(repoRoot, '.env');
    if (!fs.existsSync(envPath)) throw new Error('.env not found');
    const env = loadDotEnv(envPath);
    const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');

    const projectHost = new URL(SUPABASE_URL).hostname.split('.')[0];
    const dbHost = `${projectHost}.db.supabase.co`;
    const connStr = `postgresql://postgres:${encodeURIComponent(SERVICE_ROLE_KEY)}@${dbHost}:5432/postgres`;

    console.log('Connecting to', dbHost);

    const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '20260327_fix_campaign_members_policy.sql');
    if (!fs.existsSync(migrationPath)) throw new Error('Migration file not found: ' + migrationPath);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('Connected. Executing migration...');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('Migration applied successfully.');
    await client.end();
    process.exit(0);
  }catch(err){
    console.error('Failed to apply migration:', err.message || err);
    process.exit(1);
  }
})();
