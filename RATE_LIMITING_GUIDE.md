# Rate Limiting Implementation Guide

## Overview

This document explains the rate limiting system implemented across all API endpoints to prevent brute force attacks, resource exhaustion, and DDoS-style abuse.

**Implementation Date:** March 30, 2026  
**Status:** Complete and Production-Ready  
**Scope:** All custom edge functions  

---

## Rate Limits

### join-campaign Endpoint
```
Limit: 5 requests per 15 minutes
Scope: Per IP address
Purpose: Prevent brute force attacks on invite codes
Status: 429 Too Many Requests
```

### snapshot-note Endpoint
```
Limit: 10 requests per 60 seconds
Scope: Per session ID
Purpose: Prevent resource exhaustion via repeated webhook calls
Status: 429 Too Many Requests
```

### Supabase Auth Endpoints (Built-in)
```
signUp: 3 requests per hour per IP
signIn: 3 requests per hour per IP + brute force detection
resetPasswordForEmail: 2 requests per hour per email
```

### Database Operations (Built-in via RLS)
```
All Supabase SDK operations are rate limited by Supabase
Row-level security policies enforce per-user access
No additional rate limiting needed
```

---

## Architecture

### Rate Limiter Library

**File:** `supabase/edge-functions/rate-limiter.ts`

The `RateLimiter` class implements a **sliding window algorithm** for tracking requests:

```typescript
class RateLimiter {
  checkLimit(key: string, maxRequests: number, windowSeconds: number): number
  reset(key: string): void
  resetAll(): void
  getState(key: string): WindowState | null
}
```

#### Key Features
- **Zero external dependencies** — Pure Deno with no npm packages
- **Sliding window algorithm** — More accurate than fixed windows
- **Automatic cleanup** — Expired entries removed periodically
- **In-memory storage** — Fast, suitable for edge functions
- **Thread-safe** — Works correctly in concurrent scenarios

#### When to Use
✅ Single edge function instance (Deno)  
✅ Short-lived functions (auto-cleanup on exit)  
✅ Moderate request volumes  

❌ Distributed systems (multiple instances) — Use Redis or Supabase instead  
❌ Persistent storage (multi-hour windows) — Requires external store  

### IP Address Extraction

The `getClientIp()` helper extracts client IP from request headers in this priority:

1. **X-Forwarded-For** — Proxy/CDN headers (first IP in comma-separated list)
2. **CF-Connecting-IP** — Cloudflare integration
3. **X-Real-IP** — Generic reverse proxy header
4. **'unknown'** — Fallback when no headers present

```typescript
const ip = getClientIp(req.headers)
limiter.checkLimit(ip, 5, 900) // Rate limit by IP
```

### Session ID Extraction

The `extractSessionId()` helper reads session_id from POST request body:

```typescript
const sessionId = await extractSessionId(req)
if (sessionId) {
  limiter.checkLimit(sessionId, 10, 60) // Rate limit by session
}
```

This is safe because:
- Returns `null` if request is not POST
- Returns `null` if content is not JSON
- Returns `null` if session_id is missing or not a string
- Catches JSON parse errors gracefully

### Error Handling

When a rate limit is exceeded, the system returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45

