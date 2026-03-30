/**
 * POST /join-campaign
 *
 * Adds the authenticated user to a campaign via invite link.
 *
 * Request:
 *   - invite_code: UUID string (from URL parameter)
 *
 * Response:
 *   - { campaign_id, message }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invite_code } = await req.json()

    if (!invite_code) {
      return new Response(
        JSON.stringify({ error: 'Missing invite_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Check if campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, invite_code')
      .eq('invite_code', invite_code)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found or invite link is invalid' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is already a member
    const { data: existingMembership } = await supabase
      .from('campaign_members')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('user_id', user.id)
      .single()

    if (existingMembership) {
      return new Response(
        JSON.stringify({
          campaign_id: campaign.id,
          message: 'You are already a member of this campaign'
        }),
        { headers: corsHeaders }
      )
    }

    // Add user to campaign_members
    const { error: membersError } = await supabase
      .from('campaign_members')
      .insert({
        campaign_id: campaign.id,
        user_id: user.id,
      })

    if (membersError) {
      console.error('Error adding member:', membersError)
      return new Response(
        JSON.stringify({ error: 'Failed to join campaign', details: membersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        message: 'Welcome to the campaign! You can now create and view sessions.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in join-campaign:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
