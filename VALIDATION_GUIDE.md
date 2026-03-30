# Input Validation & Sanitization Guide

## Overview

This document explains how to use the input validation system to protect against SQL injection, XSS, and other malicious inputs.

**Key Files:**
- `src/lib/validation/schemas.ts` — Zod schemas for all input types
- `src/lib/validation/utils.ts` — Validation functions and `ValidationError` class
- `src/lib/validation/index.ts` — Barrel export for easy importing

---

## Quick Start

### 1. Import Validation Functions

```typescript
import {
  validateSignUp,
  validateCreateCampaign,
  ValidationError,
} from '@/lib/validation'
```

### 2. Validate User Input Before Using It

```typescript
// In a form submission handler
const handleSignUp = async (email: string, password: string, displayName: string) => {
  try {
    // Validate first — throws ValidationError on failure
    const validated = validateSignUp({ email, password, displayName })
    
    // Now use validated data safely
    const { data, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
    })
  } catch (err) {
    if (err instanceof ValidationError) {
      // Safe error message for user display
      setError(err.getClientMessage())
      console.log('Validation issues:', err.issues) // For debugging
    }
  }
}
```

### 3. Field-Level Validation

For form validation during user input (real-time feedback):

```typescript
import { validateSoft } from '@/lib/validation'

const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value
  const validated = validateSoft(displayNameSchema, value)
  
  if (validated === null) {
    setError('Display name contains invalid characters')
  } else {
    setError(null)
    setDisplayName(validated)
  }
}
```

---

## Validation Patterns

### Pattern 1: Object Validation (Recommended)

Use when validating a complete object (form submission, API request body):

```typescript
import { validateCreateCampaign, ValidationError } from '@/lib/validation'

const handleCreateCampaign = async (formData: unknown) => {
  try {
    const validated = validateCreateCampaign(formData)
    // validated has correct types and sanitized values
    await supabase.from('campaigns').insert(validated)
  } catch (err) {
    if (err instanceof ValidationError) {
      err.issues.forEach(issue => {
        console.error(`${issue.field}: ${issue.message}`)
      })
    }
  }
}
```

### Pattern 2: Individual Field Validation

Use for specific field validation:

```typescript
import { validateEmail, validatePassword, ValidationError } from '@/lib/validation'

try {
  const email = validateEmail(userInput.email)
  const password = validatePassword(userInput.password)
  // Both are safe to use
} catch (err) {
  if (err instanceof ValidationError) {
    // Handle error
  }
}
```

### Pattern 3: Soft Validation (Non-Throwing)

Use when you want null instead of thrown errors:

```typescript
import { validateSoft } from '@/lib/validation'
import { emailSchema } from '@/lib/validation'

const email = validateSoft(emailSchema, userInput)
if (email === null) {
  console.log('Invalid email, no error thrown')
} else {
  console.log('Valid email:', email)
}
```

### Pattern 4: Batch Validation

Use when validating multiple fields at once:

```typescript
import { validateBatch, emailSchema, passwordSchema } from '@/lib/validation'

try {
  validateBatch([
    ['email', emailSchema, formData.email],
    ['password', passwordSchema, formData.password],
  ])
  // All validated successfully
} catch (err) {
  if (err instanceof ValidationError) {
    // Handle first validation failure
  }
}
```

---

## Available Validation Functions

### Authentication
- `validateSignIn({ email, password })`
- `validateSignUp({ email, password, displayName? })`
- `validateResetPassword({ email })`
- `validateUpdatePassword({ newPassword })`
- `validateEmail(email)` — Single email field
- `validatePassword(password)` — Single password field
- `validateDisplayName(displayName)` — Single display name field

### Campaigns
- `validateCreateCampaign({ name, description? })`
- `validateUpdateCampaign({ name?, description? })`
- `validateCampaignName(name)` — Single field
- `validateCampaignDescription(description)` — Single field
- `validateCampaignId(id)` — Validates UUID format

### Sessions
- `validateCreateSession({ name, sessionDate?, campaignId })`
- `validateUpdateSession({ name?, sessionDate? })`
- `validateSessionName(name)` — Single field
- `validateSessionId(id)` — Validates UUID format

### Notes & Content
- `validateUpdateNote({ contentMd })`
- `validateMarkdownContent(content)` — Single field

### Entity Tags
- `validateCreateEntityTag({ name, description?, tagType, sessionId })`
- `validateUpdateEntityTag({ name?, description?, tagType? })`
- `validateTagType(type)` — Must be: 'npc' | 'location' | 'item' | 'pet'
- `validateTagId(id)` — Validates UUID format

### Profile
- `validateUpdateProfile({ displayName?, avatarUrl? })`

### General
- `validateId(id)` — Any UUID
- `validateInviteCode(code)` — 8-char alphanumeric

---

## Validation Rules

### Email
- Must be valid email format
- Max 255 characters
- Automatically lowercase and trimmed

### Password
- Minimum 8 characters
- Maximum 128 characters
- No null bytes

### Display Name
- Required (min 1 character)
- Max 100 characters
- No special characters: `< > " ' % ; ( ) &`
- Trimmed automatically

### Campaign Name
- Required (min 1 character)
- Max 255 characters
- No special characters (same as display name)
- Trimmed automatically

### Campaign Description
- Max 5000 characters
- No null bytes

### Tag Type
- Must be one of: `'npc' | 'location' | 'item' | 'pet'`
- Whitelist validation (safest approach)

