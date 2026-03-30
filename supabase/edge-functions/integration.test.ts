/**
 * Integration Tests for Supabase Edge Functions
 * Tests join-campaign and snapshot-note with various payloads
 * 
 * Phase 4: Integration testing & security validation
 * 
 * Run these tests against deployed edge functions:
 * - http://localhost:54321/functions/v1/join-campaign (local)
 * - http://localhost:54321/functions/v1/snapshot-note (local)
 */

import axios, { AxiosError } from 'axios'

// Configuration
const EDGE_FUNCTION_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const JWT_TOKEN = process.env.SUPABASE_JWT_TOKEN || 'test-token'

const api = axios.create({
  baseURL: `${EDGE_FUNCTION_URL}/functions/v1`,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Helper to make auth requests
const joinCampaign = (inviteCode: string, token?: string) =>
  api.post('/join-campaign', { invite_code: inviteCode }, {
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
    },
  })

// Helper to snapshot notes
const snapshotNote = (sessionId: string, contentMd: string, updatedAt?: string) =>
  api.post('/snapshot-note', {
    session_id: sessionId,
    content_md: contentMd,
    updated_at: updatedAt,
  })

describe('Edge Functions Integration Tests - Phase 4', () => {
  // ============================================================================
  // join-campaign Tests
  // ============================================================================

  describe('POST /join-campaign', () => {
    describe('Valid Requests', () => {
      it('should accept valid invite code with valid token', async () => {
        try {
          const response = await joinCampaign('valid-code-123', JWT_TOKEN)
          expect(response.status).toBe(200)
          expect(response.data).toHaveProperty('message')
        } catch (error) {
          // 404 is acceptable (campaign doesn't exist, but validation passed)
          const axiosError = error as AxiosError
          expect([200, 404].includes(axiosError.response?.status || 0)).toBe(true)
        }
      })

      it('should return 404 for nonexistent campaign (after validation)', async () => {
        try {
          const response = await joinCampaign('fake-code-xyz', JWT_TOKEN)
          expect(response.status).toBe(404)
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(404)
        }
      })
    })

    describe('Invalid Invite Codes (Should Fail)', () => {
      it('should reject invite code with SQL injection', async () => {
        try {
          await joinCampaign("'; DROP TABLE campaigns; --", JWT_TOKEN)
          fail('Should have thrown validation error')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
          expect(axiosError.response?.data).toEqual({
            error: expect.any(String),
          })
        }
      })

      it('should reject invite code with special characters', async () => {
        try {
          await joinCampaign('code@#$%^&', JWT_TOKEN)
          fail('Should have thrown validation error')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject invite code too short', async () => {
        try {
          await joinCampaign('short', JWT_TOKEN)
          fail('Should have thrown validation error')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject invite code too long', async () => {
        try {
          await joinCampaign('x'.repeat(21), JWT_TOKEN)
          fail('Should have thrown validation error')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject LDAP injection in invite code', async () => {
        try {
          await joinCampaign('code*)(|(uid=', JWT_TOKEN)
          fail('Should have thrown validation error')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject XSS attempt in invite code', async () => {
        try {
          await joinCampaign('<script>alert(1)</script>', JWT_TOKEN)
          fail('Should have thrown validation error')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })
    })

    describe('Authorization Header Validation', () => {
      it('should reject missing Authorization header', async () => {
        try {
          await joinCampaign('valid-code-123', undefined)
          fail('Should have rejected missing auth header')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(401)
        }
      })

      it('should reject invalid Authorization format', async () => {
        try {
          await api.post('/join-campaign', { invite_code: 'valid-code-123' }, {
            headers: { Authorization: 'Basic xyz' },
          })
          fail('Should have rejected non-Bearer auth')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(401)
        }
      })

      it('should reject empty Bearer token', async () => {
        try {
          await joinCampaign('valid-code-123', '')
          fail('Should have rejected empty bearer token')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(401)
        }
      })
    })

    describe('Request Body Validation', () => {
      it('should reject missing invite_code field', async () => {
        try {
          await api.post('/join-campaign', {}, {
            headers: { Authorization: `Bearer ${JWT_TOKEN}` },
          })
          fail('Should have rejected missing field')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject null invite_code', async () => {
        try {
          await api.post('/join-campaign', { invite_code: null }, {
            headers: { Authorization: `Bearer ${JWT_TOKEN}` },
          })
          fail('Should have rejected null invite_code')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject non-string invite_code', async () => {
        try {
          await api.post('/join-campaign', { invite_code: 123 }, {
            headers: { Authorization: `Bearer ${JWT_TOKEN}` },
          })
          fail('Should have rejected non-string')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })
    })

    describe('Error Messages', () => {
      it('should not leak implementation details in errors', async () => {
        try {
          await joinCampaign("'; DROP TABLE--", JWT_TOKEN)
          fail('Should have thrown error')
        } catch (error) {
          const axiosError = error as AxiosError
          const errorMsg = axiosError.response?.data as any
          // Should be safe generic message, not specific validation rule
          expect(errorMsg.error).toBe('Invalid input provided')
        }
      })
    })
  })

  // ============================================================================
  // snapshot-note Tests
  // ============================================================================

  describe('POST /snapshot-note', () => {
    const validSessionId = '550e8400-e29b-41d4-a716-446655440000'

    describe('Valid Requests', () => {
      it('should accept valid session_id and content_md', async () => {
        try {
          const response = await snapshotNote(validSessionId, '# Test\n\nContent')
          expect(response.status).toBe(200)
          expect(response.data).toHaveProperty('message')
        } catch (error) {
          // 404 is acceptable (session doesn't exist, but validation passed)
          const axiosError = error as AxiosError
          expect([200, 404].includes(axiosError.response?.status || 0)).toBe(true)
        }
      })

      it('should accept empty content', async () => {
        try {
          const response = await snapshotNote(validSessionId, '')
          expect(response.status).toBe(200)
        } catch (error) {
          const axiosError = error as AxiosError
          expect([200, 404].includes(axiosError.response?.status || 0)).toBe(true)
        }
      })

      it('should accept large content (near 1MB)', async () => {
        try {
          const largeContent = 'x'.repeat(900000)
          const response = await snapshotNote(validSessionId, largeContent)
          expect(response.status).toBe(200)
        } catch (error) {
          const axiosError = error as AxiosError
          expect([200, 404].includes(axiosError.response?.status || 0)).toBe(true)
        }
      })

      it('should accept content with special markdown', async () => {
        try {
          const markdown = `
# Heading
**bold** *italic* \`code\`
[link](https://example.com)

> quote

- list item
- another item
          `
          const response = await snapshotNote(validSessionId, markdown)
          expect(response.status).toBe(200)
        } catch (error) {
          const axiosError = error as AxiosError
          expect([200, 404].includes(axiosError.response?.status || 0)).toBe(true)
        }
      })

      it('should accept content with unicode', async () => {
        try {
          const unicode = '你好世界 🌍 مرحبا العالم'
          const response = await snapshotNote(validSessionId, unicode)
          expect(response.status).toBe(200)
        } catch (error) {
          const axiosError = error as AxiosError
          expect([200, 404].includes(axiosError.response?.status || 0)).toBe(true)
        }
      })
    })

    describe('Invalid Session IDs (Should Fail)', () => {
      it('should reject invalid UUID format', async () => {
        try {
          await snapshotNote('not-a-uuid', '# Test')
          fail('Should have rejected invalid UUID')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject session_id with SQL injection', async () => {
        try {
          await snapshotNote("'; DROP TABLE sessions; --", '# Test')
          fail('Should have rejected SQL injection')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject session_id with special chars', async () => {
        try {
          await snapshotNote('550e8400@e29b@41d4@a716@446655440000', '# Test')
          fail('Should have rejected special chars')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject null session_id', async () => {
        try {
          await api.post('/snapshot-note', { session_id: null, content_md: 'test' })
          fail('Should have rejected null')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject non-string session_id', async () => {
        try {
          await api.post('/snapshot-note', { session_id: 123, content_md: 'test' })
          fail('Should have rejected non-string')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })
    })

    describe('Invalid Content (Should Fail)', () => {
      it('should reject content exceeding 1MB', async () => {
        try {
          const huge = 'x'.repeat(1000001)
          await snapshotNote(validSessionId, huge)
          fail('Should have rejected oversized content')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject content with null bytes', async () => {
        try {
          const withNull = 'content\0with\0nulls'
          await snapshotNote(validSessionId, withNull)
          fail('Should have rejected null bytes')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject null content_md', async () => {
        try {
          await api.post('/snapshot-note', { session_id: validSessionId, content_md: null })
          fail('Should have rejected null content')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject non-string content_md', async () => {
        try {
          await api.post('/snapshot-note', { session_id: validSessionId, content_md: 123 })
          fail('Should have rejected non-string')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })
    })

    describe('Request Body Validation', () => {
      it('should reject missing session_id', async () => {
        try {
          await api.post('/snapshot-note', { content_md: '# Test' })
          fail('Should have rejected missing session_id')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should reject missing content_md', async () => {
        try {
          await api.post('/snapshot-note', { session_id: validSessionId })
          fail('Should have rejected missing content_md')
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      })

      it('should handle extra fields gracefully', async () => {
        try {
          const response = await api.post('/snapshot-note', {
            session_id: validSessionId,
            content_md: '# Test',
            extra_field: 'should be ignored',
          })
          expect(response.status).toBe(200)
        } catch (error) {
          const axiosError = error as AxiosError
          expect([200, 404].includes(axiosError.response?.status || 0)).toBe(true)
        }
      })
    })

    describe('Error Messages', () => {
      it('should not leak implementation details in errors', async () => {
        try {
          await snapshotNote("'; DROP TABLE--", '# Test')
          fail('Should have thrown error')
        } catch (error) {
          const axiosError = error as AxiosError
          const errorMsg = axiosError.response?.data as any
          expect(errorMsg.error).toBe('Invalid input provided')
        }
      })
    })
  })

  // ============================================================================
  // Real-World Attack Scenarios
  // ============================================================================

  describe('Real-World Attack Scenarios', () => {
    it('should prevent multi-stage SQL injection in invite code', async () => {
      const attacks = [
        "' OR '1'='1",
        "'; EXEC xp_cmdshell('whoami'); --",
        "' UNION SELECT * FROM users; --",
        "1' AND SLEEP(5); --",
      ]

      for (const attack of attacks) {
        try {
          await joinCampaign(attack, JWT_TOKEN)
          fail(`Should have blocked: ${attack}`)
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      }
    })

    it('should prevent multiple injection types in session_id', async () => {
      const attacks = [
        "550e8400'; DROP TABLE sessions; --",
        "550e8400' OR '1'='1",
        "550e8400*/../../etc/passwd",
      ]

      for (const attack of attacks) {
        try {
          await snapshotNote(attack, 'test')
          fail(`Should have blocked: ${attack}`)
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      }
    })

    it('should prevent null byte attacks in content', async () => {
      const attacks = [
        'normal\0content',
        'test\x00injection',
        'a\0b\0c\0d',
      ]

      for (const attack of attacks) {
        try {
          await snapshotNote('550e8400-e29b-41d4-a716-446655440000', attack)
          fail(`Should have blocked null bytes`)
        } catch (error) {
          const axiosError = error as AxiosError
          expect(axiosError.response?.status).toBe(400)
        }
      }
    })

    it('should prevent resource exhaustion via large payloads', async () => {
      try {
        const huge = 'x'.repeat(2000000)
        await snapshotNote('550e8400-e29b-41d4-a716-446655440000', huge)
        fail('Should have rejected oversized payload')
      } catch (error) {
        const axiosError = error as AxiosError
        expect(axiosError.response?.status).toBe(400)
      }
    })
  })

  // ============================================================================
  // CORS and Headers
  // ============================================================================

  describe('CORS and HTTP Headers', () => {
    it('should handle OPTIONS request', async () => {
      try {
        const response = await api.options('/join-campaign')
        expect(response.status).toBe(200)
      } catch (error) {
        // Some setups might not allow OPTIONS
        const axiosError = error as AxiosError
        expect([200, 204, 405].includes(axiosError.response?.status || 0)).toBe(true)
      }
    })

    it('should set appropriate response headers', async () => {
      try {
        const response = await snapshotNote('550e8400-e29b-41d4-a716-446655440000', '# Test')
        expect(response.headers['content-type']).toContain('application/json')
      } catch (error) {
        const axiosError = error as AxiosError
        if (axiosError.response) {
          expect(axiosError.response.headers['content-type']).toContain('application/json')
        }
      }
    })
  })

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should respond within reasonable time for valid request', async () => {
      const start = Date.now()
      try {
        await joinCampaign('valid-code-123', JWT_TOKEN)
      } catch {
        // Error is fine, we're just measuring response time
      }
      const end = Date.now()
      expect(end - start).toBeLessThan(5000) // 5 second timeout
    })

    it('should validate and reject invalid input quickly', async () => {
      const start = Date.now()
      try {
        await joinCampaign("'; DROP TABLE--", JWT_TOKEN)
      } catch {
        // Expected to fail
      }
      const end = Date.now()
      // Validation should reject before hitting database, so should be fast
      expect(end - start).toBeLessThan(2000)
    })
  })
})

// Export for other test frameworks
export { joinCampaign, snapshotNote }
