// Quick check of database status via REST API
import fs from 'fs';
import path from 'path';

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

(async () => {
  try {
    const repoRoot = process.cwd();
    const envPath = path.join(repoRoot, '.env');
    if (!fs.existsSync(envPath)) throw new Error('.env not found');
    const env = loadDotEnv(envPath);
    
    const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
    }

    console.log('Checking database via REST API...\n');

    // Try to query profiles table
    const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?limit=1`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });
    
    console.log('Profiles query status:', profilesRes.status);
    if (!profilesRes.ok) {
      const errorText = await profilesRes.text();
      console.log('Profiles error:', errorText);
    } else {
      const data = await profilesRes.json();
      console.log('Profiles OK, count:', data.length);
    }

    // Try to query campaigns table
    const campaignsRes = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?limit=1`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });
    
    console.log('\nCampaigns query status:', campaignsRes.status);
    if (!campaignsRes.ok) {
      const errorText = await campaignsRes.text();
      console.log('Campaigns error:', errorText);
    } else {
      const data = await campaignsRes.json();
      console.log('Campaigns OK, count:', data.length);
    }

  } catch (err) {
    console.error('Check failed:', err.message || err);
    process.exit(1);
  }
})();
