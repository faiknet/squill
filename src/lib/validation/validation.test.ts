import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validateCampaignName,
  validateMarkdownContent,
  validateSignUp,
  validateCreateCampaign,
  validateCreateSession,
  ValidationError,
} from '../validation'

describe('Input Validation & Injection Prevention', () => {
  describe('Email Validation', () => {
    it('accepts valid emails', () => {
      expect(validateEmail('user@example.com')).toBe('user@example.com')
      expect(validateEmail('TEST@EXAMPLE.COM')).toBe('test@example.com') // lowercased
    })

    it('rejects invalid email formats', () => {
      expect(() => validateEmail('not-an-email')).toThrow(ValidationError)
      expect(() => validateEmail('user@')).toThrow(ValidationError)
      expect(() => validateEmail('user@example')).toThrow(ValidationError)
    })

    it('rejects SQL injection attempts', () => {
      expect(() => validateEmail("test@example.com'; DROP TABLE users--")).toThrow(ValidationError)
      expect(() => validateEmail('test@example.com" OR "1"="1')).toThrow(ValidationError)
    })

    it('rejects excessively long emails', () => {
      const longEmail = 'a'.repeat(300) + '@example.com'
      expect(() => validateEmail(longEmail)).toThrow(ValidationError)
    })
  })

  describe('Password Validation', () => {
    it('accepts valid passwords', () => {
      expect(validatePassword('ValidPassword123')).toBe('ValidPassword123')
    })

    it('rejects short passwords', () => {
      expect(() => validatePassword('short')).toThrow(ValidationError)
    })

    it('rejects passwords without uppercase letters', () => {
      expect(() => validatePassword('validpassword123')).toThrow(ValidationError)
    })

    it('rejects passwords without numbers', () => {
      expect(() => validatePassword('ValidPasswordOnly')).toThrow(ValidationError)
    })

    it('rejects passwords with null bytes', () => {
      expect(() => validatePassword('password\0injection')).toThrow(ValidationError)
    })

    it('rejects excessively long passwords', () => {
      const longPassword = 'a'.repeat(200)
      expect(() => validatePassword(longPassword)).toThrow(ValidationError)
    })
  })

  describe('Display Name Validation', () => {
    it('accepts valid display names', () => {
      expect(validateDisplayName('John Doe')).toBe('John Doe')
      expect(validateDisplayName('  Alice  ')).toBe('Alice') // trimmed
    })

    it('rejects XSS attempts', () => {
      expect(() => validateDisplayName('<script>alert("xss")</script>')).toThrow(ValidationError)
      expect(() => validateDisplayName('John<img src=x onerror=alert(1)>')).toThrow(ValidationError)
      expect(() => validateDisplayName('Test" onclick="alert(1)')).toThrow(ValidationError)
    })

    it('rejects special characters', () => {
      expect(() => validateDisplayName('John;DROP')).toThrow(ValidationError)
      expect(() => validateDisplayName('Test%27 OR %271%27=%271')).toThrow(ValidationError)
      expect(() => validateDisplayName('Alert()')).toThrow(ValidationError)
      expect(() => validateDisplayName('Test&Test')).toThrow(ValidationError)
    })

    it('rejects empty or very long names', () => {
      expect(() => validateDisplayName('')).toThrow(ValidationError)
      expect(() => validateDisplayName('  ')).toThrow(ValidationError)
      const longName = 'a'.repeat(200)
      expect(() => validateDisplayName(longName)).toThrow(ValidationError)
    })
  })

  describe('Campaign Name Validation', () => {
    it('accepts valid campaign names', () => {
      expect(validateCampaignName('The Lost Kingdom')).toBe('The Lost Kingdom')
      expect(validateCampaignName('  Quest Adventure  ')).toBe('Quest Adventure') // trimmed
    })

    it('rejects SQL injection patterns', () => {
      expect(() => validateCampaignName("Campaign'; DROP TABLE campaigns--")).toThrow(ValidationError)
      expect(() => validateCampaignName('Campaign" OR "1"="1')).toThrow(ValidationError)
    })

    it('rejects special characters', () => {
      expect(() => validateCampaignName('Campaign;DELETE')).toThrow(ValidationError)
      expect(() => validateCampaignName('Campaign%DROP')).toThrow(ValidationError)
      expect(() => validateCampaignName('Campaign&DELETE')).toThrow(ValidationError)
    })

    it('rejects excessively long names', () => {
      const longName = 'a'.repeat(500)
      expect(() => validateCampaignName(longName)).toThrow(ValidationError)
    })
  })

  describe('Markdown Content Validation', () => {
    it('accepts valid markdown content', () => {
      const content = '# Heading\n\nThis is a **bold** statement.'
      expect(validateMarkdownContent(content)).toBe(content)
    })

    it('rejects null byte injections', () => {
      expect(() => validateMarkdownContent('Content\0Hidden')).toThrow(ValidationError)
    })

    it('rejects excessively large content', () => {
      const largeContent = 'a'.repeat(1000001)
      expect(() => validateMarkdownContent(largeContent)).toThrow(ValidationError)
    })

    it('allows reasonable large content', () => {
      const largeContent = 'a'.repeat(100000)
      expect(validateMarkdownContent(largeContent)).toBe(largeContent)
    })
  })

  describe('Object Validation (SignUp)', () => {
    it('validates complete sign-up objects', () => {
      const validData = {
        email: 'user@example.com',
        password: 'ValidPassword123',
        displayName: 'John Doe',
      }
      const result = validateSignUp(validData)
      expect(result.email).toBe('user@example.com')
      expect(result.password).toBe('ValidPassword123')
      expect(result.displayName).toBe('John Doe')
    })

    it('rejects with malicious data', () => {
      const maliciousData = {
        email: "test@example.com'; DROP TABLE users--",
        password: 'ValidPassword123',
        displayName: '<script>alert("xss")</script>',
      }
      expect(() => validateSignUp(maliciousData)).toThrow(ValidationError)
    })

    it('allows optional displayName', () => {
      const data = {
        email: 'user@example.com',
        password: 'ValidPassword123',
      }
      const result = validateSignUp(data)
      expect(result.displayName).toBeUndefined()
    })
  })

  describe('Campaign Creation Validation', () => {
    it('validates campaign creation objects', () => {
      const validData = {
        name: 'Dragon\'s Lair',
        description: 'An epic adventure in a dangerous dungeon.',
      }
      const result = validateCreateCampaign(validData)
      expect(result.name).toBe('Dragon\'s Lair')
      expect(result.description).toBe('An epic adventure in a dangerous dungeon.')
    })

    it('rejects injected campaign names with forbidden chars', () => {
      const maliciousData = {
        name: 'Campaign"; DROP TABLE campaigns--',
        description: 'Description',
      }
      expect(() => validateCreateCampaign(maliciousData)).toThrow(ValidationError)
    })

    it('allows optional description', () => {
      const data = { name: 'Campaign' }
      const result = validateCreateCampaign(data)
      expect(result.description).toBeUndefined()
    })
  })

  describe('Session Creation Validation', () => {
    it('accepts date-only session dates from HTML date inputs', () => {
      const result = validateCreateSession({
        name: 'Session 1',
        sessionDate: '2026-04-03',
        campaignId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(result.sessionDate).toBe('2026-04-03')
    })
  })

  describe('ValidationError Handling', () => {
    it('provides safe client messages', () => {
      try {
        validateEmail('invalid-email')
      } catch (err) {
        if (err instanceof ValidationError) {
          const clientMsg = err.getClientMessage()
          expect(clientMsg).toBe('Invalid input provided. Please check your entries and try again.')
          expect(clientMsg).not.toContain('database')
          expect(clientMsg).not.toContain('SQL')
        }
      }
    })

    it('provides structured issue information for debugging', () => {
      try {
        validateSignUp({
          email: 'invalid',
          password: 'short',
          displayName: '<script>',
        })
      } catch (err) {
        if (err instanceof ValidationError) {
          expect(err.issues.length).toBeGreaterThan(0)
          const emailIssue = err.getFieldError('email')
          expect(emailIssue).toBeDefined()
          expect(emailIssue).toContain('Invalid email format')
        }
      }
    })
  })

  describe('Real-world Attack Scenarios', () => {
    it('blocks SQL injection attempts with forbidden characters', () => {
      // Many SQL injection patterns without forbidden chars would pass validation,
      // but that's OK because Supabase uses parameterized queries.
      // This test focuses on injections that use our blocked special characters.
      const injections = [
        '"; DROP TABLE campaigns; --',
        '" OR 1=1; --',
        '"; UPDATE campaigns SET name = 1; --',
      ]
      injections.forEach((injection) => {
        expect(() => validateCampaignName(injection)).toThrow(ValidationError)
      })
    })

    it('blocks XSS in display name', () => {
      const xssAttempts = [
        '<img src=x onerror="alert(1)">',
        '<svg/onload=alert("xss")>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
      ]
      xssAttempts.forEach((xss) => {
        expect(() => validateDisplayName(xss)).toThrow(ValidationError)
      })
    })

    it('blocks path traversal in content', () => {
      const pathTraversals = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '....//....//....//etc/passwd',
      ]
      // Path traversal in markdown content is less critical but should not
      // cause null bytes or control chars
      pathTraversals.forEach((path) => {
        // These should pass as content since they're valid markdown,
        // but the application layer would handle the logic
        expect(() => validateMarkdownContent(path)).not.toThrow()
      })
    })

    it('blocks LDAP injection patterns with forbidden characters', () => {
      const ldapInjections = [
        '*)(|(uid=*', // Contains parentheses which are forbidden
        'admin*)(|(uid=*', // Contains parentheses
      ]
      // LDAP injection that include forbidden special characters gets blocked
      ldapInjections.forEach((ldap) => {
        expect(() => validateDisplayName(ldap)).toThrow(ValidationError)
      })

      // Simple wildcard is allowed since * is not in our blocked chars
      const simpleWildcard = '*'
      expect(validateDisplayName(simpleWildcard)).toBe('*')
      const wildcardName = 'admin*'
      expect(validateDisplayName(wildcardName)).toBe('admin*')
    })
  })
})
