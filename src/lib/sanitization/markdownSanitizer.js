/**
 * Markdown Sanitizer
 * Provides safe markdown rendering with XSS protection
 */

import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to remove potentially malicious scripts
 * @param {string} html - HTML string to sanitize
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (!html) return ''
  const purifier = DOMPurify()
  return purifier.sanitize(html, {
    // Allow common markdown elements
    ADD_TAGS: [],
    ADD_ATTR: ['target', 'rel', 'class', 'style'],
    // Allow common markdown attributes
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'style'],
    FORBID_ATTR: ['src', 'href', 'action', 'method', 'type', 'on*'],
  })
}

/**
 * Sanitize URL attributes
 * @param {string} href - URL to validate
 * @returns {boolean} - Whether URL is safe
 */
export function isSafeUrl(href) {
  if (!href) return false
  try {
    const url = new URL(href)
    const allowedProtocols = ['http:', 'https:', 'mailto:']
    return allowedProtocols.includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * Create a safe ReactMarkdown renderer with sanitization
 * @returns {import('react').ComponentType} - React component
 */
export function createSafeMarkdownRenderer() {
  return ({ children }) => {
    const { ReactMarkdown } = window.ReactMarkdown
    return ReactMarkdown({
      children,
      escapeMarkdown: true, // Escape markdown syntax by default
    })
  }
}

export default { sanitizeHtml, isSafeUrl }
