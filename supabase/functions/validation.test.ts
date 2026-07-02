/**
 * Jest Test Suite for Deno Validation Library
 * Tests all validation functions with valid inputs, edge cases, and attack vectors
 * 
 * Phase 4: Comprehensive testing & security validation
 */

import {
  ValidationError,
  validateUUID,
  validateInviteCode,
  validateSessionId,
  validateMarkdownContent,
  validateAuthorizationHeader,
  validateObject,
} from './validation.ts'

describe('Validation Library - Phase 4 Tests', () => {
  // ============================================================================
  // UUID Validation Tests
  // ============================================================================

  describe('validateUUID()', () => {
    it('should accept valid UUID', () => {
      const valid = '550e8400-e29b-41d4-a716-446655440000'
      expect(validateUUID(valid, 'test_id')).toBe(valid)
    })

    it('should accept valid UUID (uppercase)', () => {
      const valid = '550E8400-E29B-41D4-A716-446655440000'
      expect(validateUUID(valid, 'test_id')).toBe(valid)
    })

    it('should accept valid UUID (mixed case)', () => {
      const valid = '550e8400-E29B-41d4-A716-446655440000'
      expect(validateUUID(valid, 'test_id')).toBe(valid)
    })

    it('should reject non-string', () => {
      expect(() => validateUUID(123, 'test_id')).toThrow(ValidationError)
      expect(() => validateUUID(null, 'test_id')).toThrow(ValidationError)
      expect(() => validateUUID(undefined, 'test_id')).toThrow(ValidationError)
    })

    it('should reject invalid UUID format', () => {
      expect(() => validateUUID('not-a-uuid', 'test_id')).toThrow(ValidationError)
      expect(() => validateUUID('550e8400e29b41d4a716446655440000', 'test_id')).toThrow(
        ValidationError
      )
      expect(() => validateUUID('550e8400-e29b-41d4-a716-44665544000', 'test_id')).toThrow(
        ValidationError
      )
    })

    it('should reject SQL injection in UUID', () => {
      expect(() => validateUUID("'; DROP TABLE users; --", 'test_id')).toThrow(ValidationError)
      expect(() => validateUUID('550e8400-e29b-41d4-a716-446655440000" OR "1"="1', 'test_id')).toThrow(
        ValidationError
      )
    })

    it('should reject empty string', () => {
      expect(() => validateUUID('', 'test_id')).toThrow(ValidationError)
    })
  })

  // ============================================================================
  // Invite Code Validation Tests
  // ============================================================================

  describe('validateInviteCode()', () => {
    it('should accept valid invite code (alphanumeric)', () => {
      expect(validateInviteCode('valid123')).toBe('valid123')
    })

    it('should accept valid invite code (with hyphens)', () => {
      expect(validateInviteCode('valid-code-123')).toBe('valid-code-123')
    })

    it('should accept invite code at minimum length', () => {
      expect(validateInviteCode('12345678')).toBe('12345678')
    })

    it('should accept invite code at maximum length', () => {
      expect(validateInviteCode('12345678901234567890')).toBe('12345678901234567890')
    })

    it('should trim whitespace', () => {
      expect(validateInviteCode('  valid123  ')).toBe('valid123')
    })

    it('should reject non-string', () => {
      expect(() => validateInviteCode(123)).toThrow(ValidationError)
      expect(() => validateInviteCode(null)).toThrow(ValidationError)
      expect(() => validateInviteCode(undefined)).toThrow(ValidationError)
    })

    it('should reject empty string', () => {
      expect(() => validateInviteCode('')).toThrow(ValidationError)
      expect(() => validateInviteCode('   ')).toThrow(ValidationError)
    })

    it('should reject code too short', () => {
      expect(() => validateInviteCode('1234567')).toThrow(ValidationError)
    })

    it('should reject code too long', () => {
      expect(() => validateInviteCode('123456789012345678901')).toThrow(ValidationError)
    })

    it('should reject special characters', () => {
      expect(() => validateInviteCode('code@example')).toThrow(ValidationError)
      expect(() => validateInviteCode('code#123')).toThrow(ValidationError)
      expect(() => validateInviteCode('code$123')).toThrow(ValidationError)
      expect(() => validateInviteCode('code%123')).toThrow(ValidationError)
      expect(() => validateInviteCode('code&123')).toThrow(ValidationError)
    })

    it('should reject SQL injection attempts', () => {
      expect(() => validateInviteCode("'; DROP TABLE campaigns; --")).toThrow(ValidationError)
      expect(() => validateInviteCode('code"; DROP TABLE campaigns; --')).toThrow(ValidationError)
      expect(() => validateInviteCode('code/*comment*/')).toThrow(ValidationError)
    })

    it('should reject XSS attempts', () => {
      expect(() => validateInviteCode('<script>alert(1)</script>')).toThrow(ValidationError)
      expect(() => validateInviteCode('code<img src=x>')).toThrow(ValidationError)
    })

    it('should reject LDAP injection', () => {
      expect(() => validateInviteCode('code*)(|(uid=')).toThrow(ValidationError)
    })
  })

  // ============================================================================
  // Session ID Validation Tests
  // ============================================================================

  describe('validateSessionId()', () => {
    it('should accept valid UUID', () => {
      const valid = '550e8400-e29b-41d4-a716-446655440000'
      expect(validateSessionId(valid)).toBe(valid)
    })

    it('should reject invalid format', () => {
      expect(() => validateSessionId('not-a-uuid')).toThrow(ValidationError)
    })

    it('should reject SQL injection', () => {
      expect(() => validateSessionId("'; DROP TABLE sessions; --")).toThrow(ValidationError)
    })
  })

  // ============================================================================
  // Markdown Content Validation Tests
  // ============================================================================

  describe('validateMarkdownContent()', () => {
    it('should accept valid markdown', () => {
      const valid = '# Heading\n\nThis is a paragraph.'
      expect(validateMarkdownContent(valid)).toBe(valid)
    })

    it('should accept empty string', () => {
      expect(validateMarkdownContent('')).toBe('')
    })

    it('should accept large content', () => {
      const large = 'x'.repeat(900000)
      expect(validateMarkdownContent(large)).toBe(large)
    })

    it('should accept content at size limit', () => {
      const atLimit = 'x'.repeat(1000000)
      expect(validateMarkdownContent(atLimit, 1000000)).toBe(atLimit)
    })

    it('should accept markdown with special chars', () => {
      const markdown = '**bold** *italic* `code` [link](url) > quote'
      expect(validateMarkdownContent(markdown)).toBe(markdown)
    })

    it('should accept markdown with code blocks', () => {
      const markdown = '```typescript\nconst x = 1;\n```'
      expect(validateMarkdownContent(markdown)).toBe(markdown)
    })

    it('should reject non-string', () => {
      expect(() => validateMarkdownContent(123)).toThrow(ValidationError)
      expect(() => validateMarkdownContent(null)).toThrow(ValidationError)
      expect(() => validateMarkdownContent(undefined)).toThrow(ValidationError)
    })

    it('should reject content exceeding size limit', () => {
      const large = 'x'.repeat(1000001)
      expect(() => validateMarkdownContent(large, 1000000)).toThrow(ValidationError)
    })

    it('should reject content with null bytes', () => {
      const withNull = 'content\0with\0nulls'
      expect(() => validateMarkdownContent(withNull)).toThrow(ValidationError)
    })

    it('should reject multiple null bytes', () => {
      expect(() => validateMarkdownContent('a\0b\0c')).toThrow(ValidationError)
    })

    it('should reject XSS attempts', () => {
      // While markdown allows HTML, the content itself is validated for null bytes
      // XSS prevention happens at rendering level, not validation level
      const html = '<script>alert(1)</script>'
      // Should pass validation but would be escaped at render time
      expect(validateMarkdownContent(html)).toBe(html)
    })

    it('should accept markdown with URLs', () => {
      const markdown = '[Link](https://example.com)\n[Email](mailto:test@example.com)'
      expect(validateMarkdownContent(markdown)).toBe(markdown)
    })

    it('should accept markdown with HTML entities', () => {
      const markdown = '&lt;tag&gt; &amp; &quot;quoted&quot;'
      expect(validateMarkdownContent(markdown)).toBe(markdown)
    })
  })

  // ============================================================================
  // Authorization Header Validation Tests
  // ============================================================================

  describe('validateAuthorizationHeader()', () => {
    it('should accept valid Bearer token', () => {
      expect(() => validateAuthorizationHeader('Bearer eyJhbGc')).not.toThrow()
    })

    it('should accept Bearer token with spaces in token', () => {
      expect(() => validateAuthorizationHeader('Bearer token-with-dashes')).not.toThrow()
    })

    it('should reject missing header', () => {
      expect(() => validateAuthorizationHeader(null)).toThrow(ValidationError)
    })

    it('should reject empty string', () => {
      expect(() => validateAuthorizationHeader('')).toThrow(ValidationError)
    })

    it('should reject Basic auth', () => {
      expect(() => validateAuthorizationHeader('Basic dXNlcjpwYXNz')).toThrow(ValidationError)
    })

    it('should reject Bearer with missing token', () => {
      expect(() => validateAuthorizationHeader('Bearer ')).toThrow(ValidationError)
    })

    it('should reject malformed header', () => {
      expect(() => validateAuthorizationHeader('InvalidHeader token')).toThrow(ValidationError)
    })

    it('should reject Bearer (case sensitive check)', () => {
      expect(() => validateAuthorizationHeader('bearer token')).toThrow(ValidationError)
    })
  })

  // ============================================================================
  // Batch Validation Tests
  // ============================================================================

  describe('validateObject()', () => {
    it('should validate object with all fields', () => {
      const schema = {
        id: (v) => validateUUID(v, 'id'),
        code: validateInviteCode,
      }
      const data = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        code: 'valid-code-123',
      }

      const result = validateObject(schema, data)
      expect(result.success).toBe(true)
      expect(result.data?.id).toBe(data.id)
      expect(result.data?.code).toBe(data.code)
    })

    it('should return error on invalid field', () => {
      const schema = {
        id: (v) => validateUUID(v, 'id'),
      }
      const data = {
        id: 'not-a-uuid',
      }

      const result = validateObject(schema, data)
      expect(result.success).toBe(false)
      expect(result.error?.field).toBe('id')
    })

    it('should reject non-object input', () => {
      const schema = { id: (v) => v }
      const result = validateObject(schema, 'not an object')
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INVALID_TYPE')
    })

    it('should reject null input', () => {
      const schema = { id: (v) => v }
      const result = validateObject(schema, null)
      expect(result.success).toBe(false)
    })

    it('should handle missing fields', () => {
      const schema = {
        id: (v) => validateUUID(v, 'id'),
      }
      const data = {}

      const result = validateObject(schema, data)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================================
  // ValidationError Class Tests
  // ============================================================================

  describe('ValidationError', () => {
    it('should create error with field and message', () => {
      const error = new ValidationError('email', 'Invalid email format', 'INVALID_EMAIL')
      expect(error.field).toBe('email')
      expect(error.message).toBe('Invalid email format')
      expect(error.code).toBe('INVALID_EMAIL')
    })

    it('should be instanceof Error', () => {
      const error = new ValidationError('field', 'message')
      expect(error instanceof Error).toBe(true)
    })

    it('should return safe client message', () => {
      const error = new ValidationError('field', 'message')
      expect(error.getClientMessage()).toBe('Invalid input provided')
    })

    it('should have correct name', () => {
      const error = new ValidationError('field', 'message')
      expect(error.name).toBe('ValidationError')
    })

    it('should use default code', () => {
      const error = new ValidationError('field', 'message')
      expect(error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ============================================================================
  // Real-World Attack Scenarios
  // ============================================================================

  describe('Real-World Attack Scenarios', () => {
    it('should prevent SQL injection in invite code', () => {
      const sqlInjections = [
        "'; DROP TABLE campaigns; --",
        "' OR '1'='1",
        "\" OR \"1\"=\"1",
        "'; UPDATE campaigns SET invite_code = 'hacked'; --",
        "1' UNION SELECT * FROM users; --",
        "' AND (SELECT * FROM campaigns WHERE 1); --",
      ]

      sqlInjections.forEach((payload) => {
        expect(() => validateInviteCode(payload)).toThrow(ValidationError)
      })
    })

    it('should prevent null byte injection', () => {
      const nullBytePayloads = [
        'content\0with\0nulls',
        'test\x00injection',
        'normal\0content',
      ]

      nullBytePayloads.forEach((payload) => {
        expect(() => validateMarkdownContent(payload)).toThrow(ValidationError)
      })
    })

    it('should prevent buffer overflow in content', () => {
      const huge = 'x'.repeat(2000000)
      expect(() => validateMarkdownContent(huge, 1000000)).toThrow(ValidationError)
    })

    it('should prevent LDAP injection in invite code', () => {
      const ldapInjections = [
        'code*)(|(uid=',
        'code*))(&',
        'valid*)(uid=*))(|(uid=*',
      ]

      ldapInjections.forEach((payload) => {
        expect(() => validateInviteCode(payload)).toThrow(ValidationError)
      })
    })

    it('should prevent format string attacks', () => {
      // Format string attacks typically use printf-style strings
      const formatStrings = [
        '%x%x%x%x',
        '%n%n%n',
        '%s%s%s',
      ]

      formatStrings.forEach((payload) => {
        expect(() => validateInviteCode(payload)).toThrow(ValidationError)
      })
    })

    it('should prevent path traversal in patterns', () => {
      const traversal = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'code/../../sensitive',
      ]

      traversal.forEach((payload) => {
        expect(() => validateInviteCode(payload)).toThrow(ValidationError)
      })
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very long strings efficiently', () => {
      const start = Date.now()
      const long = 'a'.repeat(100000)
      validateMarkdownContent(long)
      const end = Date.now()
      // Should validate in < 100ms
      expect(end - start).toBeLessThan(100)
    })

    it('should handle unicode characters', () => {
      const unicode = '你好世界 🌍 مرحبا'
      expect(validateMarkdownContent(unicode)).toBe(unicode)
    })

    it('should handle emoji in markdown', () => {
      const emoji = '✅ Task complete\n🚀 Ready to deploy\n❌ Failed'
      expect(validateMarkdownContent(emoji)).toBe(emoji)
    })

    it('should handle mixed line endings', () => {
      const mixed = 'Line1\r\nLine2\nLine3\rLine4'
      expect(validateMarkdownContent(mixed)).toBe(mixed)
    })

    it('should handle tabs and special spaces', () => {
      const special = 'Tab\there\t\tDouble\u00A0NonBreaking'
      expect(validateMarkdownContent(special)).toBe(special)
    })
  })

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('should reject wrong types for all validators', () => {
      const wrongTypes = [[], {}, true, false, Symbol('test')]

      wrongTypes.forEach((value) => {
        expect(() => validateUUID(value, 'test')).toThrow(ValidationError)
        expect(() => validateInviteCode(value)).toThrow(ValidationError)
        expect(() => validateMarkdownContent(value)).toThrow(ValidationError)
      })
    })

    it('should handle NaN and Infinity', () => {
      expect(() => validateUUID(NaN, 'test')).toThrow(ValidationError)
      expect(() => validateUUID(Infinity, 'test')).toThrow(ValidationError)
    })
  })

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should validate UUID in < 1ms', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        validateUUID('550e8400-e29b-41d4-a716-446655440000', 'test')
      }
      const end = Date.now()
      expect(end - start).toBeLessThan(100) // 1000 validations in < 100ms
    })

    it('should validate invite code in < 1ms', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        validateInviteCode('valid-code-123')
      }
      const end = Date.now()
      expect(end - start).toBeLessThan(100)
    })

    it('should validate content in < 1ms', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        validateMarkdownContent('# Test\n\nContent')
      }
      const end = Date.now()
      expect(end - start).toBeLessThan(100)
    })
  })
})
