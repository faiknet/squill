import React from 'react'
// @react-pdf/renderer and react-pdf-html are loaded dynamically inside exportPdf()
// to keep them out of the initial bundle (~500KB savings)

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ODT_MIME_TYPE = 'application/vnd.oasis.opendocument.text'
const RTF_MIME_TYPE = 'application/rtf'
const TEXT_MIME_TYPE = 'text/plain;charset=utf-8'
const EXPORT_REFERENCE_BLACK_COLOR = '#000000'
const NOTE_EXPORT_RENDER_CLASS =
  'w-full min-h-full bg-white text-black text-base focus:outline-none px-12 md:px-24 lg:px-32 xl:px-48 py-8 md:py-12 prose prose-slate max-w-none transition-colors duration-200'
const MENTION_ENTITY_ICON_MAP = {
  npc: '/icons/NPCs.png',
  item: '/icons/Inventory.png',
  pet: '/icons/Pets.png',
  location: '/icons/Location.png',
}

export const SESSION_EXPORT_FORMATS = [
  {
    value: 'docx',
    label: 'Word (.docx)',
    description: 'Best for Microsoft Word and Google Docs with rich formatting.',
  },
  {
    value: 'pdf',
    label: 'PDF (.pdf)',
    description: 'Fixed-layout export for sharing and printing.',
  },
  {
    value: 'odt',
    label: 'OpenDocument (.odt)',
    description: 'Open format for LibreOffice and open standards workflows.',
  },
  {
    value: 'txt',
    label: 'Plain text (.txt)',
    description: 'Text-only export (formatting is not supported).',
  },
  {
    value: 'rtf',
    label: 'Rich Text (.rtf)',
    description: 'Widely compatible rich text format with partial styling support.',
  },
]

const INLINE_STYLE_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration',
  'color',
  'background-color',
  'text-align',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'list-style-type',
  'list-style-position',
  'white-space',
]

