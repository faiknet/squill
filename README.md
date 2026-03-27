# Scribe's Quill — TTRPG Collaborative Notes

A real-time collaborative note-taking app for tabletop RPG groups.

## Quick Start

### 1. Verify your `.env` file exists

```bash
ls -la .env
```

Your `.env` should contain:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_LIVEBLOCKS_PUBLIC_KEY`

### 2. Install dependencies

```bash
npm install
```

### 3. Start the dev server

```bash
npm run dev
```

### 4. Visit the app

Open your browser to `http://localhost:5173`

### 5. Create your first campaign

1. Click "Create Campaign"
2. Fill in campaign details
3. Share invite code with your party
4. Start creating sessions!

## Supabase Connection Status

✅ Supabase client initialized in `src/lib/supabase.ts`
✅ Environment variables loaded from `.env`
✅ Ready to use authentication and database

## Troubleshooting

**"Supabase not connected"**: Check that `.env` exists and has valid values

**"Liveblocks not working"**: Verify `VITE_LIVEBLOCKS_PUBLIC_KEY` is set

**"Page doesn't load"**: Run `npm run dev` and check browser console for errors

## Auth + Backend Setup (Supabase)

### 1) Apply database schema

Run the migration in Supabase SQL editor:

`supabase/migrations/0001_mvp_schema.sql`

This creates:
- `profiles`
- `campaigns`
- `campaign_members`
- `sessions`
- `session_notes`
- `entity_tags`

It also enables RLS policies and profile auto-creation trigger.

### 2) Deploy Edge Functions

Functions are in:
- `supabase/edge-functions/join-campaign/index.ts`
- `supabase/edge-functions/snapshot-note/index.ts`

Set environment values (service role key required for functions) from:

`supabase/edge-functions/.env.example`

### 3) Auth flow now enabled in app

The app now uses Supabase auth and protected routes:
- `/auth` for sign in/sign up
- `/dashboard` for campaigns
- `/campaigns/:id` for sessions
- `/campaigns/:id/sessions/:sessionId` for notes
- `/join/:code` for invite joins
