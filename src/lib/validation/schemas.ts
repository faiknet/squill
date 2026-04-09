import { z } from 'zod'

// ============================================================================
// Auth Schemas
// ============================================================================

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email format')
  .max(255, 'Email is too long')

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine(
    (pwd) => /[A-Z]/.test(pwd),
    'Password must include at least one uppercase letter'
  )
  .refine(
    (pwd) => /\d/.test(pwd),
    'Password must include at least one number'
  )
  // Prevent common injection patterns at password validation level
  .refine(
    (pwd) => !pwd.includes('\0'),
    'Password contains invalid characters'
  )

export const displayNameSchema = z
  .string({ required_error: 'Display name is required' })
  .trim()
  .min(1, 'Display name cannot be empty')
  .max(100, 'Display name must be under 100 characters')
  .refine(
    (name) => !/[<>\"\'%;()&+]/.test(name),
    'Display name contains invalid characters'
  )

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required' }),
})

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
})

export const resetPasswordSchema = z.object({
  email: emailSchema,
})

// ============================================================================
// Campaign Schemas
// ============================================================================

export const campaignNameSchema = z
  .string({ required_error: 'Campaign name is required' })
  .trim()
  .min(1, 'Campaign name cannot be empty')
  .max(255, 'Campaign name must be under 255 characters')
  .refine(
    (name) => !/[<>\"%;()&]/.test(name), // Allow apostrophes and hyphens
    'Campaign name contains invalid characters'
  )

const campaignDescriptionSchema = z
  .string({ required_error: 'Campaign description is required' })
  .max(5000, 'Description must be under 5000 characters')
  .refine(
    (desc) => !desc.includes('\0'),
    'Description contains invalid characters'
  )

const campaignStreakCadenceSchema = z.enum(['weekly', 'biweekly', 'monthly'], {
  errorMap: () => ({ message: 'Invalid streak cadence' }),
})

export const createCampaignSchema = z.object({
  name: campaignNameSchema,
  description: campaignDescriptionSchema.optional(),
})

export const updateCampaignSchema = z.object({
  name: campaignNameSchema.optional(),
  description: campaignDescriptionSchema.optional(),
  streakCadence: campaignStreakCadenceSchema.optional(),
})

// ============================================================================
// Session Schemas
// ============================================================================

const sessionNameSchema = z
  .string({ required_error: 'Session name is required' })
  .trim()
  .min(1, 'Session name cannot be empty')
  .max(255, 'Session name must be under 255 characters')

const sessionDateSchema = z
  .union([
    z.string().datetime(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Session date must be in YYYY-MM-DD format'),
  ])
  .optional()
  .nullable()

export const createSessionSchema = z.object({
  name: sessionNameSchema,
  sessionDate: sessionDateSchema,
  campaignId: z.string().uuid('Invalid campaign ID'),
})

export const updateSessionSchema = z.object({
  name: sessionNameSchema.optional(),
  sessionDate: sessionDateSchema,
})

// ============================================================================
// Notes & Content Schemas
// ============================================================================

export const markdownContentSchema = z
  .string({ required_error: 'Content is required' })
  .max(1000000, 'Content is too large (max 1MB)')
  .refine(
    (content) => !content.includes('\0'),
    'Content contains invalid null bytes'
  )

export const updateNoteSchema = z.object({
  contentMd: markdownContentSchema,
})

// ============================================================================
// Entity Tag Schemas
// ============================================================================

const tagTypeSchema = z.enum(['npc', 'location', 'item', 'pet'], {
  errorMap: () => ({ message: 'Invalid tag type' }),
})

const entityTagNameSchema = z
  .string({ required_error: 'Tag name is required' })
  .trim()
  .min(1, 'Tag name cannot be empty')
  .max(100, 'Tag name must be under 100 characters')

const entityTagDescriptionSchema = z
  .string()
  .max(500, 'Description must be under 500 characters')
  .optional()
  .nullable()

export const createEntityTagSchema = z.object({
  name: entityTagNameSchema,
  description: entityTagDescriptionSchema,
  tagType: tagTypeSchema,
  sessionId: z.string().uuid('Invalid session ID'),
})

export const updateEntityTagSchema = z.object({
  name: entityTagNameSchema.optional(),
  description: entityTagDescriptionSchema,
  tagType: tagTypeSchema.optional(),
  order_index: z.number().int().min(0).optional().nullable(),
})

// ============================================================================
// Profile Schemas
// ============================================================================

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatarUrl: z
    .string()
    .url('Invalid avatar URL')
    .max(500, 'Avatar URL is too long')
    .optional()
    .nullable(),
})

// ============================================================================
// Invite Code Schemas
// ============================================================================

const uuidSchema = z.string().uuid('Invalid ID format')

export const campaignIdSchema = uuidSchema
export const sessionIdSchema = uuidSchema
export const tagIdSchema = uuidSchema
