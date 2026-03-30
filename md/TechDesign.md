TECHNICAL DESIGN DOCUMENT
Scribe's Quill
MVP Tech Stack & Architecture


Version	1.0 — MVP

Date	March 2026

Based On	PRD v1.0 — Scribe's Quill

Budget	$0/month — Free tiers only

Timeline	ASAP — Managed services preferred

Stack Type	Full-Stack JavaScript (React + Node.js)

1. Recommended Tech Stack
This stack is optimised for three hard constraints: zero monthly cost at launch, maximum use of managed services (no DevOps required), and the fastest path to a working real-time collaborative web app built with React and Node.js.

Layer	Technology	Why	Cost
Frontend Framework	React 18 + Vite	Fast dev server, great ecosystem	Free / Open Source
Styling	Tailwind CSS	Utility-first, no custom CSS needed	Free / Open Source
Rich Text Editor	TipTap 2	Headless editor, built-in Yjs collab support	Free / Open Source
Real-Time Collab	Liveblocks	Managed CRDT + presence, no server needed	Free tier (50 users)
Auth + Database	Supabase	Managed Postgres + Auth + Storage in one	Free tier (generous)
Backend API	Supabase Edge Functions	Node.js-compatible serverless functions	Free tier included
Hosting	Vercel	One-click React deploys, free tier forever	Free tier
Version Control	GitHub	Source control + Vercel auto-deploy	Free

2. Architecture Overview
Scribe's Quill uses a JAMstack architecture. The React frontend is a static build deployed to Vercel's CDN. Supabase handles all persistence (user accounts, campaigns, sessions) and provides a generated REST + Realtime API. Liveblocks handles real-time document collaboration independently, with each note document keyed to a Supabase session ID.

2.1 High-Level Data Flow
Concern	How It's Handled
User Auth	User signs up/logs in → Supabase Auth issues a JWT → stored in browser
Campaign & Session Data	CRUD operations hit Supabase REST API directly from the React client (no custom backend needed for MVP)
Note Editing	TipTap editor connects to Liveblocks room (keyed by session ID) → real-time CRDT syncs between all connected clients
Presence	Liveblocks broadcasts cursor position and user metadata to all room occupants automatically
Persistence of Notes	Liveblocks Storage persists the Yjs document; a webhook writes a Markdown snapshot to Supabase DB on disconnect for search/display
Invite Links	Invite links contain a campaign UUID; joining user is added to campaign_members table via Supabase Edge Function

2.2 Why Liveblocks Over Self-Hosted Yjs
Factor	Detail
Setup time	Liveblocks is 15 lines of code. Self-hosted Hocuspocus requires a Node.js server, WebSocket config, and separate hosting.
Free tier	Liveblocks free tier covers 50 monthly active users — more than enough for MVP testing.
Presence built-in	Live cursors and user presence (the Google Docs-style awareness) come for free with Liveblocks. Yjs alone doesn't include this.
No ops burden	Liveblocks handles scaling, reliability, and uptime. No server to maintain.
Future cost	If usage grows beyond 50 MAU, Liveblocks Starter is $99/month. At that point revenue should justify it.

3. Database Schema (Supabase / PostgreSQL)
3.1 Tables
users (managed by Supabase Auth)
Supabase Auth provides the core auth.users table automatically. A public profiles table extends it:

profiles
  id          uuid  PRIMARY KEY  references auth.users(id)
  display_name  text  NOT NULL
  avatar_url    text
  plan          text  DEFAULT 'free'   -- future monetisation hook
  created_at    timestamptz  DEFAULT now()

campaigns
campaigns
  id           uuid  PRIMARY KEY  DEFAULT gen_random_uuid()
  name         text  NOT NULL
  description  text
  invite_code  uuid  DEFAULT gen_random_uuid()  UNIQUE
  created_by   uuid  references profiles(id)
  created_at   timestamptz  DEFAULT now()

campaign_members
campaign_members
  campaign_id  uuid  references campaigns(id)  ON DELETE CASCADE
  user_id      uuid  references profiles(id)   ON DELETE CASCADE
  joined_at    timestamptz  DEFAULT now()
  PRIMARY KEY (campaign_id, user_id)