### Invite Code
- Must be exactly 8 characters
- Only uppercase letters and numbers (A-Z, 0-9)
- Trimmed automatically

### IDs (UUID)
- Must be valid UUID v4 format
- Used for all campaign_id, session_id, tag_id, user_id fields

---

## Error Handling

### ValidationError Class

```typescript
class ValidationError {
  issues: Array<{ field: string; message: string }>
  getFieldError(fieldName: string): string | undefined
  getClientMessage(): string
}
```

**Usage:**

```typescript
try {
  const validated = validateSignUp(formData)
} catch (err) {
  if (err instanceof ValidationError) {
    // For logging/debugging: raw issues with db-safe messages
    console.error(err.issues)
    
    // For user display: generic safe message
    setErrorMessage(err.getClientMessage())
    
    // For field-level feedback
    setEmailError(err.getFieldError('email'))
    setPasswordError(err.getFieldError('password'))
  }
}
```

### Safe Error Messages

**Never display raw validation errors to users** — they may leak information:

```typescript
// ❌ BAD: Exposes validation details
setError(err.message) // "database constraint violation on field 'email'"

// ✅ GOOD: Generic message
setError(err.getClientMessage()) // "Invalid input provided. Please check your entries and try again."

// ✅ ALSO GOOD: Field-specific feedback
const fieldError = err.getFieldError('email')
if (fieldError) setEmailError('Invalid email format')
```

---

## Integration Checklist

- [x] Created `src/lib/validation/` directory with schemas and utilities
- [x] Updated `useSupabaseAuth.ts` to validate auth inputs
- [ ] Update all API route handlers (campaigns, sessions, tags)
- [ ] Update all form components to validate on submit
- [ ] Update Supabase edge functions with validation
- [ ] Add validation tests
- [ ] Document in README.md or STYLEGUIDE.md

---

## Defense in Depth

This validation layer works **alongside** existing security:

1. **Parameterized Queries** — Supabase client uses them natively (prevents SQL injection)
2. **Row Level Security (RLS)** — Supabase enforces access control at the database
3. **Input Validation** — This layer validates type, format, length, and content
4. **Safe Error Messages** — Never expose implementation details to clients

Example flow:

```
User Input
  ↓
[Validation Layer] ← Catches malformed/malicious input early
  ↓
[Supabase Client] ← Uses parameterized queries
  ↓
[Database RLS Policies] ← Enforces access control
  ↓
Safe Data
```

---

## Common Injection Attempts & Defenses

### SQL Injection
```typescript
// Attacker tries:
email = "test@example.com'; DROP TABLE campaigns; --"

// Our defense:
validateSignUp({ email, password })
// Throws ValidationError: "Invalid email format"
// Even if it passed, Supabase uses parameterized queries
```

### XSS via Display Name
```typescript
displayName = "<script>alert('hacked')</script>"

// Our defense:
validateDisplayName(displayName)
// Throws ValidationError: "Display name contains invalid characters"
```

### Null Byte Injection
```typescript
content = "hello\0world"

// Our defense:
validateMarkdownContent(content)
// Throws ValidationError: "Content contains invalid null bytes"
```

### Excessively Long Input
```typescript
campaignName = "a".repeat(1000000)

// Our defense:
validateCampaignName(campaignName)
// Throws ValidationError: "Campaign name must be under 255 characters"
```

---

## Testing Validation

### Manual Testing

```typescript
import { validateEmail, ValidationError } from '@/lib/validation'

// Test valid input
try {
  const email = validateEmail('test@example.com')
  console.log('✓ Valid:', email)
} catch (err) {
  console.log('✗ Failed:', err.message)
}

// Test invalid input
try {
  const email = validateEmail('not-an-email')
  console.log('✓ Valid:', email) // Won't reach here
} catch (err) {
  if (err instanceof ValidationError) {
    console.log('✓ Correctly rejected:', err.getClientMessage())
  }
}

// Test injection attempt
try {
  const displayName = validateDisplayName("<script>alert('xss')</script>")
  console.log('✗ Failed to catch XSS')
} catch (err) {
  console.log('✓ Injection blocked:', err.getClientMessage())
}
```

### Automated Testing

Create test files for critical validation schemas:

```typescript
// src/lib/validation/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { validateEmail, validateDisplayName, ValidationError } from '../'

describe('Email Validation', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe('user@example.com')
  })

  it('rejects invalid emails', () => {
    expect(() => validateEmail('not-an-email')).toThrow(ValidationError)
  })

  it('rejects SQL injection attempts', () => {
    expect(() => validateEmail("test@example.com'; DROP TABLE--")).toThrow()
  })
})

describe('Display Name Validation', () => {
  it('rejects XSS attempts', () => {
    expect(() => validateDisplayName('<script>alert("xss")</script>')).toThrow()
  })

  it('rejects long inputs', () => {
    expect(() => validateDisplayName('a'.repeat(1000))).toThrow()
  })

  it('accepts valid names', () => {
    expect(validateDisplayName('John Doe')).toBe('John Doe')
  })
})
```

---

## Next Steps

1. **Review** this guide with your team
2. **Update** all form components to use validation
3. **Update** all API endpoints/edge functions to validate
4. **Test** with injection payloads to ensure rejection
5. **Document** in STYLEGUIDE.md for future developers

---

## Questions?

If validation seems strict, remember:
- It's better to reject a legitimate input than accept a malicious one
- Users can always reformat their input (e.g., remove special characters)
- The restrictions match real-world constraints (email format, UUID format, reasonable text length)