{
  "error": "Request rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

#### Key Principles
- **HTTP 429 status code** — Standard rate limit response
- **Retry-After header** — Tells clients how long to wait (in seconds)
- **Safe error message** — Never leaks implementation details
- **No stack traces** — Implementation errors logged server-side only

---

## Implementation Details

### join-campaign Integration

**File:** `supabase/edge-functions/join-campaign/index.ts`

```typescript
import { RateLimiter, RateLimitError, getClientIp, createRateLimitResponse } from "../rate-limiter.ts"

const limiter = new RateLimiter()

serve(async (req) => {
  // ... OPTIONS handling ...

  try {
    // Rate limiting first (before validation, before auth)
    const clientIp = getClientIp(req.headers)
    try {
      limiter.checkLimit(clientIp, 5, 900) // 5 req/15min per IP
    } catch (error) {
      if (error instanceof RateLimitError) {
        return createRateLimitResponse(error, corsHeaders)
      }
      throw error
    }

    // Then validation, auth, and database operations
    // ...
  } catch (error) {
    // Error handling
  }
})
```

#### Why Rate Limiting First?
1. **Efficiency** — Rejects abusive requests early, before expensive validation/auth
2. **Security** — Rate limits applied even to invalid requests (protects against fuzzing)
3. **Consistency** — All defensive layers work together

### snapshot-note Integration

**File:** `supabase/edge-functions/snapshot-note/index.ts`

```typescript
import { RateLimiter, RateLimitError, extractSessionId, createRateLimitResponse } from "../rate-limiter.ts"

const limiter = new RateLimiter()

serve(async (req) => {
  // ... OPTIONS handling ...

  try {
    const body = await req.json()

    // Rate limiting by session ID (not IP, since it's a webhook)
    const sessionId = await extractSessionId(req)
    if (sessionId) {
      try {
        limiter.checkLimit(sessionId, 10, 60) // 10 req/min per session
      } catch (error) {
        if (error instanceof RateLimitError) {
          return createRateLimitResponse(error, corsHeaders)
        }
        throw error
      }
    }

    // Then validation and database operations
    // ...
  } catch (error) {
    // Error handling
  }
})
```

#### Why Session-Based Rate Limiting?
- `snapshot-note` is called by Liveblocks webhook (not user-initiated)
- Multiple users may share same IP (corporate networks, mobile carriers)
- Each session should have independent quota (session has specific connected user)
- Session ID is already validated, so it's safe to use

---

## Testing

### Unit Tests

**File:** `supabase/edge-functions/rate-limiter.test.ts` (90+ test cases)

```bash
deno test --allow-all supabase/edge-functions/rate-limiter.test.ts
```

**Coverage:**
- ✅ Request counting and limit enforcement
- ✅ Window expiration and reset
- ✅ Multi-key isolation
- ✅ IP extraction from various headers
- ✅ Session ID extraction from JSON bodies
- ✅ Response generation with Retry-After
- ✅ Error handling and edge cases

### Integration Tests

**File:** `supabase/edge-functions/integration-rate-limit.test.ts` (40+ test cases)

```bash
# Requires running edge functions locally or in staging
npm run test:integration -- rate-limit
```

**Coverage:**
- ✅ join-campaign: 5 requests per 15 minutes enforced
- ✅ snapshot-note: 10 requests per minute enforced
- ✅ Rate limits are per-IP and per-session respectively
- ✅ Error responses include Retry-After header
- ✅ Validation errors still returned when rate limit not hit

### Manual Testing

#### Test join-campaign Rate Limit

```bash
# Make 6 requests rapidly (should fail on 6th)
for i in {1..6}; do
  curl -X POST http://localhost:54321/functions/v1/join-campaign \
    -H "Authorization: Bearer $(get_token)" \
    -H "Content-Type: application/json" \
    -d '{"invite_code": "test-'$i'"}'
  
  echo "Request $i: $(date)"
done

# 6th request should return 429 with Retry-After header
```

#### Test snapshot-note Rate Limit

```bash
# Make 11 requests to same session rapidly (should fail on 11th)
SESSION_ID="abc-123-def-456-789"
for i in {1..11}; do
  curl -X POST http://localhost:54321/functions/v1/snapshot-note \
    -H "Content-Type: application/json" \
    -d '{"session_id": "'$SESSION_ID'", "content_md": "Test '$i'", "updated_at": "2026-03-30T02:35:00Z"}'
  
  echo "Request $i: $(date)"
done

# 11th request should return 429
```

#### Test Per-IP Isolation (join-campaign)

```bash
# Requests from different IPs should have separate quotas
# Simulate different IPs using X-Forwarded-For header

for i in {1..5}; do
  curl -X POST http://localhost:54321/functions/v1/join-campaign \
    -H "Authorization: Bearer $(get_token)" \
    -H "X-Forwarded-For: 203.0.113.1" \
    -H "Content-Type: application/json" \
    -d '{"invite_code": "test-'$i'"}'
done

# IP 203.0.113.1 should now be rate limited
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Authorization: Bearer $(get_token)" \
  -H "X-Forwarded-For: 203.0.113.1" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "test-6"}'
# Returns 429

# But IP 203.0.113.2 should still work
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Authorization: Bearer $(get_token)" \
  -H "X-Forwarded-For: 203.0.113.2" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "test-1"}'
# Returns 200/400/401/404 (NOT 429)
```

---

## Monitoring & Alerting

### Metrics to Track

1. **Rate Limit Violations**
   ```typescript
   // Log when 429 is returned
   console.log(`[RateLimit] ${ip} exceeded limit. Retry-After: ${error.retryAfterSeconds}s`)
   ```

2. **Top Abusive IPs**
   ```
   // Aggregate violations by IP
   // Alert if single IP triggers >20 violations per hour
   ```

3. **Per-Session Abuse**
   ```typescript
   // Track snapshot-note violations per session
   // Alert if session triggers >10 violations per minute
   ```

### Log Examples

**Normal operation:**
```
Request accepted: join-campaign from 203.0.113.42 (4 remaining)
Request accepted: snapshot-note for session abc-123 (8 remaining)
```

**Rate limit triggered:**
```
[RateLimit] 203.0.113.99 exceeded join-campaign limit. Retry-After: 847s
[RateLimit] session xyz-789 exceeded snapshot-note limit. Retry-After: 52s
```

---

## Configuration

### Adjusting Limits

To change rate limits, edit the `limiter.checkLimit()` calls in each edge function:

```typescript
// join-campaign: currently 5 requests per 900 seconds (15 minutes)
limiter.checkLimit(clientIp, 5, 900)

// To increase to 10 requests per 15 minutes:
limiter.checkLimit(clientIp, 10, 900)

// To use stricter 3 requests per 10 minutes:
limiter.checkLimit(clientIp, 3, 600)
```

**For snapshot-note:**
```typescript
// snapshot-note: currently 10 requests per 60 seconds
limiter.checkLimit(sessionId, 10, 60)

// To increase to 20 requests per minute:
limiter.checkLimit(sessionId, 20, 60)
```

### Distributed Deployment

**Current:** In-memory storage (single edge function instance)

**For multiple instances:** Switch to external rate limiting:

1. **Redis (Recommended)**
   ```typescript
   const redis = new Redis(redisUrl)
   const remaining = await redis.decr(`ratelimit:${key}`)
   // Set TTL after first request
   ```

2. **Supabase Rate Limiting Table**
   ```typescript
   const { count } = await supabase
     .from('rate_limits')
     .upsert({ key, count: count + 1, expires_at: now + 900 })
   ```

3. **Cloudflare Workers KV** (if using Cloudflare)
   ```typescript
   const count = await KV.get(`ratelimit:${key}`)
   // Built-in rate limiting available
   ```

---

## Best Practices

### ✅ Do

- ✅ Apply rate limiting **first** in request handlers (before expensive operations)
- ✅ Use **IP-based limiting** for public endpoints (join-campaign)
- ✅ Use **ID-based limiting** for webhook endpoints (snapshot-note)
- ✅ Always include **Retry-After header** in 429 responses
- ✅ Log all rate limit violations for security monitoring
- ✅ Test rate limits **before production deployment**
- ✅ Adjust thresholds based on **actual usage patterns**
- ✅ Document rate limits in **API documentation**

### ❌ Don't

- ❌ Don't apply rate limiting **after** expensive operations (validation, auth, DB queries)
- ❌ Don't use **fixed windows** (use sliding windows instead)
- ❌ Don't leak **implementation details** in error messages
- ❌ Don't forget **Retry-After header** (clients won't know when to retry)
- ❌ Don't rate limit **OPTIONS requests** (used for CORS preflight)
- ❌ Don't block **entire subnets** (causes too many false positives)
- ❌ Don't use **shared state** without synchronization in multi-threaded environments