sessions
sessions
  id           uuid  PRIMARY KEY  DEFAULT gen_random_uuid()
  campaign_id  uuid  references campaigns(id)  ON DELETE CASCADE
  name         text  NOT NULL
  session_date date
  created_by   uuid  references profiles(id)
  created_at   timestamptz  DEFAULT now()
  archived     boolean  DEFAULT false

session_notes (snapshot store)
session_notes
  session_id    uuid  PRIMARY KEY  references sessions(id)  ON DELETE CASCADE
  content_md    text   -- Markdown snapshot for display/search
  liveblocks_id text   -- Liveblocks room ID (= session_id as string)
  updated_at    timestamptz  DEFAULT now()

entity_tags
entity_tags
  id           uuid  PRIMARY KEY  DEFAULT gen_random_uuid()
  session_id   uuid  references sessions(id)  ON DELETE CASCADE
  campaign_id  uuid  references campaigns(id)  ON DELETE CASCADE
  label        text  NOT NULL          -- display text of the tagged span
  tag_type     text  NOT NULL          -- 'npc' | 'location' | 'item'
  created_by   uuid  references profiles(id)
  created_at   timestamptz  DEFAULT now()

3.2 Row-Level Security (RLS)
Supabase RLS policies enforce that users can only read/write data for campaigns they are members of. This replaces the need for a custom authorization layer.
Table	RLS Rule Summary
campaigns	SELECT / INSERT allowed if user is in campaign_members OR is creating new row
campaign_members	SELECT allowed if user's own membership or same campaign; INSERT via invite Edge Function only
sessions	SELECT / INSERT / UPDATE allowed if user is a campaign_members row for that campaign_id
session_notes	Same as sessions — membership check on campaign_id via sessions join
entity_tags	Same as sessions
profiles	Any authenticated user can read profiles; only own row is writable

4. Frontend Architecture
4.1 Project Structure
src/
  components/
    editor/        -- TipTap editor, Liveblocks hooks, tag UI
    campaigns/     -- Campaign list, creation form, invite modal
    sessions/      -- Session list, session creation
    auth/          -- Login, signup, password reset forms
    ui/            -- Shared: Button, Modal, Avatar, Tag badge
  pages/
    /              -- Dashboard (campaign list)
    /campaigns/:id -- Campaign view (session list)
    /sessions/:id  -- Note editor view
    /join/:code    -- Invite landing page
    /auth          -- Auth flow
  lib/
    supabase.js    -- Supabase client singleton
    liveblocks.js  -- Liveblocks client config
  hooks/           -- useSession, useCampaign, usePresence
  App.jsx
  main.jsx

4.2 Key Libraries
Package	Purpose
@tiptap/react	Core rich text editor — headless, highly extensible
@tiptap/extension-collaboration	Yjs CRDT binding for TipTap — plugs directly into Liveblocks
@liveblocks/client + @liveblocks/react	Real-time presence, cursors, and Yjs document storage
@supabase/supabase-js	Supabase client for auth, database queries, and realtime subscriptions
react-router-dom v6	Client-side routing
tailwindcss	Utility-first styling — no custom CSS files needed
date-fns	Lightweight date formatting for session dates

4.3 Editor & Collaboration Setup
TipTap's Collaboration extension connects to a Liveblocks Yjs provider. Each session note gets its own Liveblocks room, identified by the Supabase session UUID. Presence (cursors, active users) is handled by Liveblocks' useOthers hook.

// Simplified editor bootstrap
const { room, doc } = useRoom();   // Liveblocks room for this session ID
const provider = new LiveblocksYjsProvider(room);

const editor = useEditor({
  extensions: [
    StarterKit,
    Collaboration.configure({ document: provider.doc }),
    CollaborationCursor.configure({ provider }),
    EntityTag,   // custom TipTap mark for NPC/Location/Item
  ]
});

5. Authentication Flow
Step	Implementation
Sign Up	Email + password via supabase.auth.signUp(). Supabase sends verification email. On verify, profile row is auto-created via database trigger.
Sign In	supabase.auth.signInWithPassword(). Returns JWT stored in localStorage via Supabase client.
Session Persistence	Supabase client auto-refreshes token. React context provides session state app-wide.
Password Reset	supabase.auth.resetPasswordForEmail(). Supabase handles email delivery and token.
Invite Flow	User visits /join/:invite_code → if not logged in, redirected to /auth?next=/join/:code → after auth, Edge Function adds them to campaign_members.
Logout	supabase.auth.signOut() clears local session and redirects to /auth.

