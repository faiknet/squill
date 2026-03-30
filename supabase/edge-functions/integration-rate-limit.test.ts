/**
 * Rate Limiting Integration Tests
 * 
 * Tests rate limiting behavior when integrated into edge functions.
 * Verifies that requests are rejected when limits are exceeded.
 */

import { describe, it, expect, beforeEach } from "https://deno.land/std@0.208.0/testing/bdd.ts"

/**
 * Note: These are integration test examples that would run against deployed edge functions.
 * For local testing, you would use a test framework that can mock Deno.serve()
 * or run against a local edge function server.
 * 
 * The tests below demonstrate the expected behavior.
 */

describe('join-campaign rate limiting integration', () => {
  const BASE_URL = 'http://localhost:54321/functions/v1'
  const testToken = 'Bearer test-token-example'

  it('allows requests within rate limit (5 per 15 minutes)', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${BASE_URL}/join-campaign`, {
        method: 'POST',
        headers: {
          'Authorization': testToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_code: 'test-code-12345',
        }),
      })

      // Could be 400/401/404 depending on auth and campaign existence
      // But should NOT be 429
      expect(response.status).not.toBe(429)
    }
  })

  it('rejects request after exceeding limit', async () => {
    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/join-campaign`, {
        method: 'POST',
        headers: {
          'Authorization': testToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_code: `test-code-${i}`,
        }),
      })
    }

    // 6th request should be rate limited
    const response = await fetch(`${BASE_URL}/join-campaign`, {
      method: 'POST',
      headers: {
        'Authorization': testToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invite_code: 'test-code-limit',
      }),
    })

    expect(response.status).toBe(429)

    const body = await response.json() as Record<string, unknown>
    expect(body.error).toContain('Rate limit exceeded')
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  it('includes Retry-After header in 429 response', async () => {
    // Fill the quota
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/join-campaign`, {
        method: 'POST',
        headers: {
          'Authorization': testToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_code: `test-code-${i}`,
        }),
      })
    }

    // Trigger rate limit
    const response = await fetch(`${BASE_URL}/join-campaign`, {
      method: 'POST',
      headers: {
        'Authorization': testToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invite_code: 'test-code-final',
      }),
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).not.toBeNull()

    const retryAfter = Number(response.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(900) // 15 minutes
  })

  it('rate limit is per IP address', async () => {
    // Simulate different IPs via X-Forwarded-For header
    const ip1Headers = {
      'Authorization': testToken,
      'Content-Type': 'application/json',
      'X-Forwarded-For': '203.0.113.1',
    }

    const ip2Headers = {
      'Authorization': testToken,
      'Content-Type': 'application/json',
      'X-Forwarded-For': '203.0.113.2',
    }

    // Fill quota for IP1
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/join-campaign`, {
        method: 'POST',
        headers: ip1Headers,
        body: JSON.stringify({ invite_code: `test-code-${i}` }),
      })
    }

    // IP1 should be rate limited
    let response = await fetch(`${BASE_URL}/join-campaign`, {
      method: 'POST',
      headers: ip1Headers,
      body: JSON.stringify({ invite_code: 'test-code-limit' }),
    })
    expect(response.status).toBe(429)

    // IP2 should NOT be rate limited (fresh quota)
    response = await fetch(`${BASE_URL}/join-campaign`, {
      method: 'POST',
      headers: ip2Headers,
      body: JSON.stringify({ invite_code: 'test-code-1' }),
    })
    expect(response.status).not.toBe(429)
  })
})

describe('snapshot-note rate limiting integration', () => {
  const BASE_URL = 'http://localhost:54321/functions/v1'

  it('allows requests within rate limit (10 per minute)', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`${BASE_URL}/snapshot-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: 'abc-123-def-456-789',
          content_md: '# Session Notes\n\nTest content',
          updated_at: new Date().toISOString(),
        }),
      })

      // Could be 400/404 depending on session existence
      // But should NOT be 429
      expect(response.status).not.toBe(429)
    }
  })

  it('rejects request after exceeding limit', async () => {
    const sessionId = 'test-session-' + Date.now()

    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await fetch(`${BASE_URL}/snapshot-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          content_md: `# Session Notes ${i}\n\nTest content`,
          updated_at: new Date().toISOString(),
        }),
      })
    }

    // 11th request should be rate limited
    const response = await fetch(`${BASE_URL}/snapshot-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        content_md: '# Final attempt',
        updated_at: new Date().toISOString(),
      }),
    })

    expect(response.status).toBe(429)

    const body = await response.json() as Record<string, unknown>
    expect(body.error).toContain('Rate limit exceeded')
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  it('rate limit is per session ID', async () => {
    const session1 = 'session-' + Date.now() + '-1'
    const session2 = 'session-' + Date.now() + '-2'

    // Fill quota for session1
    for (let i = 0; i < 10; i++) {
      await fetch(`${BASE_URL}/snapshot-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session1,
          content_md: `# Session 1 - ${i}`,
          updated_at: new Date().toISOString(),
        }),
      })
    }

    // session1 should be rate limited
    let response = await fetch(`${BASE_URL}/snapshot-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session1,
        content_md: '# Attempt 11',
        updated_at: new Date().toISOString(),
      }),
    })
    expect(response.status).toBe(429)

    // session2 should NOT be rate limited (fresh quota)
    response = await fetch(`${BASE_URL}/snapshot-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session2,
        content_md: '# Session 2 - First',
        updated_at: new Date().toISOString(),
      }),
    })
    expect(response.status).not.toBe(429)
  })

  it('allows missing session_id without rate limiting', async () => {
    // Request without session_id should not be rate limited
    // (validation will catch it later)
    const response = await fetch(`${BASE_URL}/snapshot-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_md: '# No session',
        updated_at: new Date().toISOString(),
      }),
    })

    // Should be 400 validation error, not 429
    expect(response.status).not.toBe(429)
    expect(response.status).toBe(400)
  })
})

describe('Rate limit error handling', () => {
  it('returns safe error message without implementation details', async () => {
    const response = await fetch('http://localhost:54321/functions/v1/join-campaign', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invite_code: 'test' }),
    })

    if (response.status === 429) {
      const body = await response.json() as Record<string, unknown>
      const error = body.error as string

      // Should not contain implementation details
      expect(error).not.toContain('RateLimiter')
      expect(error).not.toContain('window')
      expect(error).not.toContain('milliseconds')

      // Should contain user-friendly message
      expect(error.toLowerCase()).toContain('rate limit')
    }
  })

  it('continues to return validation errors when rate limit not hit', async () => {
    const response = await fetch('http://localhost:54321/functions/v1/join-campaign', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invite_code: 'invalid!!!code!!!with!!!bad!!!chars',
      }),
    })

    // Should get validation error (400), not rate limit error (429)
    expect(response.status).toBe(400)

    const body = await response.json() as Record<string, unknown>
    const error = body.error as string
    expect(error).toBeDefined()
    expect(error).not.toContain('Rate limit exceeded')
  })
})
