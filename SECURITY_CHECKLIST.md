# 🔒 Security Checklist — Before Shipping

This checklist ensures all user inputs are properly validated before database operations.

## Quick Reference

### ✅ Validation Required For:
- Email addresses
- Passwords  
- User display names
- Campaign/session names
- Note content
- Entity tags
- Profile updates
- Invite codes
- All UUID/ID parameters

### ❌ Never Accept Unvalidated Input Into:
- Database queries
- Dynamic SQL (use parameterized queries — Supabase does this)
- HTML rendering (TipTap handles this)
- File uploads (implement file type validation)

---

## Integration Checklist

When adding a new feature that accepts user input:

- [ ] Import validation function from `@/lib/validation`
- [ ] Call `validate()` before using the data
- [ ] Catch `ValidationError` and display safe message to user
- [ ] Use validated data for database operations
- [ ] Write test case for the validation

### Example
```typescript
import { validateCreateCampaign, ValidationError } from '@/lib/validation'

async function createCampaign(formData) {
  try {
    // ✅ Validate first
    const validated = validateCreateCampaign(formData)
    
    // ✅ Use validated data
    const { data, error } = await supabase
      .from('campaigns')
      .insert(validated)
    
    // Handle response...
  } catch (err) {
    if (err instanceof ValidationError) {
      // ✅ Safe error message
      setError(err.getClientMessage())
    }
  }
}
```

---

## Common Mistakes (Avoid These!)

❌ **DON'T:** Trust user input
```typescript
// WRONG
const name = formData.campaignName
await supabase.from('campaigns').insert({ name })
```

❌ **DON'T:** Display raw validation errors
```typescript
// WRONG
catch (err) {
  setError(err.message) // May leak implementation details
}
```

❌ **DON'T:** Manually try to "sanitize" input
```typescript
// WRONG
const sanitized = name.replace(/['"]/g, '') // Incomplete
```

✅ **DO:** Use validation functions
```typescript
// CORRECT
const validated = validateCampaignName(name)
// Now safely use validated
```

✅ **DO:** Use safe error messages
```typescript
// CORRECT
catch (err) {
  if (err instanceof ValidationError) {
    setError(err.getClientMessage())
  }
}
```

✅ **DO:** Rely on Supabase RLS + parameterized queries
```typescript
// CORRECT
const validated = validateCreateCampaign(formData)
// Supabase client handles parameterization automatically
await supabase.from('campaigns').insert(validated)
```

---

## Defense in Depth Layers

```
Layer 1: Input Validation (Client-side) ← YOU ARE HERE
Layer 2: Parameterized Queries (Supabase)
Layer 3: Row Level Security (Database)
```

Each layer protects against different failure modes:

| Layer | Protects Against | Enforced By |
|-------|-----------------|-----------|
| Validation | Invalid format, obvious attacks | JavaScript (this implementation) |
| Parameterized Queries | SQL injection | Supabase library |
| RLS Policies | Unauthorized access | PostgreSQL database |

**None of these are optional.** Do your part: validate inputs.

---

## What's Protected Now

- ✅ Auth operations (signup, signin, password reset)
- ✅ Campaign operations (fully validated schemas)
- ✅ Session operations (fully validated schemas)
- ✅ Note content (markdown length + null byte checks)
- ✅ Entity tags (type whitelist validation)
- ✅ All ID parameters (UUID format validation)

---

## What Still Needs Integration

These components have validation schemas but need to integrate them:

- [ ] CampaignList.jsx — `validateCreateCampaign()`
- [ ] CampaignDetail.jsx — `validateUpdateCampaign()`
- [ ] SessionEditor.jsx — `validateUpdateNote()`
- [ ] Settings.jsx — `validateUpdateProfile()`
- [ ] JoinCampaign.jsx — `validateInviteCode()`
- [ ] useSessionData hook — `validateCreateSession()`, `validateUpdateSession()`
- [ ] Supabase edge functions — Add server-side validation

---

## Testing for Injection Safety

Before shipping any component:

1. **Test with clean input**
   ```
   Input: "My Campaign"
   Expected: Accepted ✅
   ```

2. **Test with injection attempt**
   ```
   Input: "My'; DROP TABLE--"
   Expected: Rejected ✅
   ```

3. **Test with XSS attempt**
   ```
   Input: "<script>alert(1)</script>"
   Expected: Rejected ✅
   ```

4. **Test with null bytes**
   ```
   Input: "Content\0Hidden"
   Expected: Rejected ✅
   ```

5. **Test with long input**
   ```
   Input: "a" * 10000
   Expected: Rejected if > field limit ✅
   ```

---

## Error Message Examples

### ✅ Safe Messages (Show to User)
- "Invalid input provided. Please check your entries and try again."
- "Email format is invalid"
- "Password must be at least 8 characters"
- "Display name contains invalid characters"

### ❌ Unsafe Messages (Never Show)
- "database constraint violation"
- "PostgreSQL error: syntax error"
- "SQL parsing failed at position..."
- "Schema mismatch on field 'email'"

Use `ValidationError.getClientMessage()` for safe output.

---

## Resources

- **Full Guide:** `VALIDATION_GUIDE.md` — Complete developer reference
- **Implementation Details:** `SECURITY_IMPLEMENTATION.md` — What was built
- **Test Examples:** `src/lib/validation/validation.test.ts` — 32 real test cases
- **Schema Definitions:** `src/lib/validation/schemas.ts` — All validation rules
- **Utility Functions:** `src/lib/validation/utils.ts` — How to validate

---

## Red Flags 🚩

Stop and validate if you see:

- [ ] User input going directly to database: `db.insert(userInput)`
- [ ] String concatenation in queries: `FROM users WHERE name = '${name}'`
- [ ] No error handling: `try { ... } catch { }`
- [ ] Displaying raw errors: `setError(err.message)`
- [ ] Skipping validation for "simple" fields
- [ ] Custom "sanitization" instead of validation libraries
- [ ] No length limits on string fields

---

## When in Doubt

**Ask:** "Could a user provide malicious input here?"
- If YES → Validate it
- If NO → Validate it anyway (doesn't hurt)

Remember: Rejecting a legitimate input is better than accepting a malicious one.

---

**Last Updated:** March 30, 2026  
**Status:** Ready for integration  
**Test Coverage:** 32/32 PASSED ✅
