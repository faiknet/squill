# Performance Optimization Plan

## Guiding Principle

> This is a lightweight text editor. Every millisecond of latency, every unnecessary re-render, and every extra kilobyte of bundle size directly degrades the typing and editing experience.

---

## Critical Issues (Blocking-Level Impact)

### C1: GoogleDocsToolbar Re-renders on Every Keystroke

**Problem:** Three compounding issues make the toolbar re-render on every single keystroke:

1. **`IconButton` defined inside render** (`GoogleDocsToolbar.jsx:212-227`) — Creates a new component class on every render, causing React to unmount/remount all button DOM nodes every time.
2. **`forceUpdate({})` on every `selectionUpdate`** (`GoogleDocsToolbar.jsx:173`) — Every cursor movement or selection change triggers a full toolbar re-render.
3. **No `React.memo`** on the toolbar component itself.

**Impact:** Every keystroke re-renders ~40+ toolbar buttons, dropdowns, and color pickers. For a text editor, this is the most user-facing performance issue.

**Fix:**
- Move `IconButton`, `MaterialIcon`, and `ColorPicker` **outside** the component (to module scope) so they are stable references
- Replace `forceUpdate({})` with targeted state selectors — only re-render the parts that actually need updating (font size display, active button states)
- Wrap `GoogleDocsToolbar` in `React.memo` with a custom comparator that only re-renders when the editor's active marks actually change
- Use `useRef` for the editor instance instead of re-reading it from closure

---

### C2: Activity Log Polling Every 5 Seconds

**Problem:** (`useSessionData.js:244`) Polls the database every 5 seconds for activity logs, even when:
- The user hasn't opened the sidebar
- No new activity has occurred (unnecessary queries)
- The tab is backgrounded (wasteful)

**Impact:** Continuous network requests + state updates → re-renders of `SessionEditor` and `PresenceSidebar` every 5 seconds indefinitely.

**Fix:**
- Increase poll interval to 30 seconds (more than sufficient for activity awareness)
- Only poll when the sidebar is expanded (check `isSidebarCollapsed` prop)
- Use `visibilitychange` event to pause polling when tab is backgrounded
- Use `document.hidden` check to skip polls when tab is not visible

---

### C3: @react-pdf/renderer in Main Bundle (~500KB)

**Problem:** (`sessionNoteExport.js:2-3`) Static imports:
```js
import { Document, Page, StyleSheet, pdf } from '@react-pdf/renderer'
import { renderToStaticMarkup } from 'react-pdf-html'
```

These add ~500KB+ to the initial JavaScript bundle despite only being used on the rare "Export as PDF" action.

**Fix:** Convert to dynamic imports inside the export function:
```js
async function exportPdf(...) {
  const { default: pdfModule } = await import('@react-pdf/renderer')
  const { renderToStaticMarkup } = await import('react-pdf-html')
  // ...
}
```

---

## High Priority Issues

### H1: No React.memo on Any Major Component

**Problem:** All major components (`PresenceSidebar`, `MentionDropdown`, `GoogleDocsToolbar`, `CampaignList`, `CampaignDetail`, `EditorLayout`, `CollaborativeSessionContent`) lack `React.memo`.

**Impact:** Every parent re-render cascades through the entire component tree, causing unnecessary VDOM diffing and DOM updates.

**Fix:** Wrap each in `React.memo`. For components with object/array props (`activeUsers`, `campaignMembers`, `activities`), provide a custom comparator or stabilize references in the parent.

---

### H2: Unthrottled Sidebar Resize Handler

**Problem:** (`SessionEditor.jsx:140-155`) `mousemove` handler on `document` fires at 60+ events/second during resize, each calling `getBoundingClientRect()` + `setSidebarWidth()` (React state update).

**Impact:** Layout thrashing + 60 React state updates/second during resize. The `transition-none` class hack (line 322) is a symptom, not a fix.

**Fix:**
- Throttle with `requestAnimationFrame` — coalesce multiple `mousemove` events into a single state update per frame
- Use `useRef` for the width during resize, only flushing to state on `mouseup`
- Consider CSS `resize: horizontal` as a native alternative

---

### H3: Editor Content Sync Loop Risk

**Problem:** (`LocalEditor.jsx:247-272`) The cycle `onUpdate → setNoteContent → useEffect → setContent → onUpdate` is fragile. While `emitUpdate: false` prevents the loop, `editor.getHTML()` can return different strings for identical content (attribute ordering, self-closing tags), causing false-positive content differences.

**Impact:** Potential render loop, unnecessary HTML re-parsing, and wasted CPU on every keystroke. For a text editor, this directly degrades typing responsiveness.

**Fix:**
- Debounce the `setNoteContent` call in `onUpdate` (100ms) so rapid keystrokes only serialize once
- Use a document hash rather than full HTML string comparison
- Only run the `useEffect` sync on initial content load, not on every update (use a ref to track "first load" vs "user edit")

---

### H4: 27 Separate useState Calls in CampaignDetail (948-line component)

**Problem:** (`CampaignDetail.jsx:50-75`) Every `useState` setter triggers a full re-render of the entire 948-line component. Modal visibility, form state, and data state are all mixed together.

**Impact:** Toggling a modal visibility re-renders the session list, party member list, all buttons, and the edit form simultaneously.