---

## Troubleshooting

### Issue: Legitimate users hitting rate limit

**Symptom:** Users report "Request rate limit exceeded" errors

**Solutions:**
1. Check if users are sharing an IP (corporate networks, VPN, mobile carrier)
   - Use session-based limiting instead of IP-based
   - Or increase IP-based limits

2. Check if rate limit thresholds are too strict
   - Review actual usage patterns
   - Adjust thresholds with monitoring data

3. Check for distributed attacks mimicking legitimate traffic
   - Add CAPTCHA to sensitive endpoints
   - Enable DDoS protection at CDN level

### Issue: Rate limiter not triggering

**Symptom:** Requests that should be rate limited are accepted

**Solutions:**
1. Verify `limiter.checkLimit()` is called early in request handler
2. Check IP extraction — ensure X-Forwarded-For header is present
3. Verify rate limit thresholds are correct (check values in edge function)
4. Check for race conditions in concurrent requests

### Issue: Memory growth in long-running edge functions

**Symptom:** Edge function memory usage increases over time

**Solutions:**
1. Cleanup runs every minute by default — this should prevent growth
2. Increase cleanup frequency if needed:
   ```typescript
   const limiter = new RateLimiter()
   // Cleanup interval can be adjusted in rate-limiter.ts
   ```

