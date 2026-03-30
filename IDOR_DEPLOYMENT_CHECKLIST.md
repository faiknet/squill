# 🔒 IDOR Critical Fixes - Deployment Checklist

**Status:** Ready for Deployment  
**Date:** March 30, 2026  
**Priority:** CRITICAL (Security-blocking)

---

## Pre-Deployment Checklist

- [x] All 3 IDOR fixes implemented in code
- [x] User Preferences RLS migration created
- [x] Password Reset Tokens RLS migration created
- [x] Snapshot-Note edge function updated with membership check
- [x] Combined deployment script created (`IDOR_FIXES_DEPLOYMENT.sql`)
- [x] Verification tests documented
- [x] Rollback procedures documented
- [ ] **Awaiting deployment authorization**

---

## Deployment Steps

### Step 1: Backup Database (SAFETY FIRST)
**Before deploying any SQL changes:**

1. Go to: https://app.supabase.com/project/vbkuxhmokwxpxkbyoawt/sql/backups
2. Create a manual backup labeled: "Pre-IDOR-Fixes-[DATE]"
3. Wait for backup to complete
4. Confirm backup successful before proceeding

---

### Step 2: Deploy User Preferences Policy Fix

**Location:** Supabase Dashboard SQL Editor  
**URL:** https://app.supabase.com/project/vbkuxhmokwxpxkbyoawt/sql/new

**SQL to Execute:**
```sql
-- IDOR Fix: User Preferences READ Policy
-- Removes overly permissive "Anyone can read all preferences" policy
-- Replaces with scoped policy: only read preferences for campaign members

-- Drop the overly permissive policy that allows reading ALL user preferences
DROP POLICY IF EXISTS "Anyone can read all preferences" ON user_preferences;

-- Create a new restrictive policy: users can only read preferences of:
-- 1. Their own preferences
-- 2. Other users in the same campaigns they're in
CREATE POLICY "Users can read preferences of campaign members"
  ON user_preferences FOR SELECT
  USING (
    -- Can always read own preferences
    auth.uid() = user_id
    OR
    -- Can read preferences of users in same campaigns
    EXISTS (
      SELECT 1 FROM campaign_members cm_self
      INNER JOIN campaign_members cm_other 
        ON cm_self.campaign_id = cm_other.campaign_id
      WHERE cm_self.user_id = auth.uid() 
        AND cm_other.user_id = user_preferences.user_id
    )
  );

-- Update the get_user_colors RPC to respect the new scoped policy
-- Now it will enforce campaign membership even when called directly
CREATE OR REPLACE FUNCTION get_user_colors(user_ids UUID[])
RETURNS TABLE (user_id UUID, editor_color TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id, up.editor_color
  FROM user_preferences up
  WHERE up.user_id = ANY(user_ids)
    AND (
      -- Can always read own color
      up.user_id = auth.uid()
      OR
      -- Can read colors of campaign members
      EXISTS (
        SELECT 1 FROM campaign_members cm_self
        INNER JOIN campaign_members cm_other 
          ON cm_self.campaign_id = cm_other.campaign_id
        WHERE cm_self.user_id = auth.uid() 
          AND cm_other.user_id = up.user_id
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**After Execution:**
- [ ] Query succeeds without errors
- [ ] No "ERROR" messages in output
- [ ] Policy appears in `pg_policies` table

---

### Step 3: Deploy Password Reset Tokens Policy Fix

**Location:** Supabase Dashboard SQL Editor  
**URL:** https://app.supabase.com/project/vbkuxhmokwxpxkbyoawt/sql/new

**SQL to Execute:**
```sql
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
```

**After Execution:**
- [ ] Query succeeds without errors
- [ ] No "ERROR" messages in output
- [ ] Policy appears in `pg_policies` table

---

### Step 4: Deploy Snapshot-Note Edge Function

**Option A: Via Supabase CLI (If available)**
```bash
cd /path/to/project
supabase functions deploy snapshot-note
```

**Option B: Via Supabase Dashboard**
1. Navigate to: https://app.supabase.com/project/vbkuxhmokwxpxkbyoawt/functions/snapshot-note
2. Check if the code contains the membership verification check
3. Confirm the fix is in place

**After Deployment:**
- [ ] Function deployed successfully
- [ ] No error messages in deployment log
- [ ] Function contains campaign membership check

---

## Post-Deployment Verification

### Verification Test 1: User Preferences Scoping
**Goal:** Verify users cannot read preferences of users outside their campaigns

```sql
-- Run as authenticated user (not service_role)
-- This should FAIL or return empty if you're not in the same campaign
SELECT * FROM user_preferences 
WHERE user_id = 'ANY_RANDOM_UUID_NOT_IN_YOUR_CAMPAIGN';

