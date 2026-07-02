/**
 * Deno-compatible validation utilities for Supabase edge functions.
 * Provides lightweight validation without external dependencies.
 */

// ============================================================================
// Validation Error Class
// ============================================================================

export class ValidationError extends Error {
  constructor(
    public field: string,
    public message: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  getClientMessage(): string {
    return 'Invalid input provided'
  }
}

// ============================================================================
// UUID Validation
// ============================================================================

export function validateUUID(value: unknown, fieldName: string = 'ID'): string {
  if (typeof value !== 'string') {
    throw new ValidationError(fieldName, `${fieldName} must be a string`, 'INVALID_TYPE')
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(value)) {
    throw new ValidationError(fieldName, `${fieldName} must be a valid UUID`, 'INVALID_FORMAT')
  }

  return value
}

// ============================================================================
// Invite Code Validation
// ============================================================================

export function validateInviteCode(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('invite_code', 'Invite code must be a string', 'INVALID_TYPE')
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    throw new ValidationError('invite_code', 'Invite code cannot be empty', 'EMPTY_VALUE')
  }

  // Invite codes are typically alphanumeric + hyphen, 8-20 chars
  const inviteCodeRegex = /^[a-zA-Z0-9\-]{8,20}$/
  if (!inviteCodeRegex.test(trimmed)) {
    throw new ValidationError(
      'invite_code',
      'Invite code format is invalid',
      'INVALID_FORMAT'
    )
  }

  // Protect against SQL injection attempts
  if (trimmed.includes(';') || trimmed.includes('--') || trimmed.includes('/*')) {
    throw new ValidationError(
      'invite_code',
      'Invite code contains invalid characters',
      'INVALID_CHARACTERS'
    )
  }

  return trimmed
}

// ============================================================================
// Session ID Validation
// ============================================================================

export function validateSessionId(value: unknown): string {
  return validateUUID(value, 'session_id')
}

// ============================================================================
// Content Validation (Markdown)
// ============================================================================

export function validateMarkdownContent(value: unknown, maxSize: number = 1000000): string {
  if (value === null || value === undefined) {
    throw new ValidationError('content_md', 'Content is required', 'REQUIRED_FIELD')
  }

  if (typeof value !== 'string') {
    throw new ValidationError('content_md', 'Content must be a string', 'INVALID_TYPE')
  }

  if (value.length > maxSize) {
    throw new ValidationError(
      'content_md',
      `Content exceeds maximum size of ${maxSize} bytes`,
      'SIZE_EXCEEDED'
    )
  }

  // Protect against null byte injection
  if (value.includes('\0')) {
    throw new ValidationError(
      'content_md',
      'Content contains invalid null bytes',
      'INVALID_CHARACTERS'
    )
  }

  return value
}

// ============================================================================
// Authorization Validation
// ============================================================================

export function validateAuthorizationHeader(authHeader: string | null): void {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ValidationError(
      'authorization',
      'Missing or invalid authorization header',
      'INVALID_AUTH'
    )
  }
}

// ============================================================================
// Batch Validation
// ============================================================================

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: {
    field: string
    message: string
    code: string
  }
}

export function validateObject<T>(
  schema: Record<string, (value: unknown) => unknown>,
  data: unknown
): ValidationResult<T> {
  if (typeof data !== 'object' || data === null) {
    return {
      success: false,
      error: {
        field: 'root',
        message: 'Input must be an object',
        code: 'INVALID_TYPE',
      },
    }
  }

  const validated: Record<string, unknown> = {}

  for (const [field, validator] of Object.entries(schema)) {
    try {
      validated[field] = validator((data as Record<string, unknown>)[field])
    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: {
            field: error.field,
            message: error.message,
            code: error.code,
          },
        }
      }
      return {
        success: false,
        error: {
          field,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
      }
    }
  }

  return {
    success: true,
    data: validated as T,
  }
}

// ============================================================================
// Webhook Signature Validation (Liveblocks)
// ============================================================================

/**
 * Validates Liveblocks webhook signature using HMAC-SHA256.
 * Prevents unauthorized webhook calls.
 */
export async function validateWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false
  }

  try {
    // Extract the timestamp and signed payload from the signature header
    // Format: "t=<timestamp>,s=<signature>"
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)

    const timestamp = parts.t
    const signedPayload = parts.s

    if (!timestamp || !signedPayload) {
      return false
    }

    // Verify timestamp is within 5 minutes (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000)
    const timestampNum = parseInt(timestamp, 10)
    if (Math.abs(now - timestampNum) > 300) {
      return false
    }

    // Create HMAC signature
    const payload = `${timestamp}.${body}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    const computed = Array.from(new Uint8Array(signature_bytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return computed === signedPayload
  } catch (error) {
    console.error('Webhook signature validation error:', error)
    return false
  }
}