function sanitizeFileName(value) {
  return (value || 'session-notes')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function wrapHtmlDocument(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
</head>
<body style="color:#000">${bodyHtml}</body>
</html>`
}

function createRenderContainer(noteHtml, { forceBlackReferenceColors = false } = {}) {
  const root = document.createElement('div')
  root.style.position = 'fixed'
  root.style.top = '0'
  root.style.left = '0'
  root.style.width = '8.5in'
  root.style.background = '#ffffff'
  root.style.color = '#000000'
  root.style.opacity = '0'
  root.style.pointerEvents = 'none'
  root.style.zIndex = '-1'
  root.style.overflow = 'hidden'

  if (forceBlackReferenceColors) {
    const mentionColorOverride = document.createElement('style')
    mentionColorOverride.textContent = `span[data-mention-type]{color:${EXPORT_REFERENCE_BLACK_COLOR} !important;}`
    root.appendChild(mentionColorOverride)
  }

  const content = document.createElement('div')
  content.className = NOTE_EXPORT_RENDER_CLASS
  content.style.color = '#000000'
  content.innerHTML = noteHtml || '<p></p>'
  root.appendChild(content)
  document.body.appendChild(root)

  return { root, content }
}

function applyInlineStyles(contentRoot) {
  const elements = [contentRoot, ...contentRoot.querySelectorAll('*')]
  elements.forEach((element) => {
    if (!(element instanceof HTMLElement)) return

    const computed = window.getComputedStyle(element)
    const inlineStyle = INLINE_STYLE_PROPERTIES
      .map((property) => `${property}:${computed.getPropertyValue(property)}`)
      .join(';')

    const existingStyle = element.getAttribute('style')
    element.setAttribute('style', existingStyle ? `${existingStyle};${inlineStyle}` : inlineStyle)
  })
}

function createStyledHtml(noteHtml, options = {}) {
  const { root, content } = createRenderContainer(noteHtml, options)

  try {
    applyInlineStyles(content)
    return content.innerHTML
  } finally {
    root.remove()
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to convert image to data URL.'))
    reader.readAsDataURL(blob)
  })
}

async function toDataUrl(url) {
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) return null
    const blob = await response.blob()
    return await readBlobAsDataUrl(blob)
  } catch {
    return null
  }
}

async function inlineImageSources(content) {
  const images = Array.from(content.querySelectorAll('img'))
  await Promise.all(
    images.map(async (image) => {
      const source = image.getAttribute('src')
      if (!source || source.startsWith('data:')) return
      const dataUrl = await toDataUrl(source)
      if (dataUrl) image.setAttribute('src', dataUrl)
    })
  )
}

function flattenListElementForPdf(listElement, depth = 0) {
  const BLOCK_TAGS_FOR_LIST_TEXT = new Set([
    'address', 'article', 'aside', 'blockquote', 'caption', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset',
    'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li',
    'main', 'nav', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
  ])

  const appendInlineClone = (target, node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.textContent || ''))
      return
    }
    if (!(node instanceof HTMLElement)) return

    const tagName = node.tagName.toLowerCase()
    if (['ul', 'ol'].includes(tagName)) return

    if (BLOCK_TAGS_FOR_LIST_TEXT.has(tagName)) {
      Array.from(node.childNodes).forEach((childNode) => appendInlineClone(target, childNode))
      target.appendChild(document.createTextNode(' '))
      return
    }

    const cloned = node.cloneNode(false)
    Array.from(node.childNodes).forEach((childNode) => appendInlineClone(cloned, childNode))
    target.appendChild(cloned)
  }

  const extractInlineListContent = (listItemElement) => {
    const fragment = document.createDocumentFragment()
    Array.from(listItemElement.childNodes).forEach((childNode) => {
      appendInlineClone(fragment, childNode)
    })
    return fragment
  }

  const fragment = document.createDocumentFragment()
  const listItems = Array.from(listElement.children).filter(
    (child) => child.tagName?.toLowerCase() === 'li'
  )
  let orderedIndex = 1

  listItems.forEach((listItem) => {
    const line = document.createElement('div')
    line.style.margin = '0'
    line.style.padding = '0'
    line.style.display = 'block'

    const indent = '\u00A0'.repeat(depth * 4)
    const marker = listElement.tagName.toLowerCase() === 'ol' ? `${orderedIndex}. ` : '- '
    line.appendChild(document.createTextNode(`${indent}${marker}`))
    line.appendChild(extractInlineListContent(listItem))

    const nestedLists = []
    Array.from(listItem.childNodes).forEach((node) => {
      if (node instanceof HTMLElement && ['ul', 'ol'].includes(node.tagName.toLowerCase())) {
        nestedLists.push(node)
      }
    })

    fragment.appendChild(line)
    nestedLists.forEach((nestedList) => {
      fragment.appendChild(flattenListElementForPdf(nestedList, depth + 1))
    })

    orderedIndex += 1
  })

  return fragment
}

function normalizeListsForPdf(content) {
  const rootLists = Array.from(content.querySelectorAll('ul,ol')).filter((listElement) => {
    const parentTag = listElement.parentElement?.tagName?.toLowerCase()
    return parentTag !== 'li'
  })

  rootLists.forEach((listElement) => {
    const flattened = flattenListElementForPdf(listElement)
    listElement.replaceWith(flattened)
  })
}

function normalizePdfExportDom(content, { forceBlackReferenceColors = false } = {}) {
  const SAFE_PDF_STYLE_KEYS = new Set([
    'font-weight',
    'font-style',
    'text-decoration',
    'color',
    'background-color',
    'text-align',
    'white-space',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-radius',
    'display',
    'width',
    'height',
    'max-width',
    'max-height',
  ])
  const isSafeNumericValue = (value) => /^-?\d+(\.\d+)?(px|pt|em|rem|%)?$/.test(value)
  const isSafeColorValue = (value) => /^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|[a-z]+)$/i.test(value)
  const sanitizeStyleValue = (key, value) => {
    const trimmedValue = value.trim()
    if (!trimmedValue) return null
    if (trimmedValue === 'normal' && (key === 'line-height' || key === 'letter-spacing')) return null
    if (key.includes('color')) return isSafeColorValue(trimmedValue) ? trimmedValue : null
    if (
      key.includes('margin') ||
      key.includes('padding') ||
      key === 'font-size' ||
      key === 'border-radius' ||
      key === 'width' ||
      key === 'height' ||
      key === 'max-width' ||
      key === 'max-height'
    ) {
      return isSafeNumericValue(trimmedValue) ? trimmedValue : null
    }
    return trimmedValue
  }
  const sanitizeInlineStyle = (styleValue) => {
    const sanitizedDeclarations = styleValue
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separatorIndex = declaration.indexOf(':')
        if (separatorIndex === -1) return null
        const key = declaration.slice(0, separatorIndex).trim().toLowerCase()
        if (!SAFE_PDF_STYLE_KEYS.has(key)) return null
        const value = declaration.slice(separatorIndex + 1).trim()
        const safeValue = sanitizeStyleValue(key, value)
        if (!safeValue) return null
        return `${key}:${safeValue}`
      })
      .filter(Boolean)
    return sanitizedDeclarations.join(';')
  }

  const allElements = [content, ...Array.from(content.querySelectorAll('*'))]
  allElements.forEach((element) => {
    if (!(element instanceof HTMLElement)) return
    element.style.removeProperty('font-family')
    const inlineStyle = element.getAttribute('style') || ''
    const cleanedStyle = sanitizeInlineStyle(
      inlineStyle
        .replace(/(^|;)\s*font-family\s*:[^;]*/gi, '')
        .replace(/(^|;)\s*font-size\s*:[^;]*/gi, '')
        .replace(/(^|;)\s*line-height\s*:[^;]*/gi, '')
        .replace(/(^|;)\s*transform\s*:[^;]*/gi, '')
        .replace(/(^|;)\s*letter-spacing\s*:\s*normal/gi, '')
    )
    if (cleanedStyle) {
      element.setAttribute('style', cleanedStyle)
    } else {
      element.removeAttribute('style')
    }
  })

  const mentionElements = Array.from(content.querySelectorAll('span[data-mention-type]'))
  mentionElements.forEach((element) => {
    const mentionType = element.getAttribute('data-mention-type')
    const mentionEntityType = element.getAttribute('data-mention-entity-type')
    const mentionColor = element.getAttribute('data-mention-color')
    const computedColor = window.getComputedStyle(element).color
    const entityColorFallbacks = {
      npc: '#3b82f6',
      item: '#a16207',
      pet: '#a855f7',
      location: '#22c55e',
    }
    const mentionTypeColorFallbacks = {
      session: '#ef4444',
    }
    const fallbackColor =
      entityColorFallbacks[mentionEntityType] ||
      mentionTypeColorFallbacks[mentionType] ||
      '#1f2937'
    const resolvedColor = forceBlackReferenceColors
      ? EXPORT_REFERENCE_BLACK_COLOR
      : normalizeColorToken(mentionColor || computedColor)
        ? (mentionColor || computedColor)
        : fallbackColor

    const simplifiedMention = document.createElement('span')
    simplifiedMention.textContent = element.textContent || element.getAttribute('data-mention-label') || ''
    simplifiedMention.style.display = 'inline'
    simplifiedMention.style.whiteSpace = 'normal'
    simplifiedMention.style.padding = '0'
    simplifiedMention.style.margin = '0'
    simplifiedMention.style.borderRadius = '0'
    simplifiedMention.style.verticalAlign = 'baseline'
    simplifiedMention.style.fontWeight = '700'
    simplifiedMention.style.textDecoration = 'none'
    simplifiedMention.style.color = resolvedColor

    element.replaceWith(simplifiedMention)
  })

  const markElements = Array.from(content.querySelectorAll('mark'))
  markElements.forEach((markElement) => {
    const replacement = document.createElement('span')
    replacement.innerHTML = markElement.innerHTML
    replacement.setAttribute('style', markElement.getAttribute('style') || '')
    const computed = window.getComputedStyle(markElement)
    replacement.style.backgroundColor = computed.backgroundColor
    replacement.style.color = computed.color
    markElement.replaceWith(replacement)
  })

  const breakElements = Array.from(content.querySelectorAll('br'))
  breakElements.forEach((breakElement) => {
    const previousElementSibling = breakElement.previousElementSibling
    const previousNode = breakElement.previousSibling
    const previousWasBreak =
      previousElementSibling?.tagName?.toLowerCase() === 'br' ||
      (previousNode && previousNode.nodeType === Node.ELEMENT_NODE && previousNode.tagName?.toLowerCase() === 'br')

    if (previousWasBreak) {
      breakElement.parentNode?.insertBefore(document.createTextNode('\u00A0'), breakElement)
    }
  })
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function toBlob(binary, mimeType) {
  if (binary instanceof Blob) return binary
  if (binary instanceof ArrayBuffer) return new Blob([binary], { type: mimeType })
  if (ArrayBuffer.isView(binary)) return new Blob([binary.buffer], { type: mimeType })
  return new Blob([binary], { type: mimeType })
}

const BLOCK_LEVEL_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'caption', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li',
  'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
])

function normalizeTextWhitespace(value) {
  return value.replace(/\s+/g, ' ')
}

function htmlToPlainText(noteHtml) {
  const container = document.createElement('div')
  container.innerHTML = noteHtml || '<p></p>'

  const writeNode = (node, listStack = []) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeTextWhitespace(node.textContent || '')
    }
    if (!(node instanceof HTMLElement)) return ''

    const tagName = node.tagName.toLowerCase()

    if (tagName === 'br') return '\n'
    if (tagName === 'pre') return `${node.textContent || ''}\n`

    if (tagName === 'ul' || tagName === 'ol') {
      const nextListStack = [
        ...listStack,
        { type: tagName, counter: 0 },
      ]
      const listContent = Array.from(node.childNodes)
        .map((child) => writeNode(child, nextListStack))
        .join('')
      return `${listContent}\n`
    }

    if (tagName === 'li') {
      const currentList = listStack[listStack.length - 1]
      const depthIndent = '  '.repeat(Math.max(0, listStack.length - 1))
      let prefix = '- '

      if (currentList?.type === 'ol') {
        currentList.counter += 1
        prefix = `${currentList.counter}. `
      }

      const listItemText = Array.from(node.childNodes)
        .map((child) => writeNode(child, listStack))
        .join('')
        .trim()

      return `${depthIndent}${prefix}${listItemText}\n`
    }

    const childrenText = Array.from(node.childNodes)
      .map((child) => writeNode(child, listStack))
      .join('')

    if (BLOCK_LEVEL_TAGS.has(tagName)) {
      return `${childrenText}\n`
    }

    return childrenText
  }

  const text = Array.from(container.childNodes)
    .map((node) => writeNode(node, []))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

function exportText(noteHtml, fileBaseName) {
  const text = htmlToPlainText(noteHtml)
  const fallbackText = text.length > 0 ? text : ' '
  downloadBlob(new Blob([fallbackText], { type: TEXT_MIME_TYPE }), `${fileBaseName}.txt`)
}

async function exportDocx(htmlDocument, fileBaseName) {
  const { asBlob } = await import('html-docx-js-typescript')
  const docxOutput = await asBlob(htmlDocument, {
    orientation: 'portrait',
    margins: { top: 720, right: 720, bottom: 720, left: 720 },
  })
  downloadBlob(toBlob(docxOutput, DOCX_MIME_TYPE), `${fileBaseName}.docx`)
}

async function exportPdf(noteHtml, fileBaseName, options = {}) {
  // Dynamically import PDF renderer only when actually exporting to PDF
  // This keeps ~500KB out of the initial JS bundle
  const [{ Document, Page, StyleSheet, pdf }, { default: Html }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react-pdf-html'),
  ])

  const { root, content } = createRenderContainer(noteHtml, options)

  try {
    applyInlineStyles(content)
    normalizeListsForPdf(content)
    normalizePdfExportDom(content, options)
    await inlineImageSources(content)
    const html = content.innerHTML

    const styles = StyleSheet.create({
      page: {
        paddingTop: 36,
        paddingBottom: 36,
        paddingLeft: 36,
        paddingRight: 36,
        color: '#0f172a',
      },
      htmlRoot: {
        fontSize: 10,
        lineHeight: 1.35,
      },
    })
    const pdfHtmlStylesheet = {
      p: { marginTop: 0, marginBottom: 4, paddingTop: 0, paddingBottom: 0 },
      div: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 },
      ul: { marginTop: 0, marginBottom: 4, paddingTop: 0, paddingBottom: 0 },
      ol: { marginTop: 0, marginBottom: 4, paddingTop: 0, paddingBottom: 0 },
      li: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 },
    }

    const documentNode = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'LETTER', style: styles.page, wrap: true },
        React.createElement(Html, { collapse: true, style: styles.htmlRoot, stylesheet: pdfHtmlStylesheet }, html)
      )
    )

    const blob = await pdf(documentNode).toBlob()
    downloadBlob(blob, `${fileBaseName}.pdf`)
  } finally {
    root.remove()
  }
}

async function exportOdt(htmlDocument, fileBaseName) {
  const { htmlToOdt } = await import('odf-kit')
  const odtBytes = await htmlToOdt(htmlDocument, { pageFormat: 'letter' })
  downloadBlob(new Blob([odtBytes], { type: ODT_MIME_TYPE }), `${fileBaseName}.odt`)
}

function normalizeColorToken(value) {
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return null
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!match) return null
  const red = Number(match[1])
  const green = Number(match[2])
  const blue = Number(match[3])
  return `${red},${green},${blue}`
}

function parseColorToken(colorToken) {
  const [red, green, blue] = colorToken.split(',').map((value) => Number(value))
  return { red, green, blue }
}

function toRtfText(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, ' ')
}

function buildColorIndexMap(rootElement) {
  const colorTokenSet = new Set()
  const allElements = [rootElement, ...rootElement.querySelectorAll('*')]

  allElements.forEach((element) => {
    if (!(element instanceof HTMLElement)) return
    const styles = window.getComputedStyle(element)
    const textColor = normalizeColorToken(styles.color)
    const backgroundColor = normalizeColorToken(styles.backgroundColor)
    if (textColor) colorTokenSet.add(textColor)
    if (backgroundColor) colorTokenSet.add(backgroundColor)
  })

  const colorTokens = Array.from(colorTokenSet)
  const colorTable = colorTokens
    .map((token) => {
      const { red, green, blue } = parseColorToken(token)
      return `\\red${red}\\green${green}\\blue${blue};`
    })
    .join('')
  const colorIndexMap = new Map(colorTokens.map((token, index) => [token, index + 1]))

  return { colorIndexMap, colorTable }
}

function getElementStyleCodes(element, colorIndexMap) {
  const styles = window.getComputedStyle(element)
  const openCodes = []
  const closeCodes = []

  const fontWeight = Number(styles.fontWeight)
  if (!Number.isNaN(fontWeight) && fontWeight >= 600) {
    openCodes.push('\\b')
    closeCodes.unshift('\\b0')
  }
  if (styles.fontStyle === 'italic') {
    openCodes.push('\\i')
    closeCodes.unshift('\\i0')
  }
  if ((styles.textDecorationLine || '').includes('underline')) {
    openCodes.push('\\ul')
    closeCodes.unshift('\\ulnone')
  }

  const fontSizePx = Number.parseFloat(styles.fontSize)
  if (!Number.isNaN(fontSizePx) && fontSizePx > 0) {
    openCodes.push(`\\fs${Math.round(fontSizePx * 1.5)}`)
  }

  const textColor = normalizeColorToken(styles.color)
  if (textColor && colorIndexMap.has(textColor)) {
    openCodes.push(`\\cf${colorIndexMap.get(textColor)}`)
    closeCodes.unshift('\\cf0')
  }

  const backgroundColor = normalizeColorToken(styles.backgroundColor)
  if (backgroundColor && colorIndexMap.has(backgroundColor)) {
    openCodes.push(`\\highlight${colorIndexMap.get(backgroundColor)}`)
    closeCodes.unshift('\\highlight0')
  }

  return { openCodes, closeCodes }
}

function renderRtfNode(node, colorIndexMap, listState = null) {
  if (node.nodeType === Node.TEXT_NODE) {
    return toRtfText(node.textContent || '')
  }

  if (!(node instanceof HTMLElement)) return ''

  const tagName = node.tagName.toLowerCase()
  if (tagName === 'br') return '\\line '

  if (tagName === 'ul') {
    const items = Array.from(node.children).filter((child) => child.tagName?.toLowerCase() === 'li')
    return items
      .map((item) => `\\par\\tx720 \\'95\\tab ${renderRtfNode(item, colorIndexMap, { type: 'ul', index: 0 })}`)
      .join(' ')
  }

  if (tagName === 'ol') {
    const items = Array.from(node.children).filter((child) => child.tagName?.toLowerCase() === 'li')
    return items
      .map((item, index) => `\\par\\tx720 ${index + 1}.\\tab ${renderRtfNode(item, colorIndexMap, { type: 'ol', index })}`)
      .join(' ')
  }

  const childrenRtf = Array.from(node.childNodes)
    .map((child) => renderRtfNode(child, colorIndexMap, listState))
    .join('')

  const { openCodes, closeCodes } = getElementStyleCodes(node, colorIndexMap)
  const open = openCodes.length > 0 ? `${openCodes.join(' ')} ` : ''
  const close = closeCodes.length > 0 ? ` ${closeCodes.join(' ')}` : ''
  const content = `{${open}${childrenRtf}${close}}`

  const isBlockTag = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tagName)
  if (!isBlockTag) return content

  const alignment = window.getComputedStyle(node).textAlign
  const alignCode =
    alignment === 'center' ? '\\qc ' :
      alignment === 'right' ? '\\qr ' :
        alignment === 'justify' ? '\\qj ' : ''

  return `\\par ${alignCode}${content}`
}

