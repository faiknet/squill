# Squill — Project Structure & Function Guide

## Overview

**Squill** (formerly "Scribe's Quill") is a production-ready web application for collaborative note-taking in tabletop RPG (TTRPG) campaigns. It provides real-time editing via **Liveblocks/Y.js**, campaign management via **Supabase**, and a rich text editor powered by **TipTap**.

**Tech Stack:**
- **Frontend:** React 18 + Vite 6
- **Editor:** TipTap v2 (headless, ProseMirror-based)
- **Real-time:** Liveblocks (collaborative presence + Y.js sync)
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Styling:** Tailwind CSS v3
- **Validation:** Zod (runtime schema validation)
- **Testing:** Vitest
- **Type Safety:** TypeScript (partial adoption)

---

## Project Structure

```
Squill/
├── src/
│   ├── main.jsx                          # App entry point
│   ├── App.jsx                           # Root component (auth bypass, supabase check)
│   ├── index.css                         # Tailwind + global styles
│   │
│   ├── routes/
│   │   ├── index.jsx                     # Route definitions (React Router v6)
│   │   ├── Layout.jsx                    # App shell with sidebar + Outlet
│   │   └── NotFound.jsx                  # 404 page
│   │
│   ├── pages/
│   │   ├── Auth.jsx                      # Login / signup
│   │   ├── AuthResetPassword.jsx         # Password reset flow
│   │   ├── VerifyEmail.jsx               # Email verification
│   │   ├── CampaignList.jsx              # Dashboard (list of campaigns)
│   │   ├── CampaignDetail.jsx            # Single campaign view with sessions
│   │   ├── SessionEditor.jsx             # Collaborative/local note editor
│   │   ├── Journal.jsx                   # Entity journal browser
│   │   ├── SessionPreferences.jsx        # Session display settings
│   │   ├── Settings.jsx                  # User profile/settings
│   │   └── JoinCampaign.jsx              # Invite link handler
│   │
│   ├── components/
│   │   ├── editor/
│   │   │   ├── LocalEditor.jsx           # Solo editor (no Liveblocks)
│   │   │   ├── CollaborativeEditor.jsx   # Real-time editor (Liveblocks + Y.js)
│   │   │   ├── GoogleDocsToolbar.jsx     # Main formatting toolbar
│   │   │   ├── Toolbar.jsx               # Secondary toolbar
│   │   │   ├── MentionDropdown.jsx       # @-mention autocomplete dropdown
│   │   │   ├── JournalEntryMentionModal.jsx  # Entity detail popover
│   │   │   ├── SessionMentionModal.jsx   # Session mention popover
│   │   │   ├── PresenceSidebar.jsx       # Online users + activity feed
│   │   │   ├── LinkModal.jsx             # Link insertion dialog
│   │   │   ├── ImageModal.jsx            # Image insertion dialog
│   │   │   └── Content.jsx               # (likely unused)
│   │   │
│   │   ├── campaigns/
│   │   │   ├── CreateCampaignModal.jsx   # New campaign dialog
│   │   │   ├── EditCampaignModal.jsx     # Edit campaign dialog
│   │   │   ├── DeleteCampaignModal.jsx   # Delete confirmation
│   │   │   ├── TransferGMModal.jsx       # GM transfer
│   │   │   └── PartyMemberActionModal.jsx# Member actions
│   │   │
│   │   ├── sessions/
│   │   │   ├── EditSessionModal.jsx      # Create/edit session
│   │   │   ├── DeleteSessionModal.jsx    # Delete session
│   │   │   └── ExportSessionNotesModal.jsx # Export format picker
│   │   │
│   │   ├── journal/
│   │   │   └── NewJournalEntryModal.jsx  # Add journal entry/tag
│   │   │
│   │   ├── ui/
│   │   │   ├── Button.jsx               # Reusable button
│   │   │   ├── Card.jsx                 # Reusable card
│   │   │   ├── Input.jsx                # Reusable input
│   │   │   ├── DarkModeToggle.jsx       # Dark mode switch
│   │   │   ├── UserProfileMenu.jsx      # Avatar + color picker + settings
│   │   │   └── index.js                 # UI component barrel export
│   │   │
│   │   ├── DarkModeProvider.jsx         # Theme context provider
│   │   └── SafeMarkdown.jsx             # Sanitized markdown renderer
│   │
│   ├── hooks/
│   │   ├── useSupabaseAuth.ts           # Auth state + CRUD (sign in, up, out, reset)
│   │   ├── useSessionData.js            # Session notes + tags + activity CRUD
│   │   ├── useFormState.js              # Form error/message state
│   │   └── useDarkMode.js               # Dark mode toggle logic
│   │
│   ├── lib/
│   │   ├── supabase.ts                  # Supabase client init
│   │   ├── liveblocks.js                # Liveblocks helpers (room ID, color)
│   │   ├── guestData.ts                 # Demo data for guest mode
│   │   ├── fontSizeExtension.js         # Custom TipTap fontSize extension
│   │   ├── indentExtension.js           # Custom TipTap indent extension
│   │   ├── mentionMark.js               # Custom TipTap mention mark
│   │   ├── mentionColorPreferences.js   # Entity type colors
│   │   ├── mentionEntityIcons.js        # Entity type icons mapping
│   │   ├── editorUserColorPreferences.js# User color preferences
│   │   ├── sessionDisplayPreferences.js # Session display prefs
│   │   ├── sessionNoteExport.js         # Export engine (PDF, DOCX, ODT)
│   │   ├── sessionExportSecurity.js     # Export security checks
│   │   ├── journalEntryTypes.js         # Journal entity type defs
│   │   └── utils.js                     # URL slug, copy invite, display label
│   │
│   │   ├── validation/
│   │   │   ├── index.ts                 # Schema exports + ValidationError class
│   │   │   ├── schemas.ts               # Zod schemas (auth, campaign, session, tags)
│   │   │   └── utils.ts                 # Validation utilities
│   │   │
│   │   └── sanitization/
│   │       ├── index.js                 # Sanitizer exports
│   │       └── markdownSanitizer.js     # XSS prevention for markdown
│   │
│   ├── contexts/
│   │   └── MobileMenuContext.jsx        # Sidebar mobile menu state
│   │
│   ├── styles/
│   │   └── mentions.css                 # Entity tag mention styles
│   │
│   ├── assets/
│   │   └── icons/                       # PNG/SVG toolbar icons
│   │
│   └── dev/
│       └── BypassApp.jsx                # Dev bypass auth component
│
├── supabase/
│   ├── migrations/                      # ~35 SQL migration files
│   │   ├── 0001_mvp_schema.sql          # Initial schema (tables, RLS)
│   │   ├── 0002_... through 0012        # Iterative schema changes
│   │   ├── 20260321_*                   # Entity tags, activity logs, pets
│   │   ├── 20260323_*                   # User prefs, party members, streaks
│   │   ├── 20260327_*                   # RLS fixes, membership policies
│   │   ├── 20260330_*                   # Indexes, IDOR fixes, password reset
│   │   ├── 20260331_*                   # Slugs, RLS fixes
│   │   ├── 20260405_*                   # Campaign streaks
│   │   ├── 20260411_*                   # Entity tags entry type
│   │   └── 20260615_*                   # Streak logic fixes + triggers
│   │
│   ├── edge-functions/                  # Deno serverless functions
│   │   ├── validation.ts                # Input validation middleware
│   │   └── *.test.ts                    # Integration + unit tests
│   │
│   └── supa/
│       └── config.toml                  # Supabase project config
│
├── public/
│   ├── google-fonts.css                 # Loaded Google Fonts
│   ├── favicon.webp                     # Site favicon
│   └── icons/
│       ├── Bold.png, Italics.png, etc.  # Toolbar icons
│       └── journal/                     # Journal animal icons
│
├── scripts/
│   └── migrate-supabase-to-rds.ps1      # Production migration script
│
├── .env / .env.example                  # Environment variables
├── vite.config.ts                       # Vite config
├── tailwind.config.js                   # Tailwind config (custom brand color)
├── postcss.config.js                    # PostCSS config
├── eslint.config.js                     # ESLint flat config
├── tsconfig.json                        # TypeScript config
└── package.json                         # Dependencies & scripts
```

