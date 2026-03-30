-- IDOR Fix: Password Reset Tokens INSERT Policy
-- Removes overly permissive policy that allows authenticated users to insert tokens
-- Restricts to service_role only (edge functions)

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service can insert password reset tokens" ON password_reset_tokens;

-- Create a new restrictive policy: only service_role can insert
-- This prevents authenticated users from forging password reset audit logs
CREATE POLICY "Service role only can insert password reset tokens"
  ON password_reset_tokens FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Update the existing UPDATE policy to be more restrictive
-- Only service_role or the user themselves (for revocation) can update
DROP POLICY IF EXISTS "Service can update password reset tokens" ON password_reset_tokens;

CREATE POLICY "Service and user can update password reset tokens"
  ON password_reset_tokens FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    (auth.uid() = user_id AND status = 'pending')
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.uid() = user_id AND status IN ('pending', 'revoked'))
  );
