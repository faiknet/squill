/**
 * POST /join-campaign
 * Adds the authenticated user to a campaign via invite link.
 * 
 * Phase 3: Added input validation and authorization checks
 * Phase 5: Added rate limiting (5 requests per 15 minutes per IP)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ValidationError, validateInviteCode, validateAuthorizationHeader } from "../validation.ts"
import { RateLimiter, RateLimitError, getClientIp, createRateLimitResponse } from "../rate-limiter.ts"

const limiter = new RateLimiter()

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Phase 5: Rate limiting - 5 requests per 15 minutes per IP
    // This protects against brute force attempts on invite codes
    const clientIp = getClientIp(req.headers)
    try {
      limiter.checkLimit(clientIp, 5, 900) // 5 requests per 900 seconds (15 minutes)
    } catch (error) {
      if (error instanceof RateLimitError) {
        return createRateLimitResponse(error, corsHeaders)
      }
      throw error
    }

    // Phase 3: Validate authorization header early
    try {
      validateAuthorizationHeader(req.headers.get('Authorization'))
    } catch (error) {
      if (error instanceof ValidationError) {
        return new Response(
          JSON.stringify({ error: error.getClientMessage() }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }

    const body = await req.json()

    // Phase 3: Validate invite_code input
    let invite_code: string
    try {
      invite_code = validateInviteCode(body.invite_code)
    } catch (error) {
      if (error instanceof ValidationError) {
        return new Response(
          JSON.stringify({ error: error.getClientMessage() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    })
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Phase 3: Query uses validated invite_code (already sanitized)
    const { data: campaign, error: campaignError } = await adminClient
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

    const { data: existingMembership } = await adminClient
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

    const { error: membersError } = await adminClient
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