---

## Routing Architecture

The app uses **React Router v6** with `Layout.jsx` wrapping protected routes. Routes are defined in `src/routes/index.jsx`:

| Path | Component | Access | Notes |
|------|-----------|--------|-------|
| `/auth` | Auth | Public | Login/signup |
| `/auth/reset-password` | AuthResetPassword | Public | |
| `/auth/verify-email` | VerifyEmail | Public | |
| `/join/:code` | JoinCampaign | Public | Invite links |
| `/campaigns` | CampaignList | Protected | Dashboard |
| `/campaigns/:slug` | CampaignDetail | Protected | Inside Layout |
| `/campaigns/:slug/sessions/:slug` | SessionEditor | Protected | No Layout |
| `/campaigns/:slug/sessions/:slug/journal` | Journal | Protected | No Layout |
| `/campaigns/:slug/sessions/:slug/preferences` | SessionPreferences | Protected | No Layout |
| `/settings` | Settings | Protected | Inside Layout |

---

## Key Features

### 1. Campaign Management

**Files:** `CampaignList.jsx` · `CampaignDetail.jsx` · `supabase/migrations/0001_mvp_schema.sql`

- List campaigns with search, pin-to-top, sort by recency
- Create/Edit/Delete campaigns (GM-only actions)
- Party size tracking per campaign
- Session count per campaign
- Invite system via unique invite codes
- **Streaks:** Track campaign activity cadence (weekly/biweekly/monthly)
- RLS policies enforce that only GM can modify campaigns

