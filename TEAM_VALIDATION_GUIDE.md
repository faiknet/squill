# Input Validation Best Practices — Team Guide

**Version:** 1.0  
**Date:** March 30, 2026  
**Audience:** All developers  
**Purpose:** Guidelines for implementing and maintaining the validation system

---

## 📋 Quick Start for Developers

### Rule 1: Always Validate User Input

**When adding a new feature that accepts user data:**

```typescript
// ❌ WRONG - No validation
const campaign = await supabase
  .from('campaigns')
  .insert({ name: req.body.name })

// ✅ CORRECT - Validation before DB
const { name } = validateCreateCampaign(req.body)
const campaign = await supabase
  .from('campaigns')
  .insert({ name })
```

### Rule 2: Use Existing Validation Functions

Before creating new validation, check if it exists:

```typescript
// Available validation functions
validateEmail(email)           // Auth
validatePassword(password)     // Auth
validateCreateCampaign(data)   // Campaign creation
validateUpdateCampaign(data)   // Campaign updates
validateCreateSession(data)    // Session creation
validateCreateEntityTag(data)  // Tag creation
validateUpdateNote(data)       // Note updates
validateInviteCode(code)       // Edge functions
validateSessionId(id)          // Edge functions
validateMarkdownContent(md)    // Edge functions
```

### Rule 3: Handle ValidationError Correctly

```typescript
import { ValidationError, validateCreateCampaign } from '@/lib/validation'

try {
  const validated = validateCreateCampaign(req.body)
  // Use validated data for DB operations
  const result = await db.campaigns.create(validated)
} catch (error) {
  if (error instanceof ValidationError) {
    // Show safe error message to user
    return res.status(400).json({
      error: error.getClientMessage(),
    })
  }
  // Other errors
  throw error
}
```

---

## 🛠️ Implementation Patterns

### Pattern 1: Component-Level Validation

**File:** `src/pages/CampaignList.jsx`

```typescript
// ✅ Validation before state update
const handleCreateCampaign = async (formData) => {
  try {
    // Validate user input
    const { name, description } = validateCreateCampaign(formData)
    
    // Use validated data for DB operation
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ name, description })
    
    if (error) throw error
    setShowSuccess(true)
  } catch (error) {
    if (error instanceof ValidationError) {
      setError(error.getClientMessage())
    } else {
      setError('Failed to create campaign')
    }
  }
}
```

### Pattern 2: Hook-Level Validation

**File:** `src/hooks/useSessionData.js`

```typescript
// ✅ Validation in custom hook
export const useSessionData = (sessionId) => {
  const saveNote = async (content) => {
    try {
      // Validate before API call
      const validated = validateUpdateNote({ contentMd: content })
      const sessionIdValidated = validateSessionId(sessionId)
      
      const { data, error } = await supabase
        .from('session_notes')
        .upsert({ session_id: sessionIdValidated, content_md: validated.contentMd })
      
      if (error) throw error
      return data
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error(error.getClientMessage())
      } else {
        throw error
      }
    }
  }
  
  return { saveNote }
}
```

### Pattern 3: Edge Function Validation

**File:** `supabase/edge-functions/join-campaign/index.ts`

```typescript
// ✅ Server-side validation in edge function
import { ValidationError, validateInviteCode } from '../validation.ts'

serve(async (req) => {
  try {
    const body = await req.json()
    
    // Validate invite code
    let invite_code
    try {
      invite_code = validateInviteCode(body.invite_code)
    } catch (error) {
      if (error instanceof ValidationError) {
        return new Response(
          JSON.stringify({ error: error.getClientMessage() }),
          { status: 400 }
        )
      }
    }
    
    // Use validated code for query
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('invite_code', invite_code)
    
    // ... rest of logic
  } catch (error) {
    // Handle unexpected errors
  }
})
```

---

## 🔍 Common Mistakes (and How to Avoid Them)

### ❌ Mistake 1: Forgetting to Catch ValidationError

