# Product Requirements — Scribe's Quill

**App:** Scribe's Quill — Collaborative TTRPG Campaign Notes
**Version:** MVP v1.0
**Status:** Ready for Development

---

## 📋 Product Overview

### Vision Statement
Scribe's Quill is a real-time collaborative note-taking web application purpose-built for tabletop roleplaying game (TTRPG) groups. It gives Dungeon Masters and players a shared digital workspace to capture, organize, and revisit session notes — all under a familiar campaign structure that mirrors how TTRPG parties actually play.

### Problem Statement
TTRPG groups currently struggle with fragmented note-keeping. Notes are scattered across personal apps, Discord threads, physical notebooks, or Google Docs — none of which are tailored to the rhythms of a campaign. Players miss key lore details, NPCs go untracked, and collective memory fades between sessions. There is no purpose-built tool that combines real-time collaboration with TTRPG-specific organization.

### Proposed Solution
Scribe's Quill provides a campaign-centric structure (Campaigns → Sessions → Notes) with real-time co-editing, TTRPG-aware tagging for NPCs, locations, and items, and a live presence system so players always know who is contributing right now. It removes friction from note-taking so parties can focus on the story.

---

## 🎯 Product Positioning

| Attribute | Detail |
|-----------|--------|
| **Category** | Collaborative TTRPG Session Notes Web App |
| **Target Users** | TTRPG players and Dungeon Masters (D&D, Pathfinder, and similar systems) |
| **Differentiator** | Real-time collaboration with TTRPG-specific structure and tagging |
| **Platform** | Web Browser (no install required) |
| **Monetization** | Free at launch; freemium infrastructure to be added post-MVP |

---

## 👥 Target Users & Personas

### Primary Personas

#### The Dungeon Master (DM)
The primary note-taker and campaign organizer. Creates campaigns, structures sessions, and needs to track a large volume of world-building information including NPCs, locations, plot threads, and loot. Wants a tool that stays out of the way during play and is easy to review between sessions.

#### The Player
Attends sessions and contributes their own perspective to shared notes. May add observations about story events, character interactions, or items discovered. Wants to read campaign notes between sessions without needing to maintain a separate personal journal.

### User Goals

| Goal | Description |
|------|-------------|
| Create a campaign | Set up a named campaign and invite their group via a shareable link |
| Organize sessions | Create and name individual session note documents within a campaign |
| Collaborate live | Edit notes in real time while seeing who else is actively writing |
| Format notes | Use rich text (headings, bold, lists) to structure information clearly |
| Tag game entities | Mark text as NPCs, locations, or items for future reference |
| Access past notes | Browse all session notes in a campaign to review lore and history |

---

## ✨ Features & Requirements

### MVP Feature Summary

| Feature | Description | Priority |
|---------|-------------|----------|
| User Accounts | Email/password authentication and user profile management | Must Have |
| Campaign Management | Create, name, and manage campaigns; generate invite links | Must Have |
| Session Organization | Create named session documents within a campaign | Must Have |
| Real-Time Collaboration | Multiple users editing simultaneously with live cursor/presence | Must Have |
| Rich Text Editing | Bold, italic, headings, bullet lists, numbered lists | Must Have |
| Entity Tagging | Tag text as NPC, Location, or Item with visual distinction | Must Have |
| Invite System | Share campaign invite links; anyone with link can join | Must Have |
| Responsive Web UI | Fully usable on desktop and mobile browsers | Should Have |
| Paid Tier Infrastructure | Backend structure for future subscription tiers (no UI yet) | Should Have |

---

### Feature Details

#### 3.2.1 User Accounts
Users register with an email address and password. Email verification should be required before accessing campaigns. Password reset via email is required. User profiles store a display name and optional avatar.

#### 3.2.2 Campaign Management
- Users can create one or more campaigns with a custom name and optional description.
- Each campaign has a unique invite link that the creator (or any member) can share.
- Anyone with the invite link can join a campaign by logging into or creating an account.
- Campaign members can view all sessions and contribute to any session note within that campaign.
- Campaign creators can delete a campaign or remove members.

#### 3.2.3 Session Organization
- Within each campaign, sessions are listed chronologically (newest first).
- Any campaign member can create a new session with a name and optional date.
- Sessions contain a single collaborative note document.
- Sessions can be renamed or archived by any member.

#### 3.2.4 Real-Time Collaborative Editing
- All users in a session note see each other's edits instantly, without a manual save or refresh.
- Active collaborators are shown as named cursors or presence avatars within the document.
- Each active user has a unique color so contributions are visually distinguishable.
- Changes persist automatically — there is no manual save action required.
- Conflict-free concurrent editing using Operational Transformation or CRDT (e.g., Yjs).

