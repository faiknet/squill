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

    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const res = await client.query(`SELECT polname, polrelid::regclass::text AS table_name, polcmd,
      pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_catalog.pg_policy
      ORDER BY table_name;`);

    console.log('Policies in DB:');
    for (const row of res.rows) {
      console.log('---');
      console.log('policy:', row.polname);
      console.log('table :', row.table_name);
      console.log('cmd   :', row.polcmd);
      console.log('using :', row.using_expr);
      console.log('check :', row.with_check);
    }

    // Show policies specifically for campaigns and campaign_members
    const res2 = await client.query(`SELECT polname, polrelid::regclass::text AS table_name, polcmd,
      pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS with_check
      FROM pg_catalog.pg_policy
      WHERE polrelid::regclass::text IN ('public.campaigns','public.campaign_members')
      ORDER BY polrelid::regclass::text;`);

    console.log('\nSpecific policies for campaigns and campaign_members:');
    for (const row of res2.rows) {
      console.log('---');
      console.log('policy:', row.polname);
      console.log('table :', row.table_name);
      console.log('cmd   :', row.polcmd);
      console.log('using :', row.using_expr);
      console.log('check :', row.with_check);
    }

    await client.end();
    process.exit(0);
  }catch(err){
    console.error('Inspect failed:', err.message || err);
    process.exit(1);
  }
})();