**Database tables:** `campaigns`, `campaign_members`, `campaign_pins`

### 2. Session Notes Editor

**Files:** `SessionEditor.jsx` · `LocalEditor.jsx` · `CollaborativeEditor.jsx`

- Two modes: **Local** (solo, no Liveblocks key) and **Collaborative** (Liveblocks + Y.js)
- Auto-save with 2-second debounce
- Guest mode saves to `sessionStorage`
- Activity logging with throttling (5 min edit_document throttle)

### 3. Rich Text Toolbar

**Files:** `GoogleDocsToolbar.jsx` (primary) · `Toolbar.jsx` (secondary)

**GoogleDocsToolbar features:**
- Font size selector (8–72px) with +/- buttons and dropdown
- Font family (15 Google Fonts with CSS loading)
- Bold/Italic/Underline
- Text color (70-color palette) + Highlight
- Link insertion via modal
- Image insertion via modal
- Text alignment (left/center/right/justify)
- Bullet/Numbered lists
- Clear formatting (preserves mentions)
- Sidebar collapse/expand button

### 4. TipTap Extensions (Custom)

**Files:** `fontSizeExtension.js` · `indentExtension.js` · `mentionMark.js`

**FontSize:** Stores `fontSize` as attribute on `textStyle` mark. Includes line-height calculation (`size * 1.4`) for proper spacing.

**IndentExtension:** Adds indent/outdent for paragraphs with configurable levels.

**MentionMark:** Custom mark for entity tags, user mentions, and session references. Stores metadata like `mentionType`, `mentionEntityType`, `mentionId`, `mentionLabel`, `mentionColor`.

### 5. Entity Tag System (Journal)

**Files:** `Journal.jsx` · `NewJournalEntryModal.jsx` · `PresenceSidebar.jsx`

- Tag types: `npc`, `location`, `item`, `pet`
- Color-coded (blue=npc, green=location, brown=item/inventory, purple=pet)
- Tags linked to sessions and campaigns
- Descriptions for each tag
- Activity logging for create/delete

### 6. Real-time Collaboration

**Files:** `CollaborativeEditor.jsx` · `PresenceSidebar.jsx`

- **Liveblocks** handles WebSocket connections, presence, and Y.js document sync
- Each session gets a unique room ID: `session-note:{campaignId}:{sessionId}`
- Presence includes: cursor position, name, color, typing status
- Y.js replaces TipTap's built-in history to avoid conflicts
- Active user list shows who's editing vs viewing
- Color assignment per user (stored in localStorage + database)

### 7. Security Architecture

**Files:** `lib/validation/schemas.ts` · `lib/sanitization/` · `supabase/migrations/`