```typescript
// WRONG - ValidationError not caught
const { name } = validateCreateCampaign(formData)
// If validation fails, error crashes the app

// ✅ CORRECT
try {
  const { name } = validateCreateCampaign(formData)
  // Use validated name
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error gracefully
  }
}
```

### ❌ Mistake 2: Using Original Data Instead of Validated

```typescript
// WRONG - Using original req.body
const { name, description } = req.body
await db.campaigns.create({ name, description })

// ✅ CORRECT - Using validated data
const validated = validateCreateCampaign(req.body)
await db.campaigns.create(validated)
```

### ❌ Mistake 3: Leaking Details in Error Messages

```typescript
// WRONG - Exposes validation rules to user
console.error(`Invalid: ${error.message}`)
return { error: error.message }

// ✅ CORRECT - Uses safe message
console.error(`Invalid: ${error.message}`) // For logs only
return { error: error.getClientMessage() } // For users
```

### ❌ Mistake 4: Creating New Validators Instead of Using Existing

```typescript
// WRONG - Reinventing validation
const isValidEmail = (email) => email.includes('@')

// ✅ CORRECT - Using built-in validator
import { validateEmail } from '@/lib/validation'
validateEmail(email)
```

### ❌ Mistake 5: Validating After Database Operation

```typescript
// WRONG - Too late, malicious data already in DB
await db.campaigns.create({ name: req.body.name })
validateCampaignName(req.body.name)

// ✅ CORRECT - Validate first
validateCreateCampaign(req.body)
await db.campaigns.create(validated)
```

---

## 📚 Validation Functions Reference

### Authentication Validation

**validateEmail(email)**
- Validates email format
- Trims and lowercases
- Returns: normalized email string
- Throws: ValidationError if invalid

**validatePassword(password)**
- Requires: min 8 chars, max 128 chars
- Detects: null bytes, common injection patterns
- Returns: password string
- Throws: ValidationError if invalid

**validateSignIn(data)**
- Validates: email + password
- Returns: `{ email, password }`
- Throws: ValidationError if invalid

**validateSignUp(data)**
- Validates: email + password + optional displayName
- Returns: `{ email, password, displayName? }`
- Throws: ValidationError if invalid

### Campaign Validation

**validateCreateCampaign(data)**
- Validates: name (required), description (optional)
- Returns: `{ name, description? }`
- Throws: ValidationError if invalid

**validateUpdateCampaign(data)**
- Validates: name (optional), description (optional)
- Returns: `{ name?, description? }`
- Throws: ValidationError if invalid

**validateCampaignId(id)**
- Validates: UUID format
- Returns: UUID string
- Throws: ValidationError if invalid

### Session Validation

**validateCreateSession(data)**
- Validates: name, sessionDate (optional), campaignId
- Returns: `{ name, sessionDate?, campaignId }`
- Throws: ValidationError if invalid

**validateSessionId(id)**
- Validates: UUID format
- Returns: UUID string
- Throws: ValidationError if invalid

### Note Validation

**validateUpdateNote(data)**
- Validates: contentMd (max 1MB)
- Returns: `{ contentMd }`
- Throws: ValidationError if invalid

**validateMarkdownContent(content, maxSize = 1000000)**
- Validates: string, size limit, no null bytes
- Returns: content string
- Throws: ValidationError if invalid

### Tag Validation

**validateCreateEntityTag(data)**
- Validates: text, type (npc|location|item|pet), color
- Returns: `{ text, type, color }`
- Throws: ValidationError if invalid

**validateTagId(id)**
- Validates: UUID format
- Returns: UUID string
- Throws: ValidationError if invalid

### Edge Function Validation

**validateInviteCode(code)**
- Validates: alphanumeric + hyphen, 8-20 chars
- Returns: trimmed code string
- Throws: ValidationError if invalid

**validateAuthorizationHeader(header)**
- Validates: Bearer token format
- Returns: void (or throws)
- Throws: ValidationError if invalid

**validateWebhookSignature(body, signature, secret)**
- Validates: HMAC-SHA256 signature
- Returns: boolean (true if valid)
- Throws: ValidationError if invalid

---