6. Supabase Edge Functions
Only two Edge Functions are required for MVP. All other data operations use the Supabase auto-generated REST API with RLS for access control.
Function	Purpose
POST /join-campaign	Validates invite_code, checks campaign exists, inserts row into campaign_members for the authenticated user. Returns campaign ID for redirect.
POST /snapshot-note	Called by a Liveblocks webhook on room disconnect. Converts the Yjs doc to Markdown and upserts into session_notes.content_md for fast display and future search.

7. Hosting & Deployment
7.1 Services Used (All Free Tier)
Service	Role	Free Tier Limit	URL
Vercel	React frontend hosting	Free forever for hobby projects	vercel.com
Supabase	Postgres DB + Auth + Edge Functions	Free tier: 500MB DB, 50K MAU	supabase.com
Liveblocks	Real-time collab infrastructure	Free tier: 50 monthly active users	liveblocks.io
GitHub	Source control + CI/CD trigger	Free for public & private repos	github.com

7.2 Deployment Pipeline
Step	Action
Step 1 — Connect	Link GitHub repo to Vercel. Every push to main triggers an automatic build and deploy.
Step 2 — Env Vars	Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_LIVEBLOCKS_PUBLIC_KEY to Vercel environment variables.
Step 3 — Supabase Setup	Run SQL migrations in Supabase Studio to create tables and RLS policies. Deploy Edge Functions via Supabase CLI.
Step 4 — Liveblocks Setup	Create a Liveblocks project, copy the public key. No additional server config required.
Step 5 — Verify	Push a commit, confirm Vercel deploys successfully, test auth and collab end-to-end.

8. Scalability & Upgrade Path
The MVP uses free tiers across the board. Here is what to upgrade and when as the app grows:
Trigger	Action
Liveblocks > 50 MAU	Upgrade to Liveblocks Starter ($99/month). No code changes needed.
Supabase DB > 500MB	Upgrade to Supabase Pro ($25/month). Includes daily backups and more storage.
Paid tiers (future)	Add Stripe integration. The plan field on profiles and feature-flag checks are already in the schema — no migrations needed.
More collab users per campaign	Liveblocks scales horizontally automatically. No architecture change required.
Note search	Add Supabase full-text search on session_notes.content_md — no new infrastructure needed.

9. Technical Risks & Mitigations
Risk	Mitigation
Liveblocks free tier limit (50 MAU)	For MVP testing this is fine. If early traction is strong, upgrade before launching publicly. Monitor MAU in Liveblocks dashboard.
Supabase cold starts on Edge Functions	Edge Functions may have slight latency on first call. Mitigate by keeping functions minimal (join-campaign, snapshot). Not on the hot path.
TipTap + Liveblocks Yjs compatibility	Both are well-maintained and officially documented together. Pin library versions and test before upgrading.
Data loss on Liveblocks free tier	Free tier has limited persistence guarantees. The snapshot Edge Function writes content to Supabase as a safety net on room close.
Vercel build times	Vite builds are fast (<30s). No risk for MVP scale.

10. Recommended Build Order
Follow this sequence to get a working, testable app as fast as possible:
1.	Project scaffold — Vite + React + Tailwind + React Router
2.	Supabase project — create tables, RLS policies, enable Auth
3.	Auth screens — Sign up, Sign in, Password reset (Supabase Auth)
4.	Campaign CRUD — Create, list, and view campaigns; connect invite link
5.	Join flow — /join/:code page + Edge Function to add member
6.	Session CRUD — Create, list, rename, archive sessions within campaign
7.	Basic TipTap editor — Rich text only, no collab yet
8.	Liveblocks integration — Real-time collab + live presence cursors
9.	Entity tagging — Custom TipTap mark for NPC / Location / Item
10.	Snapshot Edge Function — Persist note content to Supabase on disconnect
11.	Deploy to Vercel + end-to-end test across two browsers


Scribe's Quill — Tech Design v1.0 — March 2026  |  Built with KhazP Vibe-Coding Prompt Template