-- Expected: No rows returned (or permission denied)
```

### Verification Test 2: Password Reset Tokens
**Goal:** Verify authenticated users cannot insert password reset tokens

```sql
-- This should FAIL with "new row violates row-level security policy"
INSERT INTO password_reset_tokens (user_id, email, status) 
VALUES (auth.uid(), 'test@example.com', 'pending');

-- Expected error:
-- ERROR: new row violates row-level security policy 
-- "Service role only can insert password reset tokens"
```

### Verification Test 3: Snapshot-Note Membership Check
**Goal:** Verify users cannot save notes to campaigns they're not in

1. Log into the app as User A
2. Get a valid session ID from Campaign B (that User A is NOT in)
3. Try to save a note to that session via the editor
4. **Expected Result:** Error message or 403 Forbidden response

---

## Rollback Procedures (If Needed)

### If Fix 1 (User Preferences) Breaks Something
```sql
-- Restore the old (permissive) policy
DROP POLICY IF EXISTS "Users can read preferences of campaign members" ON user_preferences;

CREATE POLICY "Anyone can read all preferences"
  ON user_preferences FOR SELECT
  USING (true);
```

### If Fix 2 (Password Reset) Breaks Something
```sql
-- Restore the old (permissive) policies
DROP POLICY IF EXISTS "Service role only can insert password reset tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Service and user can update password reset tokens" ON password_reset_tokens;

CREATE POLICY "Service can insert password reset tokens"
  ON password_reset_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update password reset tokens"
  ON password_reset_tokens FOR UPDATE
  USING (true);
```

### If Snapshot-Note Function Breaks
- Revert to previous version in Supabase Dashboard Functions panel
- Or redeploy from git without the membership check changes

---

## Security Impact Summary

### Before Fixes
| Vulnerability | Impact | Status |
|---|---|---|
| Users could save notes to any campaign | 🔴 CRITICAL | UNPATCHED |
| Users could enumerate all system users | 🔴 CRITICAL | UNPATCHED |
| Users could forge password reset logs | 🔴 CRITICAL | UNPATCHED |

### After Fixes
| Vulnerability | Impact | Status |
|---|---|---|
| Users could save notes to any campaign | ✅ FIXED | Users must be campaign members |
| Users could enumerate all system users | ✅ FIXED | Can only see campaign members |
| Users could forge password reset logs | ✅ FIXED | Only service_role can insert |

---

## Deployment Confirmation

**Deployed By:** [Your Name]  
**Date/Time:** [Current Date/Time]  
**Database Backup ID:** [Backup ID from Step 1]  
**Status:** [ ] COMPLETE [ ] FAILED [ ] ROLLED BACK

**Issues Encountered:** None / [Details if any]

**Verification Result:** [ ] ALL TESTS PASSED [ ] SOME FAILED [ ] NOT YET VERIFIED

---

## Post-Deployment Monitoring (Next 24 Hours)

- [ ] Monitor application logs for errors
- [ ] Check user reports in support channel
- [ ] Verify no spike in failed authentication attempts
- [ ] Confirm note-saving functionality works normally
- [ ] Verify preferences are loaded correctly in editor

**Issues Discovered:** [List any problems here]

**Resolution:** [How issues were fixed]

---

## Sign-Off

- [ ] Security Team: Verified fixes are correct
- [ ] DevOps Team: Deployment completed successfully  
- [ ] Product Team: No user-facing issues reported
- [ ] All fixes deployed and verified

---

## Related Documentation

- `IDOR_COMPREHENSIVE_SECURITY_AUDIT.md` — Full vulnerability analysis
- `IDOR_CRITICAL_FIXES_DEPLOYED.md` — Implementation details
- `IDOR_FIXES_DEPLOYMENT.sql` — Combined SQL script
