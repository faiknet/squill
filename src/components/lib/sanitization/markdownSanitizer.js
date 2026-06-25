import DOMPurify from 'dompurify';

/**
 * Sanitize markdown content to prevent XSS attacks
 * @param {string} htmlContent - HTML content from ReactMarkdown
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(htmlContent) {
  if (!htmlContent) return '';
  
  const options = {
    ALLOWED_TAGS: [
      // Safe formatting tags
      'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's', 'strike', 'del',
      // Lists
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      // Links and media
      'a', 'img', 'picture', 'source', 'video', 'audio',
      // Code
      'pre', 'code', 'kbd', 'samp', 'var', 'blockquote',
      // Tables
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
      'col', 'colgroup',
      // Typography
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'sub', 'sup', 'small', 'mark',
      // Quotes and definitions
      'q', 'cite', 'abbr', 'acronym', 'address', 'div', 'span',
      // Markdown-specific
      'details', 'summary'
    ],
    FORBID_TAGS: [],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
      'src', 'alt', 'width', 'height', 'class',
      'data-mention-id', 'data-mention-label',
      'cite', 'datetime', 'placeholder', 'spellcheck', 'tabindex'
    ],
    BLOCKED_URI: [
      'javascript:',
      'vbscript:',
      'data:',
      'blob:'
    ],
    FORBID_ATTR: [
      'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmousemove',
      'onmouseout', 'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeypress', 'onkeyup',
      'onfocus', 'onblur', 'onload', 'onerror', 'onscroll',
      'oncopy', 'oncut', 'onpaste', 'onsubmit', 'onreset', 'oninvalid', 'oninput'
    ],
    ADD_ATTR: ['rel', 'class']
  };

  try {
    const sanitized = DOMPurify.sanitize(htmlContent, options);
    return sanitized;
  } catch (error) {
    console.error('DOMPurify sanitization error:', error);
    // Fallback to basic HTML entity encoding if DOMPurify fails
    return escapeHtml(htmlContent);
  }
}

/**
 * Fallback HTML escaping if DOMPurify is unavailable
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize markdown content before rendering
 * @param {string} markdownContent - Raw markdown string
 * @returns {string} - Sanitized HTML
 */
export function sanitizeMarkdown(markdownContent) {
  if (!markdownContent) return '';
  
  // Strip script tags and dangerous HTML before rendering
  const cleanMarkdown = markdownContent
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<style[^>]*>.*?<\/style>/gis, '')    // Remove style tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');  // Remove iframes
  
  const html = require('react-markdown').default.render(cleanMarkdown);
  return sanitizeHtml(html);
}

/**
 * Validate markdown input for basic safety
 * @param {string} content - Markdown content
 * @returns {boolean} - Whether content is safe
 */
export function isMarkdownSafe(content) {
  if (!content) return true;
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /javascript:/i,
    /on\w+=/i,
    /<img[^>]+onerror/i,
    /<svg[^>]+onload/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(content));
}

export default { sanitizeHtml, sanitizeMarkdown, isMarkdownSafe };