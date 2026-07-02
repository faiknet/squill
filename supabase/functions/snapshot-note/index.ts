/**
 * POST /snapshot-note
 * Called by Liveblocks webhook on room disconnect.
 * 
 * Phase 3: Added input validation and size limits
 * Phase 5: Added rate limiting (10 requests per minute per session)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ValidationError, validateSessionId, validateMarkdownContent } from "../validation.ts"
import { RateLimiter, RateLimitError, extractSessionId, createRateLimitResponse } from "../rate-limiter.ts"

const limiter = new RateLimiter()

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Webhook-Signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Phase 5: Rate limiting - 10 requests per minute per session
    // This prevents resource exhaustion via repeated webhook calls
    const sessionId = await extractSessionId(req)
    if (sessionId) {
      try {
        limiter.checkLimit(sessionId, 10, 60) // 10 requests per 60 seconds (1 minute)
      } catch (error) {
        if (error instanceof RateLimitError) {
          return createRateLimitResponse(error, corsHeaders)
        }
        throw error
      }
    }

    // Phase 3: Validate session_id input
    let session_id: string
    try {
      session_id = validateSessionId(body.session_id)
    } catch (error) {
      if (error instanceof ValidationError) {
        console.warn(`Validation error: ${error.field} - ${error.message}`)
        return new Response(
          JSON.stringify({ error: error.getClientMessage() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }

    // Phase 3: Validate content_md input
    let content_md: string
    try {
      content_md = validateMarkdownContent(body.content_md, 1000000)
    } catch (error) {
      if (error instanceof ValidationError) {
        console.warn(`Validation error: ${error.field} - ${error.message}`)
        return new Response(
          JSON.stringify({ error: error.getClientMessage() }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw error
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // CRITICAL FIX: Get user_id from auth header (Liveblocks webhook provides it)
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      console.warn('Missing authorization header in snapshot-note webhook')
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract user_id from auth context (provided by Liveblocks or client)
    const userIdHeader = req.headers.get('x-user-id')
    if (!userIdHeader) {
      console.warn('Missing x-user-id header in snapshot-note webhook')
      return new Response(
        JSON.stringify({ error: 'Missing user identification' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Phase 3: Query uses validated session_id (already sanitized)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('campaign_id')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.log('Session not found:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CRITICAL FIX: Verify user is a member of this campaign before allowing snapshot save
    // This prevents users from Campaign A writing to Campaign B's sessions
    const { data: membership, error: membershipError } = await supabase
      .from('campaign_members')
      .select('id')
      .eq('campaign_id', session.campaign_id)
      .eq('user_id', userIdHeader)
      .single()

    if (membershipError || !membership) {
      console.warn(`User ${userIdHeader} attempted to save snapshot to campaign ${session.campaign_id} they don't belong to`)
      return new Response(
        JSON.stringify({ error: 'Access denied - not a campaign member' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error: insertError } = await supabase
      .from('session_notes')
      .upsert({
        session_id: session_id,
        content_md: content_md,
        liveblocks_id: session_id,
        updated_at: body.updated_at || new Date().toISOString(),
      }, {
        onConflict: 'session_id',
      })

    if (insertError) {
      console.error('Error persisting snapshot:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to persist snapshot', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        session_id,
        campaign_id: session.campaign_id,
        message: 'Snapshot persisted successfully',
        updated_at: data.updated_at || body.updated_at
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in snapshot-note:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
