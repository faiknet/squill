# REVIEW-CHECKLIST.md — Scribe's Quill

**App:** Scribe's Quill — Collaborative TTRPG Campaign Notes
**Use this checklist before:** Merging PRs, deploying, or marking features complete

---

## 📋 Pre-Commit Checklist

Before committing any code:

- [ ] Run `npm run lint` — No errors
- [ ] Run `npm run type-check` — No TypeScript errors
- [ ] Review changes — Do they match the current phase?
- [ ] Manual test — Does it work in browser?
- [ ] Mobile test — Does it work on mobile viewport?
- [ ] Auth check — Does it respect Supabase RLS policies?
- [ ] Edge case check — What happens on network failure?

---

## 🧪 Feature Completion Checklist

For each feature (e.g., "Rich text formatting"):

### Implementation
- [ ] Code written and follows existing patterns
- [ ] TypeScript types are explicit (no `any`)
- [ ] Error boundaries in place
- [ ] Loading states implemented
- [ ] User feedback (toasts, confirmations)

### Testing
- [ ] Manual test on desktop browser
- [ ] Manual test on mobile browser
- [ ] Test with multiple users (real-time collab)
- [ ] Test offline then reconnect
- [ ] Test with special characters (TTRPG notes have them!)

### Documentation
- [ ] Code is commented where not self-evident
- [ ] Any new files documented
- [ ] AGENTS.md updated if needed

---

## 🔒 Security Checklist

Before any PR:

- [ ] No sensitive data in client code (keys, tokens)
- [ ] Supabase RLS policies checked
- [ ] Auth token properly refreshed
- [ ] No XSS vulnerabilities (sanitize user input)
- [ ] No SQL injection (use Supabase query builder)
- [ ] HTTPS enforced (Vercel handles this)

---

## 🎨 UI/UX Checklist

- [ ] Consistent spacing (Tailwind classes)
- [ ] Accessible colors (WCAG 2.1 AA)
- [ ] Keyboard navigation works
- [ ] Mobile responsive
- [ ] Dark mode friendly
- [ ] Loading states for async operations
- [ ] Error messages are user-friendly

---

## 🚀 Deployment Checklist

Before deploying to Vercel:

- [ ] All features working locally
- [ ] No console errors
- [ ] Build passes: `npm run build`
- [ ] Env vars set on Vercel:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_LIVEBLOCKS_PUBLIC_KEY`
- [ ] Test deploy to staging (or main if confident)
- [ ] Smoke test after deploy:
  - [ ] Can sign up
  - [ ] Can create campaign
  - [ ] Can create session
  - [ ] Can edit note
  - [ ] Real-time collab works

---

## 📊 Success Metrics Checklist

After launch:

- [ ] Track activation rate (campaign + invite within 7 days)
- [ ] Monitor retention (40%+ return within 14 days)
- [ ] Watch for data loss incidents (zero tolerance)
- [ ] Monitor Liveblocks MAU (alert if > 50)

---

*Use this checklist with every feature and PR*