**Zod Validation:** All inputs validated client-side before Supabase calls:
- Sign in/up, password reset
- Campaign CRUD
- Session CRUD
- Entity tags CRUD
- Profile updates
- Note content (max 1MB, null byte rejection)

**Supabase RLS (Row Level Security):**
- Users can only see campaigns they're members of
- GM-only write access for campaign details
- Session access via campaign membership
- Activity logs accessible via session membership
- Profile rows editable only by the owning user

**Additional Protections:**
- IDOR (Insecure Direct Object Reference) prevention
- Password reset rate limiting & tracking
- XSS sanitization via markdown sanitizer
- Input validation in Deno edge functions

### 8. Guest Mode

**File:** `guestData.ts`

- Full demo experience without authentication
- Pre-populated campaign: "The Lost Mines of Phandelver"
- Session: "Goblin Ambush" with pre-written note content
- 8 demo entity tags (NPCs, locations, items, pet)
- Data persists in `sessionStorage` (lost on tab close)
- Guest users can create campaigns (stored locally)

### 9. Export System

**Files:** `sessionNoteExport.js` · `ExportSessionNotesModal.jsx`

Supported formats:
- **PDF** (via `@react-pdf/renderer`)
- **DOCX** (via `html-docx-js-typescript`)
- **ODT** (via `odf-kit`)

Exports convert notes to the chosen format with proper formatting.

### 10. Dark Mode

**Files:** `DarkModeProvider.jsx` · `useDarkMode.js` · `DarkModeToggle.jsx`

- Full dark mode implementation using Tailwind's `dark:` variants
- Toggled via `useDarkMode` hook
- Persisted to localStorage + database user preferences

---

## Database Schema (Core Tables)

From `supabase/migrations/0001_mvp_schema.sql` and subsequent migrations:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles, display names, avatar URLs |
| `campaigns` | Campaign name, description, invite_code, streaks |
| `campaign_members` | Membership join table (campaign_id ↔ user_id) |
| `campaign_pins` | User-specific campaign pinning |
| `sessions` | Session name, date, campaign_id, archive flag |
| `session_notes` | Note content (HTML), Y.js liveblocks_id |
| `entity_tags` | Label, tag_type, session_id, campaign_id |
| `session_activity_logs` | Audit trail (edit_document, create_entity, etc.) |
| `user_preferences` | UI preferences (color, dark mode, etc.) |

Additional tables from migrations: `campaign_streaks`, `password_reset_tracking`

---

## Auth Flow

**File:** `useSupabaseAuth.ts`

1. **On app load:** Check Supabase session via `supabase.auth.getSession()`
2. **Session persistence:** Supabase handles token refresh automatically
3. **Profile loading:** After auth, load `display_name` and `avatar_url` from `profiles` table
4. **Guest mode:** Creates a fake User object, stores in `sessionStorage`
5. **Bypass mode:** `VITE_BYPASS_AUTH=true` for development

---

## Data Flow

1. User navigates to a campaign → CampaignDetail loads sessions
2. User opens a session → SessionEditor resolves slugs → loads data via `useSessionData` hook
3. Hook fetches: session info, note content, entity tags, campaign members, activity logs, all campaign sessions
4. Editor renders with toolbar → user edits → auto-save (2s debounce)
5. In collaborative mode: Y.js syncs changes in real-time via Liveblocks
6. Activity logging: edit_document logged every 5 min, others logged immediately

---

## Testing

**Framework:** Vitest

- `lib/validation/validation.test.ts` — Zod schema unit tests
- `supabase/edge-functions/*.test.ts` — Integration tests

---

## Environment Variables

**Required:**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key

**Optional:**
- `VITE_LIVEBLOCKS_PUBLIC_KEY` — Liveblocks key (enables collaboration)
- `VITE_BYPASS_AUTH` — Skip auth for development (boolean)

---

## Key Scripts (package.json)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start development server |
| `build` | `vite build` | Production build |
| `lint` | `eslint . --max-warnings=0` | Lint all files |
| `type-check` | `tsc --noEmit` | TypeScript type checking |
| `test` | `vitest` | Run test suite |
