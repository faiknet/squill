/**
 * Demo data for guest users - temporary D&D campaign and session
 */

// Stable IDs for guest demo data (consistent across page loads within a session)
export const GUEST_CAMPAIGN_ID = '00000000-0000-0000-0000-000000000001'
export const GUEST_SESSION_ID = '00000000-0000-0000-0000-000000000002'
export const GUEST_CAMPAIGN_SLUG = 'the-lost-mines-of-phandelver-demo'
export const GUEST_SESSION_SLUG = 'goblin-ambush-demo'
const GUEST_CAMPAIGNS_STORAGE_KEY = 'squill_guest_campaigns'
const GUEST_SESSIONS_STORAGE_KEY = 'squill_guest_sessions'

function buildGuestCampaign(userId: string) {
  return {
    id: GUEST_CAMPAIGN_ID,
    slug: GUEST_CAMPAIGN_SLUG,
    name: 'The Lost Mines of Phandelver',
    description: `A classic adventure for aspiring heroes! The dwarf Gundren Rockseeker has hired you to escort a wagon of supplies to the rough-and-tumble settlement of Phandalin. But danger lurks on the Triboar Trail, and Gundren's secret discovery of the long-lost Wave Echo Cave has drawn the attention of sinister forces...

This demo campaign showcases Squill's features. Feel free to explore, edit session notes, and try out the collaborative tools!`,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    updated_at: new Date().toISOString(),
    created_by: userId,
    invite_code: 'DEMO1234',
    party_size: 4,
    session_count: 1,
    pinned: true,
  }
}

