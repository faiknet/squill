/**
 * POST /snapshot-note
 *
 * Called by Liveblocks webhook on room disconnect.
 * Converts Yjs doc to Markdown and persists to session_notes.
 *
 * Request:
 *   - session_id: UUID string
 *   - content_md: Markdown string (Yjs doc content)
 *
 * Response:
 *   - { session_id, message, updated_at }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Webhook-Signature',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, content_md, updated_at } = await req.json()

    if (!session_id || content_md === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id or content_md' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client (service role for bypassing RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the campaign_id for this session (via sessions table)
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

    // Upsert the snapshot
    const { data, error: insertError } = await supabase
      .from('session_notes')
      .upsert({
        session_id: session_id,
        content_md: content_md,
        liveblocks_id: session_id, // Same as session_id for simplicity
        updated_at: updated_at || new Date().toISOString(),
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
        updated_at: data.updated_at || updated_at
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
