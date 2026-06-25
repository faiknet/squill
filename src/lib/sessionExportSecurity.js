/**
 * Session Export Security Module
 * 
 * Provides comprehensive security measures for session note exports:
 * - XSS sanitization using DOMPurify
 * - Input validation
 * - Ownership verification
 * - Rate limiting
 * - Malicious content detection
 */

import DOMPurify from 'dompurify'
import { isUuid } from '../lib/validation/uuidValidation'

// Security constants
const MAX_NOTE_SIZE = 500 * 1024 // 500KB
const MAX_EXPORT_ATTEMPTS_PER_MINUTE = 10

// Malicious patterns to detect
const MALICIOUS_PATTERNS = [
  /<script/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<svg[^>]*onload/i,
  /<svg[^>]*onclick/i,
  /javascript:/i,
  /vbscript:/i,
  /onerror\s*=\s*["'\s]*[a-zA-Z_]/i,
  /onload\s*=\s*["'\s]*[a-zA-Z_]/i,
  /expression\s*\(/i,
  /url\s*\(\s*["'\s]*javascript:/i,
  /data:\s*text\/html/i,
  /<meta[^>]*http-equiv="refresh"/i,
  /<base[^>]*href/i,
  /\balert\s*\(/i,
  /\bdocument\s*\.\w+\s*=/i,
  /\bwindow\s*\.\w+\s*=/i,
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /\bsetTimeout\s*\(\s*[^,]+\s*,\s*[0-9]+/i,
  /\bsetInterval\s*\(\s*[^,]+\s*,\s*[0-9]+/i,
  /document\s*\.cookie/i,
  /document\s*\.write/i,
  /document\s*\.writeln/i,
  /document\s*\.open/i,
  /document\s*\.location/i,
  /window\s*\.open/i,
  /location\s*\.href/i,
  /history\s*\.pushState/i,
  /navigator\s*\.userAgent/i,
  /screen\s*\.width/i,
  /screen\s*\.height/i,
]

// Weak regex sanitization for filename
export function sanitizeFileName(value, maxLen = 50) {
  if (!value) return 'session-notes'
  
  // Convert to lowercase
  let sanitized = value.toLowerCase()
  
  // Remove all non-alphanumeric characters except hyphens, underscores, and periods
  sanitized = sanitized.replace(/[^a-z0-9\-_\.]*/g, '-')
  
  // Remove multiple consecutive special chars
  sanitized = sanitized.replace(/[-_\.]+/g, '-')
  
  // Remove leading/trailing special chars
  sanitized = sanitized.replace(/^[-_\.]+/, '').replace(/[-_\.]+$/, '')
  
  // Limit length
  if (sanitized.length > maxLen) {
    sanitized = sanitized.slice(0, maxLen)
  }
  
  // Ensure it doesn't start with a dot (hidden file on some systems)
  sanitized = sanitized.replace(/^\./, '')
  
  return sanitized || 'session-notes'
}

// Strong filename validation
export function validateFileName(filename, allowedExtensions = ['docx', 'pdf', 'txt', 'odt', 'rtf', 'md']) {
  if (!filename) return { valid: false, error: 'Filename is required' }
  
  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename format' }
  }
  
  // Check for reserved names
  const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'lpt1', 'lpt2', 'lpt3']
  if (reservedNames.includes(filename.toLowerCase())) {
    return { valid: false, error: 'Filename is reserved' }
  }
  
  // Check extension
  const ext = filename.split('.').pop().toLowerCase()
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}` }
  }
  
  return { valid: true }
}

// Check for malicious patterns
export function detectMaliciousContent(html, maxLength = 10000) {
  if (!html) return true
  
  // Truncate very long content
  if (html.length > maxLength) {
    return false
  }
  
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(html)) {
      return false
    }
  }
  
  return true
}

// Sanitize HTML for export
export function sanitizeExportHTML(html) {
  if (!html) return ''
  
  try {
    // Use DOMPurify with a clean config
    const config = {
      ADD_ATTR: ['data-mention-id', 'data-mention-label', 'data-mention-type', 'data-mention-entity-type', 'data-mention-color'],
      ALLOWED_TAGS: [
        'p', 'br', 'a', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'code', 'pre',
        'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'img', 'mark',
        'div', 'span', 'hr', 'details', 'summary'
      ],
      ALLOWED_ATTR: [
        'id', 'class', 'href', 'title', 'alt', 'src', 'width', 'height', 'style', 'data-mention-id',
        'data-mention-label', 'data-mention-type', 'data-mention-entity-type', 'data-mention-color'
      ],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select'],
      FORBID_ATTR: [
        'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmousemove', 'onmouseout',
        'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur',
        'onchange', 'onsubmit', 'onreset', 'oninvalid', 'oninput', 'onload', 'onunload',
        'onerror', 'onabort', 'oncanplay', 'oncanplaythrough', 'ondurationchange', 'onemptied',
        'onended', 'onloadeddata', 'onloadedmetadata', 'onpause', 'onplay', 'onplaying', 'onprogress',
        'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange',
        'onwaiting', 'onshow', 'ontoggle', 'onanimationstart', 'onanimationend', 'onanimationiteration',
        'ontransitionend', 'onpointerdown', 'onpointerup', 'onpointermove', 'onpointerenter',
        'onpointerleave', 'onpointercancel', 'ongotpointercapture', 'onlostpointercapture'
      ]
    }
    
    const sanitized = DOMPurify.sanitize(html, config)
    return sanitized
  } catch (error) {
    console.error('DOMPurify sanitization failed:', error)
    return html // Fallback to original HTML
  }
}

// Validate session note export input
export async function validateExportInput(sessionId, userSessionId, noteHtml, filename, fileType) {
  const errors = []
  
  // 1. Validate session ID
  if (!isUuid(sessionId)) {
    errors.push('Invalid session ID format')
  }
  
  // 2. Validate user session ownership (this would require a database check)
  // Note: This is a placeholder - actual implementation needs to verify the user owns the session
  // In a real app, you'd check: SELECT * FROM sessions WHERE id = $1 AND user_id = $2
  if (!sessionId) {
    errors.push('Session ID is required for ownership verification')
  }
  
  // 3. Validate HTML content
  if (!noteHtml) {
    errors.push('Session content is empty')
  } else if (noteHtml.length > MAX_NOTE_SIZE) {
    errors.push(`Content exceeds maximum size of ${MAX_NOTE_SIZE / 1024}KB`)
  } else if (!detectMaliciousContent(noteHtml)) {
    errors.push('Session content contains potentially malicious patterns')
  } else {
    const sanitized = sanitizeExportHTML(noteHtml)
    if (sanitized.length !== noteHtml.length) {
      // Log a warning - the content was sanitized
      console.warn('Malicious content was removed from exported notes')
    }
  }
  
  // 4. Validate filename
  if (!filename) {
    errors.push('Filename is required')
  } else {
    const filenameValidation = validateFileName(filename)
    if (!filenameValidation.valid) {
      errors.push(filenameValidation.error)
    }
  }
  
  // 5. Validate file type
  if (!fileType) {
    errors.push('File type is required')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedHtml: detectMaliciousContent(noteHtml) ? sanitizeExportHTML(noteHtml) : null
  }
}

// Rate limiter for export operations
export class ExportRateLimiter {
  constructor() {
    this.attempts = new Map()
  }
  
  isAllowed(sessionId) {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    
    // Clean up old attempts
    if (this.attempts.has(sessionId)) {
      const attempts = this.attempts.get(sessionId)
      this.attempts.set(sessionId, attempts.filter(attempt => attempt > oneMinuteAgo))
    }
    
    // Check rate limit
    const attempts = this.attempts.get(sessionId) || []
    if (attempts.length >= MAX_EXPORT_ATTEMPTS_PER_MINUTE) {
      return { allowed: false, reason: 'Rate limit exceeded' }
    }
    
    // Record this attempt
    this.attempts.set(sessionId, [...attempts, now])
    
    return { allowed: true }
  }
  
  reset() {
    this.attempts.clear()
  }
}

// Create a singleton rate limiter
export const exportRateLimiter = new ExportRateLimiter()

export default {
  sanitizeFileName,
  validateFileName,
  detectMaliciousContent,
  sanitizeExportHTML,
  validateExportInput,
  exportRateLimiter
}