function loadStoredGuestCampaigns() {
  try {
    const raw = sessionStorage.getItem(GUEST_CAMPAIGNS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveStoredGuestCampaigns(campaigns: unknown[]) {
  try {
    sessionStorage.setItem(GUEST_CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns))
  } catch {
    // Ignore storage errors
  }
}

function loadStoredGuestSessions() {
  try {
    const raw = sessionStorage.getItem(GUEST_SESSIONS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveStoredGuestSessions(sessions: unknown[]) {
  try {
    sessionStorage.setItem(GUEST_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Ignore storage errors
  }
}

export function getGuestCampaign(userId: string) {
  return buildGuestCampaign(userId)
}

export function getGuestCampaigns(userId: string) {
  const stored = loadStoredGuestCampaigns()
  if (stored && stored.length > 0) return stored

  const seeded = [buildGuestCampaign(userId)]
  saveStoredGuestCampaigns(seeded)
  return seeded
}

export function createGuestCampaign(userId: string, payload: { name: string; description?: string; slug: string }) {
  const campaigns = getGuestCampaigns(userId)
  const now = new Date().toISOString()
  const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()

  const campaign = {
    id: crypto.randomUUID(),
    slug: payload.slug,
    name: payload.name,
    description: payload.description || '',
    created_at: now,
    updated_at: now,
    created_by: userId,
    invite_code: inviteCode,
    party_size: 1,
    session_count: 0,
    pinned: false,
  }

  const updated = [campaign, ...campaigns]
  saveStoredGuestCampaigns(updated)
  return campaign
}

function buildSeedGuestSession(campaignId: string) {
  const sessionDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  return {
    id: GUEST_SESSION_ID,
    slug: GUEST_SESSION_SLUG,
    name: 'Session 1: Goblin Ambush',
    campaign_id: campaignId,
    session_date: sessionDate.toISOString().split('T')[0], // Just the date part: "YYYY-MM-DD"
    archived: false,
    created_at: sessionDate.toISOString(),
  }
}

export function getGuestSession(campaignId: string) {
  return buildSeedGuestSession(campaignId)
}

export function getGuestSessionsForCampaign(campaignId: string) {
  const stored = loadStoredGuestSessions() || []
  let sessionsForCampaign = stored.filter((s) => s.campaign_id === campaignId)

  // Ensure seeded demo session exists for the default demo campaign
  if (campaignId === GUEST_CAMPAIGN_ID && sessionsForCampaign.length === 0) {
    const seeded = buildSeedGuestSession(campaignId)
    const updated = [seeded, ...stored]
    saveStoredGuestSessions(updated)
    sessionsForCampaign = [seeded]
  }

  return sessionsForCampaign
}

export function getGuestCampaignBySlug(userId: string, campaignSlug: string) {
  const campaigns = getGuestCampaigns(userId)
  return campaigns.find((campaign) => campaign.slug === campaignSlug) || null
}

export function getGuestSessionBySlug(userId: string, campaignSlug: string, sessionSlug: string) {
  const campaign = getGuestCampaignBySlug(userId, campaignSlug)
  if (!campaign) return null
  const sessions = getGuestSessionsForCampaign(campaign.id)
  const session = sessions.find((item) => item.slug === sessionSlug)
  if (!session) return null
  return { campaign, session }
}

export function createGuestSession(campaignId: string, payload: { name: string; sessionDate?: string | null; slug: string }) {
  const sessions = loadStoredGuestSessions() || []
  const now = new Date().toISOString()

  const session = {
    id: crypto.randomUUID(),
    campaign_id: campaignId,
    slug: payload.slug,
    name: payload.name,
    session_date: payload.sessionDate || null,
    archived: false,
    created_at: now,
  }

  const updated = [session, ...sessions]
  saveStoredGuestSessions(updated)
  return session
}

export function getGuestSessionNote() {
  return `<h2>Session 1: Goblin Ambush</h2>
<p>Our adventure begins on the <span data-mention="true" data-mention-type="entity" data-mention-entity-type="location" data-mention-id="00000000-0000-0000-0000-000000000012" data-mention-label="Triboar Trail">Triboar Trail</span>, a day's journey from <span data-mention="true" data-mention-type="entity" data-mention-entity-type="location" data-mention-id="00000000-0000-0000-0000-000000000016" data-mention-label="Neverwinter">Neverwinter</span>...</p>

<h3>🎭 The Setup</h3>
<p>The party was hired by <span data-mention="true" data-mention-type="entity" data-mention-entity-type="npc" data-mention-id="00000000-0000-0000-0000-000000000010" data-mention-label="Gundren Rockseeker">Gundren Rockseeker</span>, a friendly dwarf prospector, to escort a wagon of mining supplies to the frontier town of <span data-mention="true" data-mention-type="entity" data-mention-entity-type="location" data-mention-id="00000000-0000-0000-0000-000000000017" data-mention-label="Phandalin">Phandalin</span>. Gundren rode ahead with his warrior companion <span data-mention="true" data-mention-type="entity" data-mention-entity-type="npc" data-mention-id="00000000-0000-0000-0000-000000000011" data-mention-label="Sildar Hallwinter">Sildar Hallwinter</span>, promising to meet the party at Barthen's Provisions.</p>

<h3>⚔️ Ambush at the Trail</h3>
<p>About half a day from <span data-mention="true" data-mention-type="entity" data-mention-entity-type="location" data-mention-id="00000000-0000-0000-0000-000000000017" data-mention-label="Phandalin">Phandalin</span>, the party spotted two dead horses blocking the trail—unmistakably belonging to <span data-mention="true" data-mention-type="entity" data-mention-entity-type="npc" data-mention-id="00000000-0000-0000-0000-000000000010" data-mention-label="Gundren Rockseeker">Gundren Rockseeker</span> and <span data-mention="true" data-mention-type="entity" data-mention-entity-type="npc" data-mention-id="00000000-0000-0000-0000-000000000011" data-mention-label="Sildar Hallwinter">Sildar Hallwinter</span>! As they investigated:</p>
<ul>
  <li>Four <strong>goblins</strong> sprang from the underbrush!</li>
  <li>Arrows flew from concealed positions in the thicket</li>
  <li>The party fought valiantly, defeating the ambushers</li>
</ul>

<h3>🔍 Clues Discovered</h3>
<p>After the battle, the party found:</p>
<ul>
  <li>An <span data-mention="true" data-mention-type="entity" data-mention-entity-type="item" data-mention-id="00000000-0000-0000-0000-000000000014" data-mention-label="Empty Map Case">Empty Map Case</span> (Gundren's maps are missing!)</li>
  <li>A trail of goblin tracks leading northwest into the forest</li>
  <li>Signs of two humanoids being dragged along the trail</li>
</ul>

<h3>🗺️ What Lies Ahead</h3>
<p>The party must decide: Follow the goblin trail to rescue <span data-mention="true" data-mention-type="entity" data-mention-entity-type="npc" data-mention-id="00000000-0000-0000-0000-000000000010" data-mention-label="Gundren Rockseeker">Gundren Rockseeker</span> and <span data-mention="true" data-mention-type="entity" data-mention-entity-type="npc" data-mention-id="00000000-0000-0000-0000-000000000011" data-mention-label="Sildar Hallwinter">Sildar Hallwinter</span>? Or continue to <span data-mention="true" data-mention-type="entity" data-mention-entity-type="location" data-mention-id="00000000-0000-0000-0000-000000000017" data-mention-label="Phandalin">Phandalin</span> and seek aid? The <span data-mention="true" data-mention-type="entity" data-mention-entity-type="location" data-mention-id="00000000-0000-0000-0000-000000000013" data-mention-label="Cragmaw Hideout">Cragmaw Hideout</span> awaits those brave enough to venture into goblin territory...</p>

<hr>

<p><em>✨ Try editing these notes! Changes are saved automatically. You can also use the Entity Tags panel to track NPCs, locations, and items.</em></p>`
}

export function getGuestEntityTags(campaignId: string, sessionId: string) {
  const now = new Date().toISOString()
  return [
    {
      id: '00000000-0000-0000-0000-000000000010',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'npc',
      label: 'Gundren Rockseeker',
      description: 'A friendly dwarf prospector who hired the party. Currently missing after a goblin ambush.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'npc',
      label: 'Sildar Hallwinter',
      description: 'A human warrior and member of the Lords\' Alliance. Traveling with Gundren, now captured by goblins.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'location',
      label: 'Triboar Trail',
      description: 'A well-worn path connecting Neverwinter to the east. Site of the goblin ambush.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000013',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'location',
      label: 'Cragmaw Hideout',
      description: 'A goblin lair hidden in the forest. The trail from the ambush site leads here.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000014',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'item',
      label: 'Empty Map Case',
      description: 'Gundren\'s leather map case, found at the ambush site. The maps inside are missing.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000015',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'pet',
      label: 'Soot',
      description: 'A cautious raven companion that scouts the trail and watches for movement in the trees.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000016',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'location',
      label: 'Neverwinter',
      description: 'A major city on the Sword Coast, where the party started the journey.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000017',
      campaign_id: campaignId,
      session_id: sessionId,
      tag_type: 'location',
      label: 'Phandalin',
      description: 'A rough frontier town where the party is headed with supplies.',
      created_at: now,
      sessions: { name: 'Session 1: Goblin Ambush' },
    },
  ]
}

export function getGuestCampaignMembers(userId: string) {
  return [
    {
      user_id: userId,
      display_name: 'Guest',
      avatar_url: null,
      color: '#6366f1', // Indigo
    },
    {
      user_id: '00000000-0000-0000-0000-000000000020',
      display_name: 'Thorin Ironforge',
      avatar_url: null,
      color: '#ef4444', // Red
    },
    {
      user_id: '00000000-0000-0000-0000-000000000021',
      display_name: 'Elara Moonwhisper',
      avatar_url: null,
      color: '#22c55e', // Green
    },
    {
      user_id: '00000000-0000-0000-0000-000000000022',
      display_name: 'Grimshaw the Bold',
      avatar_url: null,
      color: '#f59e0b', // Amber
    },
  ]
}

export function getGuestActivityLogs(sessionId: string, userId: string) {
  const now = Date.now()
  return [
    {
      id: '00000000-0000-0000-0000-000000000030',
      session_id: sessionId,
      user_id: userId,
      action_type: 'edit_document',
      created_at: new Date(now - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      display_name: 'Guest',
      details: { session_name: 'Session 1: Goblin Ambush' },
    },
    {
      id: '00000000-0000-0000-0000-000000000031',
      session_id: sessionId,
      user_id: '00000000-0000-0000-0000-000000000020',
      action_type: 'create_entity',
      created_at: new Date(now - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      display_name: 'Thorin Ironforge',
      details: { label: 'Gundren Rockseeker', type: 'npc' },
    },
    {
      id: '00000000-0000-0000-0000-000000000032',
      session_id: sessionId,
      user_id: '00000000-0000-0000-0000-000000000021',
      action_type: 'create_entity',
      created_at: new Date(now - 45 * 60 * 1000).toISOString(), // 45 minutes ago
      display_name: 'Elara Moonwhisper',
      details: { label: 'Triboar Trail', type: 'location' },
    },
  ]
}
