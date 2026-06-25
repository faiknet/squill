/**
 * SafeMarkdown Component
 * Renders markdown content with XSS protection
 */

import { useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkStripTrailingSpaces } from 'remark-strip-trailing-spaces'
import { sanitizeHtml } from '../lib/sanitization/markdownSanitizer'
import './SafeMarkdown.css'

/**
 * Virtualized SafeMarkdown component for rendering long documents
 * @param {Object} props - Component props
 * @param {string} props.content - Markdown content to render
 * @param {number} props.height - Container height in pixels
 * @returns {JSX.Element} - Virtualized markdown render
 */
export function VirtualizedSafeMarkdown({ content, height }) {
  const rowVirtualizer = useVirtualizer({
    count: 1,
    getScrollElement: () => document.body,
    estimateSize: () => content ? 500 : 0, // Estimate based on content presence
    overscan: 1,
  })

  const sanitizedContent = useMemo(() => {
    if (!content) return ''
    // Sanitize the rendered HTML from ReactMarkdown
    const htmlContent = ReactMarkdown.render(children, {
      remarkPlugins: [remarkGfm, remarkStripTrailingSpaces],
    })
    return sanitizeHtml(htmlContent)
  }, [content])

  return (
    <div
      className="safe-markdown-container"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      <div
        className="safe-markdown-content"
        style={{
          height: `${height}px`,
          transform: `translateY(${rowVirtualizer.start}px)`,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
      </div>
    </div>
  )
}

/**
 * Standard SafeMarkdown component for inline or short content
 * @param {Object} props - Component props
 * @param {string} props.children - Markdown content to render
 * @param {boolean} props.escape - Whether to escape markdown syntax
 * @returns {JSX.Element} - Sanitized markdown render
 */
export function SafeMarkdown({ children, escape = false }) {
  const ReactMarkdown = useMemo(() => window.ReactMarkdown, [])
  
  return (
    <div className="safe-markdown-wrapper">
      <ReactMarkdown
        children={children}
        escapeMarkdown={!escape}
        remarkPlugins={[remarkGfm, remarkStripTrailingSpaces]}
      />
    </div>
  )
}

export default SafeMarkdown
