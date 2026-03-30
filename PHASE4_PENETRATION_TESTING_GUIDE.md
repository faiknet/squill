# Security Penetration Testing Guide — Phase 4

**Date:** March 30, 2026  
**Purpose:** Manual security testing of validation system  
**Audience:** Security team, QA engineers, developers  
**Scope:** Client-side validation, server-side validation, defense-in-depth

---

## 📋 Table of Contents

1. [Testing Overview](#testing-overview)
2. [Environment Setup](#environment-setup)
3. [Test Categories](#test-categories)
4. [Attack Payloads](#attack-payloads)
5. [Testing Procedures](#testing-procedures)
6. [Results Documentation](#results-documentation)
7. [Reporting](#reporting)

---

## 🎯 Testing Overview

### Objectives

- ✅ Verify all input validation functions work correctly
- ✅ Confirm edge cases are handled properly
- ✅ Validate error messages don't leak implementation details
- ✅ Test defense-in-depth (multiple validation layers)
- ✅ Confirm performance under attack

### Success Criteria

| Criterion | Expected Result |
|-----------|-----------------|
| SQL injection blocked | All payloads rejected with 400 error |
| XSS attempts blocked | All payloads rejected or safely escaped |
| Null byte injection blocked | All payloads rejected |
| Buffer overflow prevented | Large payloads rejected |
| Authorization enforced | Missing/invalid auth returns 401 |
| Error messages safe | Generic message, no details leaked |
| Performance acceptable | Response time <2s under attack |

---

## 🔧 Environment Setup

### Prerequisites

- Supabase local development environment (or staging deployment)
- `curl` or Postman for API testing
- Text editor for payload testing
- This guide and attack payload lists

### Start Local Supabase

```bash
cd /path/to/squill
supabase start
```

Expected output:
```
Seeding data...
Started supabase local development server.
         URL: http://localhost:54321
    anon key: eyJhbGc...
service_role key: eyJhbGc...
```

### Get Test Tokens

```bash
# Get JWT token from Supabase auth
export JWT_TOKEN="your-auth-token-here"

# Or create a test user
curl -X POST http://localhost:54321/auth/v1/signup \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGc..." \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

---

## 📚 Test Categories

### 1. Input Format Validation

**Goal:** Verify format validation prevents invalid data shapes

**Functions:** validateUUID, validateInviteCode, validateMarkdownContent

### 2. Size Limit Enforcement

**Goal:** Confirm size limits prevent buffer overflow attacks

**Max Sizes:**
- Invite code: 20 characters
- Session/Campaign ID: 36 characters (UUID)
- Markdown content: 1,000,000 bytes (1 MB)

### 3. Character Restriction

**Goal:** Verify special characters are properly filtered

**Allowed:** Alphanumeric, hyphen (invite code), full UTF-8 (content)  
**Blocked:** SQL special chars (`;`, `--`, `/*`), null bytes (`\0`)

### 4. Authorization Validation

**Goal:** Confirm auth header validation works

**Bearer Token Requirements:**
- Format: `Bearer <token>`
- Token present and non-empty
- Case-sensitive: `bearer` (lowercase) should fail

### 5. Error Message Safety

**Goal:** Verify error messages don't leak implementation details

**Safe Message:** `"error": "Invalid input provided"`  
**Unsafe Messages:** Anything mentioning specific validation rules, database structure, code paths

### 6. Defense-in-Depth

**Goal:** Confirm validation happens at all layers

**Layers to Test:**
1. Client-side (Phase 1-2) — Validation before API call
2. Server-side (Phase 3) — Edge function validation
3. Parameterized queries (Built-in) — DB-level protection
4. Row Level Security (Built-in) — User isolation

---

## 💣 Attack Payloads

### SQL Injection Payloads

```
'; DROP TABLE campaigns; --
' OR '1'='1
" OR "1"="1
'; UPDATE campaigns SET name = 'hacked'; --
1' UNION SELECT * FROM users; --
' AND (SELECT * FROM campaigns WHERE 1); --
'; EXEC xp_cmdshell('whoami'); --
1' AND SLEEP(5); --
' OR 1=1--
admin' --
```

### XSS Attack Payloads

```
<script>alert('xss')</script>
<img src=x onerror="alert('xss')">
"><script>alert('xss')</script>
<svg onload="alert('xss')">
javascript:alert('xss')
<iframe src="javascript:alert('xss')">
<body onload="alert('xss')">
```

### LDAP Injection Payloads

```
code*)(|(uid=
*))(&
valid*)(uid=*))(|(uid=*
admin*
*)(mail=*))(&(mail=*
```

### Path Traversal Payloads

```
../../../etc/passwd
..\\..\\..\\windows\\system32
code/../../sensitive
....//....//....//etc/passwd
code%2f..%2f..%2fetc%2fpasswd
```

### Null Byte Injection Payloads

```
content\0with\0nulls
test\x00injection
filename.txt\0.png
```

### Format String Attack Payloads

```
%x%x%x%x
%n%n%n
%s%s%s
%08x.%08x.%08x.%08x
```

### Buffer Overflow Payloads

```
# Content exceeding 1MB
(repeat 'x' 1,000,001 times)

# Invite code exceeding 20 chars
aaaaaaaaaaaaaaaaaaaaaaa (23+ chars)
```

---

## 🧪 Testing Procedures

### Procedure 1: SQL Injection in Invite Code

**Test:** POST /join-campaign with SQL injection payload

**Steps:**

1. Start with a known-good payload:
```bash
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "valid-code-123"}'
```

Expected: 200 or 404 (campaign not found)

2. Try SQL injection payload:
```bash
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "'; DROP TABLE campaigns; --"}'
```

Expected: 400 (Validation error)

3. Verify error message:
```json
{
  "error": "Invalid input provided"
}
```

**Success:** 400 status with safe error message

### Procedure 2: Authorization Validation

**Test:** POST /join-campaign without/invalid auth header

**Steps:**

1. Missing auth header:
```bash
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "valid-code-123"}'
```

Expected: 401 (Unauthorized)

2. Invalid Bearer format:
```bash
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Authorization: Basic xyz" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "valid-code-123"}'
```

Expected: 401 (Unauthorized)

3. Lowercase "bearer":
```bash
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Authorization: bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "valid-code-123"}'
```

Expected: 401 (Unauthorized, case-sensitive)

**Success:** All return 401 as expected

### Procedure 3: Content Size Limit

**Test:** POST /snapshot-note with content exceeding 1MB

**Steps:**

1. Valid size (900KB):
```bash
# Create 900KB content
SIZE=$((900000))
CONTENT=$(python3 -c "print('x' * $SIZE)")

curl -X POST http://localhost:54321/functions/v1/snapshot-note \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"550e8400-e29b-41d4-a716-446655440000\",
    \"content_md\": \"$CONTENT\"
  }"
```

Expected: 200 or 404 (validation passes)

2. Over limit (1.1MB):
```bash
SIZE=$((1100000))
CONTENT=$(python3 -c "print('x' * $SIZE)")

curl -X POST http://localhost:54321/functions/v1/snapshot-note \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"550e8400-e29b-41d4-a716-446655440000\",
    \"content_md\": \"$CONTENT\"
  }"
```

Expected: 400 (Size exceeded)

**Success:** 1MB limit properly enforced

### Procedure 4: Null Byte Injection

**Test:** POST /snapshot-note with null bytes in content

**Steps:**

```bash
# Using printf to include null bytes
PAYLOAD=$(printf '{"session_id": "550e8400-e29b-41d4-a716-446655440000", "content_md": "test\x00injection"}')

curl -X POST http://localhost:54321/functions/v1/snapshot-note \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

Expected: 400 (Null bytes detected)

**Success:** Null bytes properly rejected

### Procedure 5: UUID Format Validation

**Test:** POST /snapshot-note with invalid session_id

**Steps:**

1. Invalid UUID format:
```bash
curl -X POST http://localhost:54321/functions/v1/snapshot-note \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "not-a-uuid",
    "content_md": "# Test"
  }'
```

Expected: 400 (Invalid UUID)

2. SQL injection in UUID:
```bash
curl -X POST http://localhost:54321/functions/v1/snapshot-note \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'; DROP TABLE sessions; --",
    "content_md": "# Test"
  }'
```

Expected: 400 (Invalid UUID format caught)

**Success:** UUID format strictly enforced

### Procedure 6: Error Message Safety

**Test:** Verify error messages don't leak details

**Steps:**

1. Trigger multiple validation errors:
```bash
curl -X POST http://localhost:54321/functions/v1/join-campaign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "'; DROP TABLE--"}'
```

2. Check response body (should NOT contain):
- Database table names
- Validation rule specifics
- Code paths or stack traces
- Implementation details

Expected response:
```json
{
  "error": "Invalid input provided"
}
```

**Success:** Generic, safe error message

---

## 📊 Results Documentation

### Test Result Template

```markdown
## Test: [Name]
**Date:** [Date]
**Tester:** [Name]
**Environment:** [local/staging/production]

### Objective
[What are we testing?]

### Procedure
[Steps taken]

### Expected Result
[What should happen]

### Actual Result
[What actually happened]

### Verdict
- [ ] PASS
- [ ] FAIL
- [ ] BLOCKED

### Notes
[Any observations or issues]
```

### Example Result

```markdown
## Test: SQL Injection in Invite Code
**Date:** March 30, 2026
**Tester:** Security Team
**Environment:** local

### Objective
Verify SQL injection payloads are blocked

### Procedure
1. Sent POST /join-campaign with payload: `'; DROP TABLE campaigns; --`
2. Checked HTTP status code
3. Examined response body

### Expected Result
- HTTP 400 status
- Error message: "Invalid input provided"
- No database changes

### Actual Result
- HTTP 400 ✓
- Error message: "Invalid input provided" ✓
- Database unchanged ✓

### Verdict
- [x] PASS

### Notes
Validation properly rejected malicious payload before reaching database.
```

---

## 📋 Testing Checklist

### Client-Side Validation (Phase 1-2)

- [ ] Campaign name validation accepts valid names
- [ ] Campaign name blocks SQL injection
- [ ] Campaign name blocks XSS
- [ ] Session name validation works
- [ ] Note content accepts markdown
- [ ] Note content size limit enforced
- [ ] Email validation rejects invalid formats
- [ ] Password validation enforces requirements
- [ ] All error messages are safe

### Server-Side Validation (Phase 3)

- [ ] Invite code format validated
- [ ] Invite code SQL injection blocked
- [ ] Auth header validation enforces Bearer
- [ ] Auth header missing returns 401
- [ ] Session ID UUID validation works
- [ ] Session ID SQL injection blocked
- [ ] Content size limit enforced (1MB)
- [ ] Content null bytes detected
- [ ] All error messages are safe

### Defense-in-Depth (All Layers)

- [ ] Client validation rejects before API
- [ ] Server validation rejects before DB
- [ ] Parameterized queries prevent injection
- [ ] RLS policies enforce user isolation
- [ ] No single point of failure

### Error Handling

- [ ] All validation errors return safe messages
- [ ] Errors don't mention specific rules
- [ ] Errors don't reveal database structure
- [ ] Errors don't contain stack traces
- [ ] Error codes provided for logging

### Performance

- [ ] Validation <1ms per operation
- [ ] Invalid requests rejected quickly
- [ ] No slowdown with large valid inputs
- [ ] No resource exhaustion under attack

---

## 📝 Reporting

### Security Report Template

**Title:** Security Testing Report — Phase 4  
**Date:** [Date]  
**Tested By:** [Team]  
**Environment:** [local/staging/production]  

#### Executive Summary
[1-2 sentence summary]

#### Tests Performed
- [ ] Input format validation
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Null byte injection prevention
- [ ] Authorization enforcement
- [ ] Error message safety
- [ ] Performance under attack

#### Results
- Total tests: [X]
- Passed: [X]
- Failed: [X]
- Blocked: [X]

#### Vulnerabilities Found
[List any issues discovered]

#### Recommendations
[Suggested fixes or improvements]

#### Approval
- [ ] Approved for production
- [ ] Approved with recommendations
- [ ] Requires remediation

---

## 🎯 Attack Simulation Scenarios

### Scenario 1: Attacker Attempting SQL Injection

**Goal:** Extract campaign list using SQL injection

**Attack Steps:**
1. Send invite code: `' UNION SELECT id, name FROM campaigns; --`
2. Expect: 400 error, no data leaked
3. Verify: Error message is generic

**Success:** Injection blocked, data protected

### Scenario 2: Attacker Attempting XSS

**Goal:** Inject JavaScript into campaign name

**Attack Steps:**
1. Create campaign with name: `<img src=x onerror="alert('xss')">`
2. Expect: Validation rejects or content escapes
3. Verify: No script execution

**Success:** XSS prevented or safely escaped

### Scenario 3: Attacker Attempting DOS

**Goal:** Exhaust server resources with large payload

**Attack Steps:**
1. Send 10MB content to /snapshot-note
2. Expect: 400 error (size exceeded)
3. Verify: Request rejected before hitting database

**Success:** DOS prevented

### Scenario 4: Attacker Bypassing Client Validation

**Goal:** Send raw HTTP request bypassing client validation

**Attack Steps:**
1. Use curl/Postman to send invalid data
2. Send: `{"invite_code": "sql-injection-attempt"}`
3. Expect: Server-side validation catches it
4. Verify: Edge function rejects it

**Success:** Server validation layer works

---

## ✅ Verification Checklist

### Before Production

- [ ] All SQL injection payloads blocked (400 error)
- [ ] All XSS payloads blocked or escaped
- [ ] All null byte injections blocked
- [ ] All buffer overflow attempts blocked
- [ ] All authorization failures return 401
- [ ] All error messages are safe (generic)
- [ ] All tests documented with results
- [ ] No vulnerabilities found (or all remediated)
- [ ] Performance acceptable under attack
- [ ] Defense-in-depth confirmed

### Sign-Off

- [ ] Security team reviews results
- [ ] All findings remediated
- [ ] Ready for production deployment

---

**Phase 4 Penetration Testing Complete When:**
- ✅ All test procedures executed
- ✅ All results documented
- ✅ No critical vulnerabilities found
- ✅ Security team approves
- ✅ Ready for production deployment
