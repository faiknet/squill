import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import { requireSupabase } from '../lib/supabase'
import { Button, Card, LoadingSpinner } from '../components/ui'
import { validateUpdateCampaign, ValidationError } from '../lib/validation'

export default function CampaignSettings() {
  const { campaignSlug } = useParams()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const { isGuest } = authState
  const currentUserId = authState.user?.id ?? null

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [streakCadence, setStreakCadence] = useState('weekly')
  const [labelCampaign, setLabelCampaign] = useState('Campaign')
  const [labelSession, setLabelSession] = useState('Session')
  const [labelMember, setLabelMember] = useState('Players')
  const [labelGm, setLabelGm] = useState('GM')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    document.title = 'GM Settings — Squill'
  }, [])

  useEffect(() => {
    if (authState.isLoading) return

    if (isGuest) {
      navigate(`/campaigns`, { replace: true })
      return
    }

    async function loadCampaign() {
      try {
        const client = requireSupabase()
        const { data, error } = await client
          .from('campaigns')
          .select('id, slug, name, description, created_by, streak_cadence, label_campaign, label_session, label_member, label_gm')
          .eq('slug', campaignSlug)
          .single()

        if (error || !data) {
          navigate('/campaigns')
          return
        }

        // Only GMs can access settings
        if (data.created_by !== currentUserId) {
          navigate(`/campaigns/${campaignSlug}`)
          return
        }

        setCampaign(data)
        setStreakCadence(data.streak_cadence || 'weekly')
        setLabelCampaign(data.label_campaign || 'Campaign')
        setLabelSession(data.label_session || 'Session')
        setLabelMember(data.label_member || 'Players')
        setLabelGm(data.label_gm || 'GM')
      } catch (err) {
        console.error('Failed to load campaign settings:', err)
        setErrorMessage('Failed to load campaign settings.')
      } finally {
        setLoading(false)
      }
    }

    loadCampaign()
  }, [campaignSlug, isGuest, authState.isLoading, currentUserId, navigate])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    if (!campaign) return

    try {
      setSaving(true)
      setErrorMessage('')
      setSuccessMessage('')

      // Validate streakCadence
      const validated = validateUpdateCampaign({
        streakCadence: streakCadence,
      })

      const client = requireSupabase()
      const { data: updatedCampaignData, error } = await client.rpc('update_campaign_as_gm_with_streak', {
        p_campaign_id: campaign.id,
        p_name: campaign.name,
        p_description: campaign.description,
        p_streak_cadence: validated.streakCadence,
        p_label_campaign: labelCampaign,
        p_label_session: labelSession,
        p_label_member: labelMember,
        p_label_gm: labelGm,
      })

      if (error) throw error

      setSuccessMessage('Campaign settings saved successfully.')
      
      // Auto-navigate back to the campaign detail page after a brief delay
      setTimeout(() => {
        navigate(`/campaigns/${campaignSlug}`)
      }, 1000)
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrorMessage(err.getClientMessage())
      } else {
        setErrorMessage(err.message || 'Failed to save settings. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Breadcrumb / Back Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/campaigns/${campaignSlug}`)}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {campaign?.name || 'Campaign'}
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-gray-100 font-sans">
          GM Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Configure Game Master preferences and settings for {campaign?.name}.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 flex items-center justify-between" role="alert">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-sm font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md border border-green-200 dark:border-green-900/50" role="status">
          <span>{successMessage}</span>
        </div>
      )}

      {/* Single form wrapping all bento cards to preserve save cohesion */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-6">
          
          {/* Streak Cadence Settings Bento Tile */}
          <section aria-labelledby="streak-settings-heading">
            <Card className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08)] transition-all duration-200">
              <h3 id="streak-settings-heading" className="font-semibold text-lg text-brand-600 dark:text-brand-400 mb-1">
                Campaign Streak Cadence
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">
                Determine how frequently players need to write session notes to maintain their streak.
              </p>

              <div>
                <label htmlFor="streak-cadence" className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Streak Cadence
                </label>
                <select
                  id="streak-cadence"
                  value={streakCadence}
                  onChange={(e) => setStreakCadence(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </Card>
          </section>

          {/* Custom Terminology Bento Tile */}
          <section aria-labelledby="custom-labels-heading">
            <Card className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08)] transition-all duration-200">
              <h3 id="custom-labels-heading" className="font-semibold text-lg text-brand-600 dark:text-brand-400 mb-1">
                Custom Terminology
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">
                Customize what entities are called throughout the interface for this campaign.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="label-campaign" className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Campaign Noun
                  </label>
                  <select
                    id="label-campaign"
                    value={labelCampaign}
                    onChange={(e) => setLabelCampaign(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="Campaign">Campaign</option>
                    <option value="Book">Book</option>
                    <option value="Story">Story</option>
                    <option value="Project">Project</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="label-session" className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Session Noun
                  </label>
                  <select
                    id="label-session"
                    value={labelSession}
                    onChange={(e) => setLabelSession(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="Session">Session</option>
                    <option value="Chapter">Chapter</option>
                    <option value="Note">Note</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="label-member" className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Party Member Noun
                  </label>
                  <select
                    id="label-member"
                    value={labelMember}
                    onChange={(e) => setLabelMember(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="Members">Members</option>
                    <option value="Players">Players</option>
                    <option value="Editors">Editors</option>
                    <option value="Collaborators">Collaborators</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="label-gm" className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Game Master (GM) Noun
                  </label>
                  <select
                    id="label-gm"
                    value={labelGm}
                    onChange={(e) => setLabelGm(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="GM">GM</option>
                    <option value="DM">DM</option>
                    <option value="Author">Author</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>
            </Card>
          </section>

        </div>

        {/* Global Save/Cancel Buttons */}
        <div className="flex justify-end pt-4 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/campaigns/${campaignSlug}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-700 shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}
