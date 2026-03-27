import { useMemo, useState } from 'react'
import { Button, Card, Input } from '../components/ui'

const STORAGE_KEY = 'squill-bypass-workspace-v1'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { campaigns: [] }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.campaigns) ? parsed : { campaigns: [] }
  } catch {
    return { campaigns: [] }
  }
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export default function BypassApp() {
  const [state, setState] = useState(loadState)
  const [campaignName, setCampaignName] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState(state.campaigns[0]?.id ?? null)
  const [selectedSessionId, setSelectedSessionId] = useState(null)

  const selectedCampaign = useMemo(
    () => state.campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [state.campaigns, selectedCampaignId]
  )
  const selectedSession = useMemo(
    () => selectedCampaign?.sessions.find((s) => s.id === selectedSessionId) ?? null,
    [selectedCampaign, selectedSessionId]
  )

  const updateState = (updater) => {
    setState((current) => {
      const next = updater(current)
      saveState(next)
      return next
    })
  }

  const createCampaign = (event) => {
    event.preventDefault()
    const name = campaignName.trim()
    if (!name) return
    const nextCampaign = { id: crypto.randomUUID(), name, sessions: [] }
    updateState((current) => ({ ...current, campaigns: [nextCampaign, ...current.campaigns] }))
    setSelectedCampaignId(nextCampaign.id)
    setSelectedSessionId(null)
    setCampaignName('')
  }

  const createSession = (event) => {
    event.preventDefault()
    if (!selectedCampaign) return
    const name = sessionName.trim()
    if (!name) return
    const nextSession = { id: crypto.randomUUID(), name, content: '' }
    updateState((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) =>
        campaign.id === selectedCampaign.id
          ? { ...campaign, sessions: [nextSession, ...campaign.sessions] }
          : campaign
      ),
    }))
    setSelectedSessionId(nextSession.id)
    setSessionName('')
  }

  const updateContent = (value) => {
    if (!selectedCampaign || !selectedSession) return
    updateState((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) =>
        campaign.id !== selectedCampaign.id
          ? campaign
          : {
              ...campaign,
              sessions: campaign.sessions.map((session) =>
                session.id === selectedSession.id ? { ...session, content: value } : session
              ),
            }
      ),
    }))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-xs text-brand-300">Bypass mode active (auth/backend disabled temporarily)</p>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <Card className="md:col-span-3 bg-gray-900 border-gray-800">
            <h2 className="font-semibold mb-3">Campaigns</h2>
            <form onSubmit={createCampaign} className="space-y-2 mb-3">
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign" />
              <Button type="submit" className="w-full">Add Campaign</Button>
            </form>
            <div className="space-y-2">
              {state.campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => {
                    setSelectedCampaignId(campaign.id)
                    setSelectedSessionId(campaign.sessions[0]?.id ?? null)
                  }}
                  className="w-full text-left rounded border border-gray-800 bg-gray-950 p-2"
                >
                  {campaign.name}
                </button>
              ))}
            </div>
          </Card>

          <Card className="md:col-span-4 bg-gray-900 border-gray-800">
            <h2 className="font-semibold mb-3">Sessions</h2>
            {selectedCampaign ? (
              <form onSubmit={createSession} className="space-y-2 mb-3">
                <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Session" />
                <Button type="submit" variant="secondary" className="w-full">Add Session</Button>
              </form>
            ) : null}
            <div className="space-y-2">
              {(selectedCampaign?.sessions ?? []).map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className="w-full text-left rounded border border-gray-800 bg-gray-950 p-2"
                >
                  {session.name}
                </button>
              ))}
            </div>
          </Card>

          <Card className="md:col-span-5 bg-gray-900 border-gray-800">
            <h2 className="font-semibold mb-3">{selectedSession?.name ?? 'Session notes'}</h2>
            <textarea
              className="w-full min-h-[320px] rounded border border-gray-700 bg-gray-950 p-3 text-sm"
              value={selectedSession?.content ?? ''}
              onChange={(e) => updateContent(e.target.value)}
              placeholder="Write notes here..."
              disabled={!selectedSession}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
