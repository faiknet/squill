# CLAUDE.md — Claude Code Configuration for Scribe's Quill

**App:** Scribe's Quill — Collaborative TTRPG Campaign Notes
**Stack:** React + Vite, TipTap, Liveblocks, Supabase, Tailwind CSS
**Stage:** MVP Development
**User Level:** A (Vibe-coder) — AI does the coding, I guide and test

---

## Directives

1. **Master Plan:** Always read `AGENTS.md` first. It contains the current phase and tasks.
2. **Documentation:** Refer to `agent_docs/` for tech stack details, code patterns, and testing guides.
3. **Plan-First:** Propose a brief plan and wait for approval before coding.
4. **Incremental Build:** Build one small feature at a time. Test frequently.
5. **Pre-Commit:** If hooks exist, run them before commits; fix failures.
6. **No Linting:** Do not act as a linter. Use `npm run lint` if needed.
7. **Communication:** Be concise. Ask clarifying questions when needed.

---

## Commands

- `npm run dev` — Start Vite dev server
- `npm test` — Run tests
- `npm run lint` — Check code style

---

## Anti-Vibe Rules

- Do NOT delete files without explicit confirmation
- Do NOT modify database schemas without backup plan
- Do NOT add features not in the current phase
- Do NOT skip tests for "simple" changes
- Do NOT bypass failing tests or pre-commit hooks
- Do NOT use deprecated libraries or patterns

---

## Type Safety Rules

- The `any` type is FORBIDDEN — use `unknown` with type guards
- All function parameters and returns must be typed
- Check existing `package.json` before suggesting new dependencies

---

## Project Structure

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

---

*Generated using the KhazP Vibe-Coding Prompt Template — March 2026*

## Automation

This project uses specialized sub-agents located in `.claude/agents/`:
- **Senior Front-End Developer** — React, TipTap, Liveblocks UI/UX
- **Senior Back-End Developer** — Supabase schema, RLS policies, Edge Functions
- **Data Engineer** — PostgreSQL data modeling, migration strategy

Configure tools via `.claude/agents/AGENTS.md`. See that file for usage.

