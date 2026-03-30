import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

async function pause(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async ()=>{
  try{
    const repoRoot = path.resolve(process.cwd());
    const envPath = path.join(repoRoot, '.env');
    if (!fs.existsSync(envPath)){
      console.error('ERROR: .env file not found at', envPath);
      process.exit(2);
    }
    const env = loadDotEnv(envPath);
    const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE;
    const ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY){
      console.error('ERROR: Missing SUPABASE_URL or keys in .env. Check SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
      process.exit(3);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    console.log('Creating test users (GM, member, outsider) via admin API...');

    const rand = Math.random().toString(36).slice(2,8);
    const gmEmail = `smoke-gm+${rand}@example.com`;
    const memberEmail = `smoke-member+${rand}@example.com`;
    const outEmail = `smoke-out+${rand}@example.com`;
    const password = 'Testpass1!';

    // Create users using admin API (with defensive checks)
    let gmRes = await admin.auth.admin.createUser({ email: gmEmail, password, email_confirm: true });
    if (gmRes.error) throw new Error('admin.createUser(gm) failed: ' + (gmRes.error.message || JSON.stringify(gmRes.error)));
    const gmUser = gmRes.user || gmRes.data?.user || gmRes.data;
    if (!gmUser || !gmUser.id) throw new Error('Unexpected gm create response: ' + JSON.stringify(Object.keys(gmRes)));

    let memberRes = await admin.auth.admin.createUser({ email: memberEmail, password, email_confirm: true });
    if (memberRes.error) throw new Error('admin.createUser(member) failed: ' + (memberRes.error.message || JSON.stringify(memberRes.error)));
    const memberUser = memberRes.user || memberRes.data?.user || memberRes.data;
    if (!memberUser || !memberUser.id) throw new Error('Unexpected member create response');

    let outRes = await admin.auth.admin.createUser({ email: outEmail, password, email_confirm: true });
    if (outRes.error) throw new Error('admin.createUser(out) failed: ' + (outRes.error.message || JSON.stringify(outRes.error)));
    const outUser = outRes.user || outRes.data?.user || outRes.data;
    if (!outUser || !outUser.id) throw new Error('Unexpected out create response');

    const gmId = gmUser.id;
    const memberId = memberUser.id;
    const outId = outUser.id;

    console.log('Users created. Signing in to obtain access tokens...');

    const gmSign = await anon.auth.signInWithPassword({ email: gmEmail, password });
    const memberSign = await anon.auth.signInWithPassword({ email: memberEmail, password });
    const outSign = await anon.auth.signInWithPassword({ email: outEmail, password });

    if (gmSign.error) throw new Error('gm signIn failed: ' + gmSign.error.message);
    if (memberSign.error) throw new Error('member signIn failed: ' + memberSign.error.message);
    if (outSign.error) throw new Error('out signIn failed: ' + outSign.error.message);

    const gmToken = gmSign.data?.session?.access_token || gmSign.session?.access_token;
    const memberToken = memberSign.data?.session?.access_token || memberSign.session?.access_token;
    const outToken = outSign.data?.session?.access_token || outSign.session?.access_token;

    if (!gmToken || !memberToken || !outToken) throw new Error('Failed to obtain one or more access tokens');

    const gmClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${gmToken}` } } });
    const memberClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${memberToken}` } } });
    const outClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${outToken}` } } });

    console.log('Creating campaign via admin (service role) to avoid RLS recursion at creation time...');
    const createCamp = await admin.from('campaigns').insert({ name: 'Smoke Test Campaign', created_by: gmId }).select().single();
    if (createCamp.error) throw createCamp.error;
    const campaign = createCamp.data;

    console.log('Admin created campaign:', campaign.id);

    console.log('Admin adds member to campaign (bypass RLS for setup)...');
    const addMember = await admin.from('campaign_members').insert({ campaign_id: campaign.id, user_id: memberId });
    if (addMember.error) throw addMember.error;

    console.log('Admin creates a session in campaign (bypass RLS for setup)...');
    const createSession = await admin.from('sessions').insert({ name: 'Smoke Session', campaign_id: campaign.id }).select().single();
    if (createSession.error) throw createSession.error;
    const session = createSession.data;

    console.log('Admin inserting a note for the session (bypass RLS for setup)...');
    const lbId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'lb-' + Math.random().toString(36).slice(2,10);
    const insertNote = await admin.from('session_notes').insert({ session_id: session.id, content_md: '# Hello from member', liveblocks_id: lbId }).select().single();
    if (insertNote.error) throw insertNote.error;

    // Outsider tries to read campaign (should not see it)
    console.log('Outsider attempting to read campaigns (should NOT see the smoke campaign)...');
    const outCamp = await outClient.from('campaigns').select('id, name').eq('id', campaign.id);
    if (outCamp.error) throw outCamp.error;
    const outCanSee = (outCamp.data && outCamp.data.length>0);

    // Outsider attempts to read session notes (should not see)
    const outNotes = await outClient.from('session_notes').select('*').eq('session_id', session.id);

    // Confirm user_preferences not globally public
    const prefsAll = await outClient.from('user_preferences').select('*').limit(10);

    console.log('\n--- Results ---');
    console.log('Outsider can see campaign?:', outCanSee ? 'YES (FAIL)' : 'NO (PASS)');
    console.log('Outsider can see notes count:', Array.isArray(outNotes.data) ? outNotes.data.length : 'error');
    console.log('Outsider can list any user_preferences rows? count:', Array.isArray(prefsAll.data) ? prefsAll.data.length : 'error');

    // Member can read session notes
    const memberNotes = await memberClient.from('session_notes').select('*').eq('session_id', session.id);
    console.log('Member can read notes count (should be 1):', Array.isArray(memberNotes.data) ? memberNotes.data.length : 'error');

    // Clean up: delete created rows via admin client
    console.log('Cleaning up created test rows...');
    await admin.from('session_notes').delete().eq('session_id', session.id);
    await admin.from('sessions').delete().eq('id', session.id);
    await admin.from('campaign_members').delete().eq('campaign_id', campaign.id);
    await admin.from('campaigns').delete().eq('id', campaign.id);
    // delete test users
    await admin.auth.admin.deleteUser(gmId);
    await admin.auth.admin.deleteUser(memberId);
    await admin.auth.admin.deleteUser(outId);

    console.log('\nSmoke test complete.');
    process.exit(0);
  }catch(err){
    console.error('Smoke test encountered an error:', err.message || err);
    process.exit(4);
  }
})();
