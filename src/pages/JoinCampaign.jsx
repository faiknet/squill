import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase'
import { Button, Card } from '../components/ui'
import { useAuth } from '../hooks/useSupabaseAuth'

function JoinCampaign() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [loading, setLoading] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState(null)
  const [campaignName, setCampaignName] = useState('')
  const [campaignId, setCampaignId] = useState('')

  useEffect(() => {
    if (!authState.isLoading && !authState.user) {
      const next = encodeURIComponent(`/join/${code || ''}`)
      navigate(`/auth?next=${next}`)
    }
  }, [authState.isLoading, authState.user, code, navigate])

  const handleJoin = async () => {
    if (!code) {
      setError('Invalid invite code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const client = requireSupabase()
      const { data: invokeData, error: invokeError } = await client.functions.invoke('join-campaign', {
        body: { invite_code: code },
      })

      if (!invokeError && invokeData?.campaign_id) {
        setCampaignName(invokeData.campaign_name || '')
        setCampaignId(invokeData.campaign_id)
        setJoined(true)
        return
      }

      const { data: rpcData, error: rpcError } = await client.rpc('join_campaign_by_invite', { p_invite_code: code })
      if (rpcError) {
        const message = String(rpcError.message || '')
        if (message.includes('Could not find the function public.join_campaign_by_invite')) {
          throw new Error('Server join helper is not installed. Apply migration 0003_join_campaign_rpc.sql in Supabase.')
        }
        throw rpcError
      }
      const joinedCampaign = Array.isArray(rpcData) ? rpcData[0] : rpcData
      if (!joinedCampaign?.campaign_id) throw new Error('Campaign not found')
      setCampaignName(joinedCampaign.campaign_name || '')
      setCampaignId(joinedCampaign.campaign_id)
      setJoined(true)
    } catch (error) {
      setError('Failed to join campaign: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="border-b border-slate-200 dark:border-gray-700 p-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 tracking-tight">Campaign Invite</h1>
        </div>
        <div className="p-6">
          {joined ? (
            <div className="text-center">
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-900/50">
                <p className="font-medium">Successfully joined the campaign!</p>
              </div>
              {campaignName && <p className="text-slate-600 dark:text-gray-400 mb-6">{campaignName}</p>}
              <Button onClick={() => navigate(campaignId ? `/campaigns/${campaignId}` : '/')} className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium">
                Open Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-900/50 text-sm">
                  {error}
                </div>
              )}

              {!error && <p className="text-slate-600 dark:text-gray-400 text-center">Join this campaign using the invite code.</p>}

              <Button
                onClick={handleJoin}
                className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium"
                disabled={loading}
              >
                {loading ? 'Joining...' : 'Join Campaign'}
              </Button>

              <Button onClick={() => navigate('/')} variant="outline" className="w-full border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default JoinCampaign