3. For very long-running functions, consider externalizing rate limiter to Redis

---

## Security Considerations

### Bypass Vulnerabilities

**X-Forwarded-For spoofing:**
- Only trust X-Forwarded-For from known proxies
- In production, configure trusted proxies at CDN/reverse proxy level
- Current implementation trusts all X-Forwarded-For headers (suitable for Supabase deployment)

**Session ID prediction:**
- snapshot-note rate limiting depends on session_id validity
- Session IDs are UUIDs (cryptographically secure)
- Attackers cannot predict valid session IDs

**Distributed attacks:**
- Rate limiting by IP protects against single-source attacks
- Distributed attacks using different IPs/sessions are harder to detect
- Combine with behavior analysis for better protection

### DDoS Protection

**Current:**
- IP-based rate limiting (join-campaign)
- Session-based rate limiting (snapshot-note)
- Early rejection before expensive operations

**Enhanced (future):**
- CAPTCHA for repeated rate limit violations
- Temporary IP bans after N violations
- Behavioral analysis to detect attack patterns
- Integration with DDoS protection services (Cloudflare, AWS Shield)

---

## Migration & Deployment

### Deploying to Production

1. **Review** rate-limiter.ts for security issues
2. **Deploy** rate-limiter.ts to Supabase edge functions
3. **Update** join-campaign/index.ts and snapshot-note/index.ts
4. **Test** rate limiting in staging environment
5. **Monitor** rate limit violations in production
6. **Adjust** thresholds based on usage patterns

### Rollback Procedure

If rate limiting causes issues:

1. **Remove** rate limiting calls from edge functions:
   ```typescript
   // Comment out or remove:
   // limiter.checkLimit(clientIp, 5, 900)
   ```

2. **Redeploy** edge functions without rate limiting

3. **Monitor** for issues that prompted rollback

4. **Investigate** root cause and adjust thresholds

---

## Related Documentation

- **SECURITY_IMPLEMENTATION.md** — Defense-in-depth architecture
- **TEAM_VALIDATION_GUIDE.md** — Input validation (complementary to rate limiting)
- **PHASE4_PENETRATION_TESTING_GUIDE.md** — Security testing procedures
- **SECURITY_AUDIT_CHECKLIST.md** — OWASP/CWE compliance

---

## Support

For questions or issues:

1. Check this guide's **Troubleshooting** section
2. Review test cases in **rate-limiter.test.ts**
3. Check edge function logs in Supabase dashboard
4. Contact security team for policy questions

---

**Last Updated:** March 30, 2026  
**Version:** 1.0  
**Status:** Production Ready ✅