#### 3.2.5 Rich Text Formatting
- Heading levels: H1, H2, H3
- Inline: Bold, Italic, Underline, Strikethrough
- Lists: Bullet lists and numbered lists
- Horizontal rules for section separation
- Keyboard shortcuts for common formatting (Ctrl+B, Ctrl+I, etc.)

#### 3.2.6 Entity Tagging System
Users can highlight any text in a note and apply a TTRPG-specific tag:
- **NPC** — a named non-player character
- **Location** — a place in the game world
- **Item** — an object, weapon, or artifact

Tagged text is visually highlighted with a distinct color per tag type. Tags are searchable within a campaign and will form the basis of a future entity index/wiki feature.

#### 3.2.7 Invite System
- Campaign owners or members can generate and copy a shareable invite link.
- Invite links do not expire by default in the MVP.
- New users following an invite link are prompted to create an account or log in before joining.
- There are no role distinctions in MVP — all members have equal editing rights.

#### 3.2.8 Paid Tier Infrastructure (Non-Visible)
No paid tier or payment UI will be exposed in the MVP. However, the database schema and user model should include:
- A tier/plan field on user accounts (default: free)
- A feature flags or entitlements mechanism to gate features per tier
- A campaign count and collaborator count field to enforce future limits
This ensures future monetization can be layered on without requiring a full re-architecture.

---

## 📖 User Stories

| ID | User Story |
|----|------------|
| US-01 | As a new user, I want to create an account so I can access my campaigns. |
| US-02 | As a DM, I want to create a campaign and give it a name so I can organize my adventure. |
| US-03 | As a DM, I want to generate an invite link so my players can join my campaign. |
| US-04 | As a player, I want to join a campaign via invite link so I can access shared session notes. |
| US-05 | As a DM, I want to create a new session document so I can capture notes for tonight's session. |
| US-06 | As any member, I want to edit session notes in real time so I can collaborate with my party. |
| US-07 | As any member, I want to see who is currently editing so I know who is contributing. |
| US-08 | As any member, I want to format text with headings and bold so notes are easy to read. |
| US-09 | As any member, I want to tag text as an NPC, Location, or Item so I can track key entities. |
| US-10 | As any member, I want to browse past sessions so I can review campaign history. |
| US-11 | As a DM, I want to rename or delete sessions so I can keep the campaign tidy. |

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| **Activation** | User creates a campaign and invites at least one collaborator within 7 days of signup |
| **Engagement** | Average of 2+ session notes created per campaign per month |
| **Retention** | 40%+ of users return to the app within 14 days of first session note |
| **Collaboration** | 50%+ of sessions have 2 or more concurrent active editors at least once |
| **Stability** | Zero data loss incidents in the first 3 months post-launch |
| **Conversion Readiness** | Infrastructure in place to introduce a paid tier without a full rebuild |

---

## ⚠️ Assumptions & Risks

### Assumptions
- Users are comfortable using a web browser on desktop or mobile — no native app is needed at launch.
- The primary use case is live note-taking during a session, not async editing after the fact.
- Most campaigns will have 2–6 members, keeping real-time infrastructure at manageable scale.
- Users are comfortable creating an account with an email address.

### Risks

| Risk | Mitigation |
|------|------------|
| Real-time complexity | WebSocket and CRDT implementation adds engineering complexity. Mitigate by using a proven library (Yjs + Hocuspocus, or Liveblocks). |
| Low initial adoption | TTRPG tools market is niche. Mitigate by targeting communities on Reddit (r/DnD) and Discord. |
| Scope creep | Feature requests from TTRPG community may be broad. Mitigate by strictly adhering to MVP scope. |
| Monetization delay | Free-only launch may make revenue uncertain. Mitigate by building tier infrastructure early so paid features can ship quickly. |

---

## 🚀 Future Roadmap (Post-MVP)

### Phase 2 — Monetization & Power Features
- Introduce a paid tier (Pro) unlocking additional campaigns, more collaborators, and file attachments
- Export session notes to PDF or Markdown
- Note version history and change tracking

### Phase 3 — Deep TTRPG Integration
- Entity index: auto-generate a wiki from tagged NPCs, Locations, and Items
- Character and NPC profile pages within a campaign
- Session recap generator using AI summarization
- Integration with D&D Beyond, Roll20, or Foundry VTT

### Phase 4 — Platform Expansion
- Native mobile apps (iOS and Android)
- Offline mode with background sync
- Custom campaign themes and cover art
- Dice roller embedded in notes

---

## ❌ Out of Scope for MVP

- Paid subscription tiers or payment processing
- Mobile native apps (iOS / Android)
- Offline editing or sync
- Dice roller integration
- Character sheet or NPC tracking pages
- Image or file attachments in notes
- Export to PDF or Markdown
- Custom campaign themes or visual skins
- Version history or undo beyond a single session
- Third-party integrations (D&D Beyond, Roll20, Foundry VTT)
- Admin dashboard or analytics

---

*Updated: March 2026*
