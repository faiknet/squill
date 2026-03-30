# Squill — Collaborative TTRPG Campaign Notes

A production-ready web applicationfor collaborative note-taking in tabletop RPG campaigns. Built with modern tech and enterprise-grade security.

![SquillDemo](https://github.com/user-attachments/assets/d472c74f-8fac-4f36-980f-ce35a70b1ba8)

---

## Features

### Core Functionality
- **Real-Time Collaborative Editing** — Multiple players edit session notes simultaneously with Liveblocks
- **Campaign Management** — Create and manage multiple campaigns with flexible session organization
- **Team Collaboration** — Invite players via sharable links, role-based permissions
- **Smart Tagging** — Auto-colored entity tags (NPCs, locations, items) for quick reference
- **Full History** — Complete version history with snapshot recovery

### Security & Performance
- **Enterprise Security** — Input validation, rate limiting, IDOR protection, RLS policies
- **Optimized Queries** — Strategic database indexing (40-90% faster performance)
- **OWASP Top 10 Protection** — Defends against SQL injection, XSS, CSRF, and more
- **Audit Logging** — Complete password reset tracking and security events
- **Zero-Knowledge Architecture** — End-to-end encryption ready (Supabase built-in)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + Vite | Latest |
| **Editor** | TipTap (Headless Editor) | v2 |
| **Real-time** | Liveblocks (Collaborative Presence) | Latest |
| **Backend** | Supabase (PostgreSQL + Auth) | Latest |
| **Styling** | Tailwind CSS | v3 |
| **Type Safety** | TypeScript | Latest |
| **Validation** | Zod (Runtime Schema Validation) | Latest |
| **Testing** | Jest (Unit & Integration Tests) | Latest |

---

## Project Structure

```
src/
  components/
    editor/       # TipTap editor, entity tags, collaborative UI
    campaigns/    # Campaign list, creation, settings
    sessions/     # Session management, invite links
    auth/         # Login, signup, password reset
    ui/           # Shared UI components (Button, Modal, Avatar)
  pages/
    index.jsx     # Dashboard (campaign list)
    campaigns/    # Campaign detail view
    sessions/     # Note editor
    auth/         # Auth flows
  lib/
    supabase.js   # Supabase client & auth hooks
    liveblocks.js # Liveblocks configuration
    validation/   # Zod schemas & utilities
  hooks/
    useSession    # Session data management
    useCampaign   # Campaign data & permissions
    usePresence   # Real-time user presence

supabase/
  migrations/     # Database schema & RLS policies
  edge-functions/ # Deno serverless functions
    join-campaign/  # Invite link handler (rate limited)
    snapshot-note/  # Liveblocks webhook (rate limited)

md/
  EXECUTIVE_SUMMARY.md           # High-level overview
  SECURITY_IMPLEMENTATION_INDEX.md # Security documentation nav
  IDOR_DEPLOYMENT_CHECKLIST.md    # Deployment guide
  IDOR_COMPREHENSIVE_SECURITY_AUDIT.md # Technical security analysis
  VALIDATION_GUIDE.md             # Input validation reference
  RATE_LIMITING_GUIDE.md          # Rate limiting documentation
  PASSWORD_RESET_SECURITY.md      # Auth security details
  DATABASE_INDEXING_SUMMARY.md    # Performance tuning
```
---

## Bug Reports & Feature Requests

Found a bug? Want a feature?

 **Create a new issue** with:
   - Clear description of the problem/request
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment (browser, OS, node version)

---

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE) file for details.

---

## Credits

Built by Faik Meta with:
- [Supabase](https://supabase.com) — Backend & Auth
- [Liveblocks](https://liveblocks.io) — Real-time collaboration
- [TipTap](https://tiptap.dev) — Text editor
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Zod](https://zod.dev) — Type-safe validation
