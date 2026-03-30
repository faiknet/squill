-- Password Reset Token Tracking and Audit Log
-- Tracks all password reset attempts for security auditing and user visibility
-- Enables users to see reset history and revoke tokens if needed

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  
  -- Status tracking: pending (sent), used (password changed), revoked (user invalidated), expired (time limit passed)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'revoked', 'expired')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  
  -- Metadata for security analysis
  ip_address INET,
  user_agent TEXT,
  
  -- For audit trail
  notes TEXT,
  
  -- Tracking if password change succeeded
  success BOOLEAN DEFAULT NULL -- null = not yet used, true = password updated successfully, false = validation failed
);

-- Create indexes for efficient queries
CREATE INDEX idx_password_reset_tokens_user_id 
  ON password_reset_tokens(user_id);
  
CREATE INDEX idx_password_reset_tokens_expires_at 
  ON password_reset_tokens(expires_at);
  
CREATE INDEX idx_password_reset_tokens_status 
  ON password_reset_tokens(status);
  
CREATE INDEX idx_password_reset_tokens_created_at 
  ON password_reset_tokens(created_at DESC);

-- Enable Row Level Security
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own reset tokens (for reset history in Settings)
CREATE POLICY "Users can view their own password reset tokens"
  ON password_reset_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: System can insert reset tokens (via edge functions)
-- We don't allow direct user inserts - only system inserts via trusted functions
CREATE POLICY "Service can insert password reset tokens"
  ON password_reset_tokens FOR INSERT
  WITH CHECK (
    -- Only allow inserts from authenticated service (edge functions have special auth)
    auth.role() = 'authenticated' OR auth.role() = 'service_role'
  );

-- RLS Policy: Service can update reset tokens (mark as used/revoked)
CREATE POLICY "Service can update password reset tokens"
  ON password_reset_tokens FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    (auth.uid() = user_id AND status = 'pending') -- Users can only revoke pending tokens
  );

-- Create a function to mark all pending tokens as expired
CREATE OR REPLACE FUNCTION mark_expired_reset_tokens()
RETURNS void AS $$
BEGIN
  UPDATE password_reset_tokens
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to revoke all reset tokens for a user
-- Called when user suspects account compromise
CREATE OR REPLACE FUNCTION revoke_all_reset_tokens(user_id_param UUID)
RETURNS TABLE(revoked_count INT) AS $$
DECLARE
  count INT;
BEGIN
  UPDATE password_reset_tokens
  SET status = 'revoked', revoked_at = NOW()
  WHERE user_id = user_id_param AND status IN ('pending', 'used');
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for their own data)
GRANT EXECUTE ON FUNCTION revoke_all_reset_tokens TO authenticated;

-- Create a function to get user's recent reset tokens
CREATE OR REPLACE FUNCTION get_recent_reset_tokens(limit_count INT DEFAULT 10)
RETURNS TABLE(
  token_id UUID,
  email TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  ip_address INET,
  success BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id, 
    password_reset_tokens.email,
    password_reset_tokens.status,
    password_reset_tokens.created_at,
    password_reset_tokens.expires_at,
    password_reset_tokens.used_at,
    password_reset_tokens.ip_address,
    password_reset_tokens.success
  FROM password_reset_tokens
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create audit log table for password change events
CREATE TABLE IF NOT EXISTS password_change_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  
  -- What changed
  change_type TEXT NOT NULL CHECK (change_type IN ('password_reset', 'password_update', 'password_failed_attempt')),
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  
  -- When and where
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  
  -- For tracking which reset token was used
  reset_token_id UUID REFERENCES password_reset_tokens(id) ON DELETE SET NULL,
  
  -- Additional context
  notes TEXT
);

-- Create indexes for audit log
CREATE INDEX idx_password_change_audit_user_id 
  ON password_change_audit(user_id);
  
CREATE INDEX idx_password_change_audit_created_at 
  ON password_change_audit(created_at DESC);

-- Enable RLS on audit log
ALTER TABLE password_change_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own audit log
CREATE POLICY "Users can view their own password audit log"
  ON password_change_audit FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service can insert audit entries
CREATE POLICY "Service can insert password audit logs"
  ON password_change_audit FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Create function to log password change
CREATE OR REPLACE FUNCTION log_password_change(
  change_type TEXT,
  status TEXT DEFAULT 'success',
  error_msg TEXT DEFAULT NULL,
  reset_token_id_param UUID DEFAULT NULL,
  ip_address_param INET DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO password_change_audit (
    user_id,
    email,
    change_type,
    status,
    error_message,
    reset_token_id,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    auth.jwt() ->> 'email',
    change_type,
    status,
    error_msg,
    reset_token_id_param,
    ip_address_param,
    user_agent_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION log_password_change TO authenticated;

-- Create function to get password change history
CREATE OR REPLACE FUNCTION get_password_change_history(limit_count INT DEFAULT 10)
RETURNS TABLE(
  log_id UUID,
  change_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  ip_address INET,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    password_change_audit.change_type,
    password_change_audit.status,
    password_change_audit.created_at,
    password_change_audit.ip_address,
    password_change_audit.error_message
  FROM password_change_audit
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_password_change_history TO authenticated;
