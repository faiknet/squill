# 🔒 IDOR (Insecure Direct Object Reference) Vulnerability Audit - FINDINGS

**Date:** March 30, 2026  
**Project:** Scribe's Quill  
**Audit Type:** Comprehensive IDOR Security Review  
**Status:** ⚠️ VULNERABILITIES FOUND

---

## Executive Summary

Comprehensive audit found **7 IDOR-related vulnerabilities** (3 Critical + 4 High) that could allow unauthorized access to other users' data or campaign manipulation.

### Vulnerability Breakdown
- 🔴 **CRITICAL (3):** Require immediate fixes before production
- 🟠 **HIGH (4):** Should be fixed soon; medium security risk

---

## Critical Vulnerabilities (Must Fix)

### 1. 🔴 CRITICAL: Campaign GM Transfer - No Acceptance Required
**Severity:** CRITICAL  
**File:** `src/pages/CampaignDetail.jsx` (lines 400-421)

**Issue:**
The `handleTransferGMStatus` function transfers campaign ownership immediately without:
- Recipient acceptance/notification
- Rate limiting on rapid transfers
- Audit trail enforcement

**Attack Scenario:**
- Attacker compromises GM account
- Immediately transfers campaign to attacker's account
- Original owner loses all control with no recovery option

**Fix Required:** ✅ Needs Implementation
- Create `campaign_transfers` table with pending/accepted/declined status
- Make transfer acceptance mandatory (recipient must approve)
- Add rate limiting on transfers
- Create audit log

---

### 2. 🔴 CRITICAL: Snapshot-Note Edge Function - Missing Campaign Membership Check
**Severity:** CRITICAL  
**File:** `supabase/edge-functions/snapshot-note/index.ts` (lines 80-91)

**Issue:**
The edge function saves session notes using `SERVICE_ROLE_KEY` (bypasses RLS) without verifying:
- User is authenticated
- User is a member of the campaign
- User has permission to edit this session

**Attack Scenario:**
- User A in Campaign X obtains Session Y's ID from Campaign Y
- User A calls snapshot-note endpoint with Session Y's ID
- User A's Liveblocks updates get saved to Campaign Y's session
- Campaign Y's data is corrupted/exposed

**Fix Required:** ✅ Immediate Implementation
```typescript
// Add membership verification before saving
const membershipCheck = await supabaseClient
  .from('campaign_members')
  .select('id')
  .eq('campaign_id', session.campaign_id)
  .eq('user_id', userId)
  .single()

if (!membershipCheck.data) {
  return new Response(
    JSON.stringify({ error: 'Not a campaign member' }),
    { status: 403 }
  )
}
```

---

### 3. 🔴 CRITICAL: User Preferences - Overly Permissive READ Policy
**Severity:** CRITICAL  
**File:** `supabase/migrations/20260323_user_preferences_table.sql` (lines 27-30)

**Issue:**
RLS Policy allows ANY authenticated user to read ALL users' preferences:
```sql
CREATE POLICY "Anyone can read all preferences"
  ON user_preferences FOR SELECT
  USING (true);
```

**Attack Scenario:**
- Attacker creates account
- Fetches ALL user preferences including editor colors
- Maps all user_ids in system
- Uses user_ids for further IDOR attacks

**Fix Required:** ✅ Immediate Implementation
- Restrict to campaign members only
- Change policy to check if user shares campaign membership

---

## High Severity Vulnerabilities (Should Fix Soon)

### 4. 🟠 HIGH: Password Reset Tokens - Overly Permissive INSERT Policy
**Severity:** HIGH  
**File:** `supabase/migrations/20260330_password_reset_tracking.sql` (lines 51-58)

**Issue:**
Allows authenticated users to insert password reset tokens for themselves:
```sql
CREATE POLICY "Service can insert password reset tokens"
  ON password_reset_tokens FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' OR auth.role() = 'service_role'
  );
```

**Risk:** Users could forge password reset audit logs

**Fix:** Restrict to `service_role` only

---

### 5. 🟠 HIGH: Campaign Members Deletion - No Audit Trail
**Severity:** HIGH  
**File:** `supabase/migrations/20260327_final_rls_fix.sql` (lines 133-135)

**Issue:**
Users can delete their membership without audit logging. Campaign GM won't know who left or when.

**Risk:** Cannot track membership changes for GDPR compliance

**Fix:** Add `campaign_activity_audit` table with trigger logging all membership changes

---

### 6. 🟠 HIGH: Campaign Members SELECT Policy - Can Enumerate All Members
**Severity:** HIGH  
**File:** `supabase/migrations/0006_campaign_members_rpc.sql` (lines 3-46)

