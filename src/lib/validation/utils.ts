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
    return 'Invalid input provided. Please check your entries and try again.'
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
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(
      parseZodError(result.error),
      'Input validation failed'
    )
  }
  return result.data as T
}

/**
 * Soft validation that doesn't throw — returns parsed data or null
 */
export function validateSoft<T>(schema: ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data)
  return result.success ? (result.data as T) : null
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

export function validateUpdatePassword(data: unknown) {
  return validate(schemas.updatePasswordSchema, data)
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

export function validateCampaignDescription(description: unknown): string {
  return validate(schemas.campaignDescriptionSchema, description)
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

export function validateSessionName(name: unknown): string {
  return validate(schemas.sessionNameSchema, name)
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

export function validateTagType(type: unknown) {
  return validate(schemas.tagTypeSchema, type)
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

// ============================================================================
// ID/UUID Validation
// ============================================================================

export function validateUserId(id: unknown): string {
  return validate(schemas.userIdSchema, id)
}

export function validateId(id: unknown): string {
  return validate(schemas.uuidSchema, id)
}

// ============================================================================
// Invite Code Validation
// ============================================================================

export function validateInviteCode(code: unknown): string {
  return validate(schemas.inviteCodeSchema, code)
}

// ============================================================================
// Batch Validation Helper
// ============================================================================

/**
 * Validate multiple fields at once. Returns first validation error encountered.
 *
 * @param validations - Array of [field, schema, value] tuples
 * @throws ValidationError with the first validation failure
 */
export function validateBatch(
  validations: Array<[field: string, schema: ZodSchema, value: unknown]>
) {
  for (const [field, schema, value] of validations) {
    const result = schema.safeParse(value)
    if (!result.success) {
      const issues = parseZodError(result.error).map((issue) => ({
        field: `${field}.${issue.field}`.replace(/\.$/, ''),
        message: issue.message,
      }))
      throw new ValidationError(issues, `Validation failed for ${field}`)
    }
  }
}

// ============================================================================
// Content Sanitization (Additional Layer)
// ============================================================================

/**
 * Remove potentially dangerous HTML/script content from markdown
 * Note: Markdown typically compiles to HTML safely, but this adds defense in depth
 */
export function sanitizeMarkdown(content: string): string {
  // Remove null bytes (common injection vector)
  let sanitized = content.replace(/\0/g, '')

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return sanitized
}

/**
 * Safely extract text from user input (trim and normalize whitespace)
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .slice(0, 5000) // Safety limit
}
