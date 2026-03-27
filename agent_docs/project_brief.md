# Project Brief (Persistent) — Scribe's Quill

**App:** Scribe's Quill — Collaborative TTRPG Campaign Notes
**Version:** MVP v1.0
**Last Updated:** March 2026

---

## Product Vision

Scribe's Quill is a real-time collaborative note-taking web application purpose-built for tabletop roleplaying game (TTRPG) groups. It gives Dungeon Masters and players a shared digital workspace to capture, organize, and revisit session notes — all under a familiar campaign structure that mirrors how TTRPG parties actually play.

---

## Coding Conventions

### Naming Conventions
- **Components:** PascalCase (`CampaignList`, `NoteEditor`)
- **Files:** PascalCase for components, kebab-case for utilities
- **Functions:** camelCase (`handleCreateCampaign`, `formatSessionDate`)
- **Constants:** UPPER_SNAKE_CASE (`TAG_COLORS`, `INITIAL_FORM_STATE`)
- **Database:** snake_case (`session_notes`, `campaign_members`)
- **Types:** PascalCase (`User`, `Campaign`, `SessionNote`)

### File Organization
```
src/
  components/
    editor/        # TipTap editor, Liveblocks hooks, tag UI
    campaigns/     # Campaign list, creation form, invite modal
    sessions/      # Session list, session creation
    auth/          # Login, signup, password reset forms
    ui/            # Shared: Button, Modal, Avatar, Tag badge
  pages/
    /              # Dashboard (campaign list)
    /campaigns/:id # Campaign view (session list)
    /sessions/:id  # Note editor view
    /join/:code    # Invite landing page
    /auth          # Auth flow
  lib/
    supabase.js    # Supabase client singleton
    liveblocks.js  # Liveblocks client config
  hooks/           # useSession, useCampaign, usePresence
  App.jsx
  main.jsx
```

### Error Handling Pattern
```typescript
// ✅ Good: User-friendly errors with fallback
try {
  const { data, error } = await supabase.from('sessions').insert(...)
  if (error) throw error
} catch (err) {
  showError('Failed to create session. Please try again.')
}
```

### Type Safety Rules
- The `any` type is FORBIDDEN — use `unknown` with type guards
- All function parameters and returns must be typed
- Prefer TypeScript interfaces over `// @ts-ignore`

### Component Design
- Keep components small and focused on single responsibilities
- Use React hooks for state management (`useState`, `useEffect`)
- Use React Context for auth state (`useAuth`)
- Memoize expensive components with `React.memo` when needed

---

## Quality Gates

### Before Merging a PR
1. ✅ All TypeScript checks pass (`npm run type-check`)
2. ✅ Code follows existing patterns (read surrounding code first!)
3. ✅ Manual testing on both desktop and mobile
4. ✅ No console errors or warnings
5. ✅ Auth token properly persisted and refreshed
6. ✅ Supabase RLS policies respected

### Before Deploying
1. ✅ All features working locally
2. ✅ Build passes without warnings (`npm run build`)
3. ✅ Environment variables documented in README
4. ✅ Smoke test after deploy succeeds
5. ✅ Zero data loss incidents

---

## Key Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm test             # Run tests
npm run lint         # Check code style
npm run type-check   # Run TypeScript checks
```

---

## Update Cadence

Update this brief when:
- Adding a new feature to the MVP
- Changing a significant coding convention
- Updating a key command or tool
- Documenting a critical learning or insight

---

## Core Conventions (Quick Reference)

| Concern | Convention |
|---------|------------|
| **Rich Text Editor** | TipTap with Collaboration extension for Liveblocks |
| **Real-Time Collab** | Liveblocks room keyed by Supabase session UUID |
| **Entity Tags** | Three types: npc, location, item with distinct colors |
| **Auth Flow** | Supabase Auth with email verification |
| **Invite Flow** | Edge Function adds user to `campaign_members` table |
| **Note Persistence** | Liveblocks webhook → Edge Function → Supabase `session_notes` |
| **RLS Policies** | Users can only access data for campaigns they are members of |

---

*Living document — update as the project scales*
