# AGENTS.md — Scribe's Quill

**App:** Scribe's Quill — Collaborative TTRPG Campaign Notes
**Stack:** React + Vite, TipTap, Liveblocks, Supabase, Tailwind CSS
**Stage:** MVP Development
**User Level:** A (Vibe-coder) — AI does the coding, I guide and test

---

## 🎯 Current Phase

**Phase 1: Foundation & Auth**
- [ ] Project scaffold with Vite + React + Tailwind
- [ ] Supabase project setup (DB + Auth)
- [ ] Authentication screens (Sign up, Sign in, Password reset)

**Next Steps:** After auth works, build campaign CRUD → Session CRUD → Editor → Real-time collab → Entity tagging

---

## 📚 Documentation Index

| File | Purpose |
|------|---------|
| [`agent_docs/`](agent_docs/) | Detailed implementation guides |
| [`agent_docs/tech_stack.md`](agent_docs/tech_stack.md) | All libraries, versions, and setup commands |
| [`agent_docs/product_requirements.md`](agent_docs/product_requirements.md) | Feature list and user stories |
| [`agent_docs/project_brief.md`](agent_docs/project_brief.md) | Coding conventions and quality gates |
| [`agent_docs/testing.md`](agent_docs/testing.md) | Test strategy and manual checks |

---

## 🤖 How I Should Think

1. **Understand Intent First**: Before answering, identify what the user actually needs (e.g., "add auth" → is it Sign Up flow or Password Reset?)
2. **Ask If Unsure**: If critical information is missing, ask before proceeding
3. **Plan Before Coding**: Propose a brief plan and wait for approval before coding
4. **Verify After Changes**: Manually test each feature after implementation
5. **Explain Trade-offs**: When recommending something, mention alternatives

---

## 🚫 What NOT To Do

- Do NOT delete files without explicit confirmation
- Do NOT modify database schemas without backup plan
- Do NOT add features not in the current phase
- Do NOT skip tests for "simple" changes
- Do NOT bypass failing tests or pre-commit hooks
- Do NOT use deprecated libraries or patterns
- Do NOT expose paid tier features or pricing (reserved for future)

---

## 🔒 Engineering Constraints

### Type Safety (No Compromises)
- The `any` type is FORBIDDEN—use `unknown` with type guards
- All function parameters and returns must be typed
- Use Zod or similar for runtime validation

### Architectural Sovereignty
- Routes/controllers handle request/response ONLY
- All business logic goes in `services/` or `core/`
- No database calls from route handlers

### Library Governance
- Check existing `package.json` before suggesting new dependencies
- Prefer native APIs over libraries (fetch over axios)
- No deprecated patterns (useEffect for data → use TanStack Query)

### The "No Apologies" Rule
- Do NOT apologize for errors—fix them immediately
- Do NOT generate filler text before providing solutions
- If context is missing, ask ONE specific clarifying question

---

## 🛠️ Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Build for production
- `npm test` — Run tests
- `npm run lint` — Check code style

---

## 📦 Project Structure

```
your-app/
├── docs/
│   ├── PRD-ScribesQuill-MVP.md
│   ├── TechDesign-ScribesQuill-MVP.md
│   └── research-ScribesQuill.txt
├── agent_docs/
│   ├── tech_stack.md
│   ├── code_patterns.md
│   ├── project_brief.md
│   ├── product_requirements.md
│   └── testing.md
├── src/
│   ├── components/
│   │   ├── editor/
│   │   ├── campaigns/
│   │   ├── sessions/
│   │   ├── auth/
│   │   └── ui/
│   ├── pages/
│   │   ├── index.jsx          # Dashboard (campaign list)
│   │   ├── campaigns/[id]     # Campaign view
│   │   ├── sessions/[id]      # Note editor
│   │   ├── join/[code]        # Invite landing
│   │   └── auth/              # Auth flow
│   ├── lib/
│   │   ├── supabase.js
│   │   └── liveblocks.js
│   ├── hooks/
│   ├── App.jsx
│   └── main.jsx
├── AGENTS.md
├── CLAUDE.md
├── README.md
└── package.json
```

---

## 🎨 UI/UX Requirements

- **Design Vibe:** Clean, distraction-free, dark-mode friendly
- **Typography:** Monospace headings (evoking a "quill" feel), readable body text
- **Color Palette:** Warm, parchment-inspired tones with high contrast
- **Responsive:** Fully usable on desktop and mobile browsers

---

## 🌐 Success Metrics

| Metric | Target |
|--------|--------|
| Activation | User creates a campaign and invites at least one collaborator within 7 days of signup |
| Engagement | Average of 2+ session notes created per campaign per month |
| Retention | 40%+ of users return to the app within 14 days of first session note |
| Collaboration | 50%+ of sessions have 2 or more concurrent active editors at least once |
| Stability | Zero data loss incidents in the first 3 months post-launch |

---

*Generated using the KhazP Vibe-Coding Prompt Template — March 2026*