**Issue:**
The `get_campaign_members()` RPC allows any campaign member to see all other members' user_ids.

**Risk:** User enumeration; IDs can be used for other IDOR attacks

**Fix:** Check if user has permission to see member list (GM-only vs all members)

---

### 7. 🟠 HIGH: Session Activity Logs - User Enumeration Vector
**Severity:** HIGH  
**File:** `supabase/migrations/20260321_session_activity_logs.sql` (lines 15-24)

**Issue:**
Activity logs expose which user_ids are active in which sessions. Can be used to enumerate users.

**Risk:** Behavioral analysis; leaks activity patterns

**Fix:** Add rate limiting on activity log reads; consider privacy mode for activity display

---

## Fix Priority Matrix

| Priority | Vulnerability | Impact | Effort | Deadline |
|----------|---|---|---|---|
| 🔴 P1 | Snapshot-Note: Missing membership check | CRITICAL - Data corruption | 1-2 hours | NOW |
| 🔴 P1 | User Preferences: Open READ policy | CRITICAL - User enumeration | 30 mins | NOW |
| 🔴 P2 | Campaign Transfer: No acceptance | CRITICAL - Account takeover | 3-4 hours | Today |
| 🟠 P3 | Password Reset: Overly permissive INSERT | HIGH - Audit forge | 30 mins | Today |
| 🟠 P4 | Campaign Members: Missing audit trail | HIGH - GDPR issue | 2 hours | This week |
| 🟠 P5 | Campaign Members: User enumeration | HIGH - Info leak | 1 hour | This week |
| 🟠 P6 | Activity Logs: User enumeration | HIGH - Behavioral leak | 1-2 hours | This week |

---

## Implementation Roadmap

### Phase 1: CRITICAL Fixes (2-3 hours) - DO FIRST
1. ✅ Fix snapshot-note membership check (30 mins)
2. ✅ Fix user preferences READ policy (20 mins)
3. ✅ Fix password reset tokens INSERT policy (15 mins)

### Phase 2: High Priority Fixes (5-6 hours) - DO SECOND
4. ✅ Implement campaign transfer acceptance system (3-4 hours)
5. ✅ Add campaign member audit trail (2 hours)

### Phase 3: Improve Policies (2-3 hours) - DO THIRD
6. ✅ Add campaign member visibility controls (1 hour)
7. ✅ Add activity log privacy/rate limiting (1-2 hours)

---

## Total Estimated Effort

- **Phase 1 (Critical):** 2-3 hours
- **Phase 2 (High):** 5-6 hours
- **Phase 3 (Medium):** 2-3 hours
- **Testing & Verification:** 2-3 hours
- **TOTAL:** 12-15 hours

---

## Files Requiring Changes

### Migrations (SQL)
- [ ] `supabase/migrations/20260323_user_preferences_table.sql` - Fix READ policy
- [ ] `supabase/migrations/20260330_password_reset_tracking.sql` - Fix INSERT policy
- [ ] `supabase/migrations/20260327_final_rls_fix.sql` - Add membership audit
- [ ] NEW: `supabase/migrations/20260330_idor_fixes.sql` - Campaign transfers + audit

### Edge Functions (TypeScript)
- [ ] `supabase/edge-functions/snapshot-note/index.ts` - Add membership check
- [ ] `supabase/edge-functions/join-campaign/index.ts` - Add rate limiting check

### Components (React)
- [ ] `src/pages/CampaignDetail.jsx` - Update transfer UX for acceptance flow
- [ ] `src/pages/Settings.jsx` - Show pending transfer requests

---

## Full Detailed Report

For complete vulnerability details including code samples and detailed fixes, see:  
📄 **`IDOR_VULNERABILITY_AUDIT.md`**

---

## Compliance Notes

### OWASP Top 10
- **A01:2021 - Broken Access Control** ← These vulnerabilities fall here
- Affects 6 of 7 vulnerabilities in this audit

### OWASP API Security
- **API5: Broken Function Level Access Control** ← Snapshot-note issue
- **API3: Broken Object Level Authorization** ← User preferences issue

### GDPR/Privacy
- Membership deletion without audit trail could violate audit logging requirements
- User enumeration violates privacy by design principles

---

## Next Steps

1. **Review & Approve** these findings
2. **Implement Phase 1** (critical fixes) immediately
3. **Test thoroughly** before deploying
4. **Deploy to production** with monitoring
5. **Implement Phase 2** fixes this week
6. **Monitor for abuse** patterns in logs

---

**Report Generated:** March 30, 2026  
**Auditor:** Copilot Security Audit Agent  
**Status:** ⚠️ ACTION REQUIRED
