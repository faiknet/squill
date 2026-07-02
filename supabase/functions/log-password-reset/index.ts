/**
 * POST /log-password-reset
 * Logs password reset requests for audit trail and user security history
 * 
 * Called by:
 * - useSupabaseAuth.ts when resetPasswordForEmail() is called
 * - Settings.jsx when user updates password
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const body = await req.json() as Record<string, unknown>

    // Require authentication for all requests
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify token and get user
    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const action = body.action as string | undefined
    const email = body.email as string | undefined

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract client info from headers
    const ipAddress = req.headers.get('X-Forwarded-For') || 
                      req.headers.get('CF-Connecting-IP') || 
                      req.headers.get('X-Real-IP') || 
                      'unknown'
    const userAgent = req.headers.get('User-Agent') || 'unknown'

    // Handle different password reset actions
    switch (action) {
      case 'reset_requested': {
        // User requested password reset email
        if (!email) {
          return new Response(
            JSON.stringify({ error: 'Missing email parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Log the reset request
        const { error: insertError } = await supabase
          .from('password_reset_tokens')
          .insert({
            user_id: user.id,
            email: email,
            status: 'pending',
            ip_address: ipAddress,
            user_agent: userAgent,
            notes: 'Password reset email requested',
          })

        if (insertError) {
          console.error('Error logging reset request:', insertError)
          return new Response(
            JSON.stringify({ error: 'Failed to log reset request' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Reset request logged' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'password_changed': {
        // User successfully changed password via reset link or settings
        const success = body.success as boolean | undefined

        // Log to password change audit
        const { error: auditError } = await supabase
          .from('password_change_audit')
          .insert({
            user_id: user.id,
            email: user.email,
            change_type: 'password_reset',
            status: success ? 'success' : 'failed',
            ip_address: ipAddress,
            user_agent: userAgent,
            notes: 'Password changed via reset link or settings update',
          })

        if (auditError) {
          console.error('Error logging password change:', auditError)
        }

        // If successful, mark any pending reset tokens as used
        if (success) {
          const { error: updateError } = await supabase
            .from('password_reset_tokens')
            .update({
              status: 'used',
              used_at: new Date().toISOString(),
              success: true,
            })
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())

          if (updateError) {
            console.error('Error marking tokens as used:', updateError)
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Password change logged' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'password_update': {
        // User updated password from Settings page (authenticated user)
        const success = body.success as boolean | undefined

        // Log to password change audit
        const { error: auditError } = await supabase
          .from('password_change_audit')
          .insert({
            user_id: user.id,
            email: user.email,
            change_type: 'password_update',
            status: success ? 'success' : 'failed',
            ip_address: ipAddress,
            user_agent: userAgent,
            error_message: success ? null : (body.error as string | undefined) || null,
            notes: 'Password updated from Settings page',
          })

        if (auditError) {
          console.error('Error logging password update:', auditError)
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Password update logged' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'revoke_all_tokens': {
        // User clicked "revoke all reset links"
        const { data: result, error: revokeError } = await supabase
          .rpc('revoke_all_reset_tokens', { user_id_param: user.id })

        if (revokeError) {
          console.error('Error revoking tokens:', revokeError)
          return new Response(
            JSON.stringify({ error: 'Failed to revoke tokens' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Log the revocation
        const { error: auditError } = await supabase
          .from('password_change_audit')
          .insert({
            user_id: user.id,
            email: user.email,
            change_type: 'password_reset',
            status: 'success',
            ip_address: ipAddress,
            user_agent: userAgent,
            notes: `Revoked ${result as number} pending reset tokens`,
          })

        if (auditError) {
          console.error('Error logging revocation:', auditError)
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Revoked all pending reset links (${result} tokens)`,
            revoked_count: result,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error in log-password-reset:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
