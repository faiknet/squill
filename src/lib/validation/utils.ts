import type { ZodSchema } from 'zod'
import { z } from 'zod'
import * as schemas from './schemas'

// ============================================================================
// Validation Error Handling
// ============================================================================

export class ValidationError extends Error {
  constructor(
    public issues: Array<{ field: string; message: string }>,
    message: string = 'Validation failed'
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  /**
   * Get the first error message for a specific field
   */
  getFieldError(field: string): string | undefined {
    return this.issues.find((issue) => issue.field === field)?.message
  }

  /**
   * Safe message for client display (never leaks DB info)
   */
  getClientMessage(): string {
    const defaultMessage = 'Please check your entries and try again'
    if (this.issues.length === 0) return defaultMessage
    if (this.issues.length === 1) return this.issues[0].message
    const firstIssue = this.issues[0].message
    const count = this.issues.length - 1
    return `${firstIssue} (and ${count} more ${count === 1 ? 'issue' : 'issues'})`
  }
}

/**
 * Parse Zod validation error into a safe, structured format
 */
function parseZodError(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }))
}

// ============================================================================
// Generic Validation Helper
// ============================================================================

/**
 * Safely validate data against a schema.
 * Throws ValidationError on failure with safe error messages.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and type-safe data
 * @throws ValidationError with structured issues and safe client message
 */
function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(
      parseZodError(result.error),
      'Input validation failed'
    )
  }
  return result.data as T
}

// ============================================================================
// Auth Validation
// ============================================================================

export function validateSignIn(data: unknown) {
  return validate(schemas.signInSchema, data)
}

export function validateSignUp(data: unknown) {
  return validate(schemas.signUpSchema, data)
}

export function validateResetPassword(data: unknown) {
  return validate(schemas.resetPasswordSchema, data)
}

export function validateEmail(email: unknown): string {
  return validate(schemas.emailSchema, email)
}

export function validatePassword(password: unknown): string {
  return validate(schemas.passwordSchema, password)
}

export function validateDisplayName(displayName: unknown): string {
  return validate(schemas.displayNameSchema, displayName)
}

// ============================================================================
// Campaign Validation
// ============================================================================

export function validateCreateCampaign(data: unknown) {
  return validate(schemas.createCampaignSchema, data)
}

export function validateUpdateCampaign(data: unknown) {
  return validate(schemas.updateCampaignSchema, data)
}

export function validateCampaignName(name: unknown): string {
  return validate(schemas.campaignNameSchema, name)
}

export function validateCampaignId(id: unknown): string {
  return validate(schemas.campaignIdSchema, id)
}

// ============================================================================
// Session Validation
// ============================================================================

export function validateCreateSession(data: unknown) {
  return validate(schemas.createSessionSchema, data)
}

export function validateUpdateSession(data: unknown) {
  return validate(schemas.updateSessionSchema, data)
}

export function validateSessionId(id: unknown): string {
  return validate(schemas.sessionIdSchema, id)
}

// ============================================================================
// Notes & Content Validation
// ============================================================================

export function validateUpdateNote(data: unknown) {
  return validate(schemas.updateNoteSchema, data)
}

export function validateMarkdownContent(content: unknown): string {
  return validate(schemas.markdownContentSchema, content)
}

// ============================================================================
// Entity Tag Validation
// ============================================================================

export function validateCreateEntityTag(data: unknown) {
  return validate(schemas.createEntityTagSchema, data)
}

export function validateUpdateEntityTag(data: unknown) {
  return validate(schemas.updateEntityTagSchema, data)
}

export function validateTagId(id: unknown): string {
  return validate(schemas.tagIdSchema, id)
}

// ============================================================================
// Profile Validation
// ============================================================================

export function validateUpdateProfile(data: unknown) {
  return validate(schemas.updateProfileSchema, data)
}