**Fix:**
- Consolidate modal states into a single `useReducer`:
  ```js
  const [modal, dispatch] = useReducer(modalReducer, { type: 'NONE' })
  ```
- Split the component into smaller sub-components (`CampaignHeader`, `PartyMemberList`, `SessionList`, `CampaignEditForm`, `ModalManager`) — each can independently render
- Extract the campaign edit form into its own component with its own state

---

### H5: Missing useMemo on Filtered Lists (Rendered Twice)

**Problem:** (`CampaignList.jsx:469, 542-543`) `campaigns.filter(...)` runs twice per render (once for desktop table, once for mobile cards). Same for the `.map()`.

**Impact:** Double O(n) iteration of the campaigns array on every render (including re-renders from polling, auth state, etc.).

**Fix:**
```js
const filteredCampaigns = useMemo(
  () => campaigns.filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())),
  [campaigns, searchQuery]
)
```

---

## Medium Priority Issues

### M1: Costly `activities` Computation on Every Poll

**Problem:** (`SessionEditor.jsx:590-702`) The 112-line `useMemo` for `activities` runs every time `activityLogs`, `tags`, or `campaignMembers` change. It has nested O(n*m) lookups.

**Fix:**
- Create a `Map` lookup for campaign members (`userId → displayName`) as a separate `useMemo`
- Use the lookup map in the activities computation instead of `.find()` inside loops
- Consider moving this computation into the `useSessionData` hook so it can be memoized there

---

### M2: N+1 Color Queries

**Problem:** (`useSessionData.js:169-188` and `CampaignDetail.jsx:168`) User colors are fetched via a separate RPC call after members are loaded, rather than being joined in the initial query.

**Fix:**
- Create a Supabase database view that joins members with their color preferences
- Or add `editor_color` to the `get_campaign_members` RPC return type
- Batch the color fetch into the parallel query block

---

### M3: `transition: all` on Mention Elements

**Problem:** (`mentions.css:10`) `transition: all 0.2s ease` on every `span[data-mention-type]` causes the browser to check all animatable properties on each style change.

**Fix:** Replace with specific transitions only for properties that actually animate (e.g., `transition: background-color 0.2s ease, color 0.2s ease`).

---

### M4: Expensive SVG Mask Images on Every Mention

**Problem:** (`mentions.css:33-51`) Every entity mention uses a `::before` pseudo-element with `-webkit-mask-image: url('/icons/NPCs.png')` etc. Each mention triggers a network fetch for the icon.

**Fix:**
- Use inline SVG data URIs instead of external PNGs for mention icons
- Or use a CSS class-based approach with a sprite sheet
- Or use simple colored dots/badges instead of full icons (faster paint)

---

### M5: Sequential API Calls in loadCampaign

**Problem:** (`CampaignDetail.jsx:138-226`) Campaign query → members → colors → sessions are fetched sequentially instead of in parallel.

**Fix:**
```js
const [campaignRes, sessionsRes] = await Promise.all([
  client.from('campaigns').select('...').eq('slug', campaignSlug).single(),
  client.from('sessions').select('...').eq('campaign_id', ...),
])
// Then parallel members + colors after campaign is resolved
```

---

## Low Priority / Nice-to-Have

### L1: `showOfflineMembers` as useRef Instead of useState

`SessionEditor.jsx:534` — This value is read from localStorage once and never updated. Should be `useRef` or a module-level constant.

### L2: `menuPosition` as useRef in CampaignList

`CampaignList.jsx:33` — The position object only affects the absolutely-positioned menu; it doesn't need to trigger re-renders.

### L3: image `loading="lazy"` on All Images

Add `loading="lazy"` to all `<img>` tags — particularly the logo, streak icon, and modal icons.

### L4: date-fns Tree Shaking

If only `formatDistanceToNow` is used, replace with a simple custom implementation (~10 lines) to eliminate the entire dependency.

### L5: Move `IconButton` and `ColorPicker` Out of GoogleDocsToolbar

Defining these at module scope (not inside the component) prevents React from remounting their DOM on every render.

---

## Implementation Order

| Phase | Issues | Effort | Impact |
|-------|--------|--------|--------|
| **Phase 1: Editor responsiveness** | C1, H3, L5 | 2-3h | Highest — directly affects typing feel |
| **Phase 2: Bundle size** | C3, L4 | 1h | High — reduces initial load time |
| **Phase 3: Re-render elimination** | H1, H2, H4, H5, M1 | 4-6h | High — reduces CPU waste |
| **Phase 4: Data layer** | C2, H2, M2, M5 | 2-3h | Medium — reduces network + re-renders |
| **Phase 5: CSS/assets** | M3, M4, L3 | 1-2h | Medium — smoother paint |
| **Phase 6: Refinements** | L1, L2 | 0.5h | Low — marginal gains |

---

## Key Metrics to Track

- **Before:** How many re-renders does `GoogleDocsToolbar` trigger per keystroke? (React DevTools Profiler)
- **After:** Bundle size reduction from dynamic imports (use `vite build --report`)
- **Before/After:** Activity log network requests per minute (DevTools Network tab)
- **Before/After:** FPS during sidebar resize (DevTools Performance tab)