## 🧪 Testing Your Validation

### Writing Tests

```typescript
import { validateCreateCampaign, ValidationError } from '@/lib/validation'

describe('validateCreateCampaign', () => {
  it('should accept valid campaign data', () => {
    const data = { name: 'New Campaign' }
    const result = validateCreateCampaign(data)
    expect(result.name).toBe('New Campaign')
  })

  it('should reject SQL injection', () => {
    const data = { name: "'; DROP TABLE campaigns; --" }
    expect(() => validateCreateCampaign(data)).toThrow(ValidationError)
  })

  it('should provide safe error message', () => {
    const data = { name: "'; DROP TABLE--" }
    try {
      validateCreateCampaign(data)
    } catch (error) {
      if (error instanceof ValidationError) {
        expect(error.getClientMessage()).toBe('Invalid input provided')
      }
    }
  })
})
```

### Manual Testing

```bash
# Test invite code validation
curl -X POST http://localhost:3000/api/join-campaign \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "'; DROP TABLE--"}'
# Expected: 400 error with safe message

# Test with valid code
curl -X POST http://localhost:3000/api/join-campaign \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "valid-code-123"}'
# Expected: 200 or 404 (campaign not found)
```

---

## 🔐 Security Checklist for Code Review

When reviewing code that handles user input:

- [ ] Input is validated before database operation
- [ ] Validation uses built-in functions (not custom)
- [ ] ValidationError is caught and handled
- [ ] Error message uses `getClientMessage()`
- [ ] No sensitive data in error response
- [ ] Parameterized queries used (not string concatenation)
- [ ] No `any` type for validated data
- [ ] Type definitions match validation schema
- [ ] Tests cover valid + invalid cases
- [ ] Attack payloads tested (SQL, XSS, null bytes)

---

## 📖 Further Reading

**For Developers:**
- `PHASE2_QUICK_REFERENCE.md` — Component integration patterns
- `VALIDATION_GUIDE.md` — Complete function reference

**For Security Team:**
- `SECURITY_IMPLEMENTATION.md` — Architecture & attack vectors
- `PHASE4_PENETRATION_TESTING_GUIDE.md` — Testing procedures

**For Architects:**
- `PHASE3_IMPLEMENTATION_REPORT.md` — Server-side validation design
- `SECURITY_CHECKLIST.md` — Integration checklist

---

## 🆘 Getting Help

### Question: "Should I validate this field?"

**Answer:** Yes, always. Every piece of user input should be validated.

### Question: "What error message should I show?"

**Answer:** Always use `error.getClientMessage()`. It returns: "Invalid input provided"

### Question: "How do I add a new field to validation?"

**Answer:** 
1. Add schema to `src/lib/validation/schemas.ts`
2. Add validation function to `src/lib/validation/utils.ts`
3. Add tests to `src/lib/validation/validation.test.ts`
4. Export from `src/lib/validation/index.ts`
5. Use in components/hooks

### Question: "Why do I get ValidationError?"

**Answer:** Your input failed validation. Check:
- Field name matches expected format
- No special characters where not allowed
- Content not exceeding size limits
- All required fields provided
- Correct data types

### Question: "How do I know what fields are required?"

**Answer:** Check the validation schema:

```typescript
// From src/lib/validation/schemas.ts
export const createCampaignSchema = z.object({
  name: campaignNameSchema,           // Required
  description: campaignDescriptionSchema.optional(), // Optional
})
```

Required fields don't have `.optional()`

---

## 📝 Summary

**Remember:**

1. ✅ **Validate everything** — All user input before using it
2. ✅ **Use built-in validators** — Don't create custom ones
3. ✅ **Catch ValidationError** — Handle validation failures gracefully
4. ✅ **Show safe messages** — Use `getClientMessage()` for users
5. ✅ **Test thoroughly** — Include attack payloads in tests
6. ✅ **Review carefully** — Security checklist before merge

**Questions?** Refer to this guide, VALIDATION_GUIDE.md, or ask the security team.

---

*Generated: March 30, 2026 — Phase 4 Team Documentation*