function htmlFragmentToRtf(htmlFragment) {
  const container = document.createElement('div')
  container.innerHTML = htmlFragment
  const { colorIndexMap, colorTable } = buildColorIndexMap(container)
  const body = Array.from(container.childNodes)
    .map((node) => renderRtfNode(node, colorIndexMap))
    .join(' ')
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}{\\colortbl ;${colorTable}}\\viewkind4\\uc1\\pard ${body}\\par}`
}

async function exportRtf(htmlFragment, fileBaseName) {
  const rtfContent = htmlFragmentToRtf(htmlFragment)
  downloadBlob(new Blob([rtfContent], { type: RTF_MIME_TYPE }), `${fileBaseName}.rtf`)
}

export async function exportSessionNotes({
  format,
  noteContent,
  sessionName,
  keepJournalEntityFormatting = true,
}) {
  if (!format) {
    throw new Error('A file format is required to export notes.')
  }

  const forceBlackReferenceColors = !keepJournalEntityFormatting
  const fileBaseName = sanitizeFileName(sessionName)
  const styledHtml = createStyledHtml(noteContent, { forceBlackReferenceColors })
  const htmlDocument = wrapHtmlDocument(sessionName || 'Session Notes', styledHtml)

  if (format === 'txt') {
    exportText(styledHtml, fileBaseName)
    return
  }

  if (format === 'docx') {
    await exportDocx(htmlDocument, fileBaseName)
    return
  }

  if (format === 'pdf') {
    await exportPdf(noteContent, fileBaseName, { forceBlackReferenceColors })
    return
  }

  if (format === 'odt') {
    await exportOdt(htmlDocument, fileBaseName)
    return
  }

  if (format === 'rtf') {
    await exportRtf(styledHtml, fileBaseName)
    return
  }

  throw new Error(`Unsupported export format: ${format}`)
}
