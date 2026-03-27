# Testing Strategy — Scribe's Quill

**App:** Scribe's Quill — Collaborative TTRPG Campaign Notes
**Version:** MVP v1.0

---

## Test Frameworks

### Unit Tests
- **Tool:** Vitest (built into Vite)
- **Purpose:** Test utility functions, custom hooks, business logic
- **Location:** `src/__tests__/`

### E2E Tests
- **Tool:** Playwright
- **Purpose:** Test full user flows (signup → create campaign → create session → edit note)
- **Location:** `e2e/`

### Manual Checks
- **Browser Testing:** Test each feature manually in Chrome, Firefox, Safari, Edge
- **Mobile Testing:** Use DevTools device emulation for mobile views
- **Real-Time Testing:** Test collaboration with multiple users on different browsers

### Pre-Commit Hooks
- **Lint:** `npm run lint`
- **Type Check:** `npm run type-check`
- **Test:** `npm test`
- **Build:** `npm run build`

---

## Test Structure

```
src/
  __tests__/
    utils/
      date-format.test.tsx
    hooks/
      useSession.test.tsx
      useCampaign.test.tsx
    components/
      TagButton.test.tsx
      PresenceIndicator.test.tsx
e2e/
  signup-flow.spec.ts
  create-campaign.spec.ts
  create-session.spec.ts
  edit-note.spec.ts
  real-time-collab.spec.ts
```

---

## Testing Checklist

### Per Feature
Before marking a feature complete:

#### Manual Testing
- [ ] Desktop browser (Chrome, Firefox, Safari)
- [ ] Mobile browser (Chrome Mobile, Safari iOS)
- [ ] Dark mode toggle works
- [ ] Keyboard shortcuts work (Ctrl+B, Ctrl+I, etc.)
- [ ] Touch gestures work on mobile (tap, swipe, pinch)

#### Collaboration Testing
- [ ] Two users can edit same session simultaneously
- [ ] Presence cursors show correctly
- [ ] Changes propagate in < 500ms
- [ ] Offline then reconnect works
- [ ] Data persists after browser refresh

#### Edge Cases
- [ ] Empty state (no campaigns, no sessions)
- [ ] Large text (TTRPG notes can be long!)
- [ ] Special characters (quotes, brackets, unicode)
- [ ] Network failure during edit
- [ ] Slow network (simulate with DevTools throttling)

#### Security
- [ ] Cannot access other user's campaigns
- [ ] Invite links work for non-authenticated users
- [ ] Password reset works
- [ ] No sensitive data in console

---

## Example Test Cases

### Unit Test: Date Formatting
```typescript
// src/__tests__/utils/date-format.test.tsx
import { formatSessionDate } from '../../lib/date-utils'

describe('formatSessionDate', () => {
  it('formats date as "Session 1 - Jan 15, 2026"', () => {
    expect(formatSessionDate(new Date('2026-01-15'))).toBe('Session 1 - Jan 15, 2026')
  })

  it('handles missing dates', () => {
    expect(formatSessionDate(null)).toBe('Untitled')
  })
})
```

### E2E Test: Signup Flow
```typescript
// e2e/signup-flow.spec.ts
import { test, expect } from '@playwright/test'

test('user can signup and create first campaign', async ({ page }) => {
  await page.goto('/auth')

  // Fill signup form
  await page.getByPlaceholder('Email').fill('dm@example.com')
  await page.getByPlaceholder('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign Up' }).click()

  // Wait for verification email (simulated)
  await page.waitForTimeout(2000)

  // Should be redirected to dashboard
  await expect(page).toHaveURL('/dashboard')
})
```

### Manual Test: Real-Time Collab
1. Open same session in two browser windows
2. In Window A, type "The party arrives at the tavern"
3. In Window B, verify text appears instantly
4. In Window A, click "Bold" and type "Important!"
5. In Window B, verify text is bold
6. In Window B, move cursor and verify presence indicator shows

---

## Performance Benchmarks

### Acceptable Thresholds
- Initial page load: < 3 seconds on 3G
- Real-time update latency: < 500ms
- Large note (10k chars) load time: < 2 seconds

---

## Accessibility Checklist

Before deploying any UI change:

- [ ] Color contrast passes WCAG 2.1 AA
- [ ] All interactive elements have keyboard focus
- [ ] Focus order is logical
- [ ] Screen reader announces button labels
- [ ] Error messages are announced to screen readers
- [ ] Alt text on images (if any)

---

## Debugging Tips

### Real-Time Collab Issues
```javascript
// Add to browser console for Liveblocks debugging
console.log('Liveblocks room:', liveblocks?.room)
console.log('Presence:', liveblocks?.presence)
```

### Supabase Query Debugging
```typescript
// Enable Supabase logs
SUPABASE_LOG_LEVEL=debug
```

---

## CI/CD Integration

When connected to GitHub, these commands run on push:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run lint
```

---

*Updated: March 2026*
