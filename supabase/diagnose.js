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
    const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
    }

    console.log('Testing database access...\n');

    // Test 1: Query with SERVICE ROLE (bypasses RLS)
    console.log('1. Testing with SERVICE ROLE KEY (bypasses RLS)...');
    const serviceRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?limit=1`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });
    
    console.log('   Status:', serviceRes.status);
    if (!serviceRes.ok) {
      const errorText = await serviceRes.text();
      console.log('   Error:', errorText);
    } else {
      const data = await serviceRes.json();
      console.log('   Success! Profiles count:', data.length);
    }

    // Test 2: Query campaigns with SERVICE ROLE
    console.log('\n2. Testing campaigns with SERVICE ROLE KEY...');
    const campaignsServiceRes = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?limit=1`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });
    
    console.log('   Status:', campaignsServiceRes.status);
    if (!campaignsServiceRes.ok) {
      const errorText = await campaignsServiceRes.text();
      console.log('   Error:', errorText);
    } else {
      const data = await campaignsServiceRes.json();
      console.log('   Success! Campaigns count:', data.length);
    }

    // Test 3: Query with ANON KEY (triggers RLS)
    console.log('\n3. Testing with ANON KEY (triggers RLS)...');
    const anonRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?limit=1`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    
    console.log('   Status:', anonRes.status);
    if (!anonRes.ok) {
      const errorText = await anonRes.text();
      console.log('   Error:', errorText);
    } else {
      const data = await anonRes.json();
      console.log('   Success! Profiles count:', data.length);
    }

    console.log('\n✓ Diagnostics complete');

  } catch (err) {
    console.error('\n✗ Diagnostic failed:', err.message || err);
    process.exit(1);
  }
})();
