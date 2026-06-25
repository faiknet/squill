import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
import LinkModal from './LinkModal'
import ImageModal from './ImageModal'

const BRAND_ICON_COLOR = '#265d5c'

// Stable module-scope button — NOT defined inside render, so React never remounts DOM nodes
const IconButton = memo(function IconButton({ onClick, isActive, label, icon, className = '' }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`h-11 md:h-7 px-3 md:px-2 rounded hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-slate-200 dark:bg-gray-600' : ''} ${className}`}
      title={label}
    >
      <span className="md:hidden flex items-center">
        <MaterialIcon icon={icon} size={22} />
      </span>
      <span className="hidden md:flex items-center">
        <MaterialIcon icon={icon} size={18} />
      </span>
    </button>
  )
})

// Material Icons component
const MaterialIcon = ({ icon, size = 20 }) => (
  <span
    style={{
      fontFamily: 'Material Icons',
      fontSize: `${size}px`,
      fontWeight: 'normal',
      fontStyle: 'normal',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      letterSpacing: 'normal',
      textTransform: 'none',
      whiteSpace: 'nowrap',
      wordWrap: 'normal',
      direction: 'ltr',
      color: BRAND_ICON_COLOR,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}
  >
    {icon}
  </span>
)

// Popular Google Fonts
const GOOGLE_FONTS = [
  { name: 'Default', value: '', family: 'system-ui' },
  { name: 'Inter', value: 'Inter', family: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto', family: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans', family: '"Open Sans", sans-serif' },
  { name: 'Lato', value: 'Lato', family: 'Lato, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat', family: 'Montserrat, sans-serif' },
  { name: 'Poppins', value: 'Poppins', family: 'Poppins, sans-serif' },
  { name: 'Source Sans Pro', value: 'Source Sans Pro', family: '"Source Sans Pro", sans-serif' },
  { name: 'Raleway', value: 'Raleway', family: 'Raleway, sans-serif' },
  { name: 'PT Sans', value: 'PT Sans', family: '"PT Sans", sans-serif' },
  { name: 'Merriweather', value: 'Merriweather', family: 'Merriweather, serif' },
  { name: 'Playfair Display', value: 'Playfair Display', family: '"Playfair Display", serif' },
  { name: 'Crimson Text', value: 'Crimson Text', family: '"Crimson Text", serif' },
  { name: 'Courier Prime', value: 'Courier Prime', family: '"Courier Prime", monospace' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono', family: '"JetBrains Mono", monospace' },
]

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72']

// Google Docs color palette
const COLOR_PALETTE = [
  // Row 1: Blacks and grays
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  // Row 2: Reds
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  // Row 3: Light colors
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  // Row 4: Medium colors
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  // Row 5: Dark colors
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  // Row 6: Darker
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
  // Row 7: Darkest
  ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
]

const HIGHLIGHT_PALETTE = [
  // Row 1: Light highlights
  ['transparent', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#0000ff'],
  // Row 2: Medium highlights
  ['#fff2cc', '#d9ead3', '#d0e0e3', '#ead1dc', '#fce5cd', '#cfe2f3', '#c9daf8'],
]

function ColorPicker({ value, onChange, colors, label, icon, showUnderline = false, align = 'left' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState('#000000')
  const pickerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const currentColor = value || (colors === COLOR_PALETTE ? '#000000' : 'transparent')

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        className="h-11 md:h-7 px-3 md:px-2 rounded hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors flex flex-col items-center justify-center gap-0.5 group flex-shrink-0"
        title={label}
      >
        <div className="text-slate-700 dark:text-gray-200 flex items-center gap-1">
          <span className="md:hidden flex items-center">
            <MaterialIcon icon={icon} size={22} />
          </span>
          <span className="hidden md:flex items-center">
            <MaterialIcon icon={icon} size={18} />
          </span>
          <svg className="w-2.5 h-2.5 opacity-60" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
        <div
          className="h-0.5 w-full rounded-full"
          style={{ backgroundColor: currentColor === 'transparent' ? '#e5e7eb' : currentColor }}
        />
      </button>

      {isOpen && (
        <div className={`absolute top-full z-50 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700 p-3 min-w-[240px] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {/* Color grid */}
          <div className="space-y-1">
            {colors.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1">
                {row.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onChange(color === 'transparent' ? null : color)
                      setIsOpen(false)
                    }}
                    className="w-5 h-5 rounded border border-slate-200 dark:border-gray-600 hover:scale-110 transition-transform relative"
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {color === 'transparent' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-0.5 bg-red-500 rotate-45" />
                      </div>
                    )}
                    {currentColor === color && (
                      <div className="absolute inset-0 border-2 border-blue-500 rounded" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}

export default memo(function GoogleDocsToolbar({ editor, isSidebarCollapsed = false, onExpandSidebar }) {
  // Track only the active-mark state that buttons actually depend on.
  // This prevents re-rendering on every cursor move when no marks changed.
  const [activeMarks, setActiveMarks] = useState(null)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  const getActiveMarks = useCallback((ed) => ({
    bold: ed.isActive('bold'),
    italic: ed.isActive('italic'),
    underline: ed.isActive('underline'),
    link: ed.isActive('link'),
    bulletList: ed.isActive('bulletList'),
    orderedList: ed.isActive('orderedList'),
    alignLeft: ed.isActive({ textAlign: 'left' }),
    alignCenter: ed.isActive({ textAlign: 'center' }),
    alignRight: ed.isActive({ textAlign: 'right' }),
    alignJustify: ed.isActive({ textAlign: 'justify' }),
    fontSize: ed.getAttributes('textStyle').fontSize,
    textColor: ed.getAttributes('textStyle').color,
    highlightColor: ed.getAttributes('highlight').color,
  }), [])

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      const next = getActiveMarks(editor)
      setActiveMarks(prev => {
        // Shallow compare — only re-render if something actually changed
        if (prev && Object.keys(next).every(k => prev[k] === next[k])) return prev
        return next
      })
    }

    // Seed initial state
    handleUpdate()

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor, getActiveMarks])

  // Link modal handlers
  const handleLinkInsert = useCallback((url) => {
    if (!editor) return
    if (url === null) {
      editor.chain().focus().unsetLink().run()
    } else if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  // Image modal handlers
  const handleImageInsert = useCallback((src) => {
    if (!editor) return
    if (src) {
      editor.chain().focus().setImage({ src }).run()
    }
  }, [editor])

  if (!editor || !activeMarks) return null

  // Derive font size from active marks
  const fontSizeAttr = activeMarks.fontSize
  let fontSize = 16 // default

  if (fontSizeAttr) {
    const parsed = parseInt(fontSizeAttr)
    if (!isNaN(parsed) && parsed >= 8 && parsed <= 72) {
      fontSize = parsed
    }
  }


  return (
    <>
      <LinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onInsert={handleLinkInsert}
        currentUrl={activeMarks.link ? editor.getAttributes('link').href : ''}
      />

      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onInsert={handleImageInsert}
      />

      <div className="px-3 py-2 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 flex flex-nowrap md:flex-wrap gap-1 items-center overflow-x-auto whitespace-nowrap scrollbar-none transition-colors duration-200 sticky top-0 z-10">
        {/* Font Size */}
        <div className="flex items-center flex-shrink-0">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              // Get current fontSize from selection or default
              const current = editor.getAttributes('textStyle').fontSize
              const currentSize = current ? parseInt(current) : 16

              // Find the next smaller size in the FONT_SIZES array
              const currentIndex = FONT_SIZES.findIndex(size => parseInt(size) >= currentSize)
              const newIndex = Math.max(0, currentIndex - 1)
              const newSize = FONT_SIZES[newIndex]

              editor.chain().focus().setFontSize(`${newSize}px`).run()
            }}
            className="h-11 w-8 md:h-7 md:w-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-gray-700 rounded-l text-slate-600 dark:text-gray-300"
            title="Decrease font size"
          >
            <svg className="w-4 h-4 md:w-3 md:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <select
            value={fontSize}
            onChange={(e) => editor.chain().focus().setFontSize(`${e.target.value}px`).run()}
            className="h-11 w-14 md:h-7 md:w-12 text-sm bg-transparent border border-slate-200 dark:border-gray-700 rounded-[8px]  text-center text-slate-700 dark:text-gray-200 focus:outline-none cursor-pointer appearance-none"
          >
            {FONT_SIZES.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              // Get current fontSize from selection or default
              const current = editor.getAttributes('textStyle').fontSize
              const currentSize = current ? parseInt(current) : 16

              // Find the next larger size in the FONT_SIZES array
              const currentIndex = FONT_SIZES.findIndex(size => parseInt(size) > currentSize)
              const newIndex = currentIndex === -1 ? FONT_SIZES.length - 1 : currentIndex
              const newSize = FONT_SIZES[newIndex]

              editor.chain().focus().setFontSize(`${newSize}px`).run()
            }}
            className="h-11 w-8 md:h-7 md:w-6 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-gray-700 rounded-r text-slate-600 dark:text-gray-300"
            title="Increase font size"
          >
            <svg className="w-4 h-4 md:w-3 md:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 flex-shrink-0" />

        {/* Text Formatting */}
        <IconButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={activeMarks.bold}
          label="Bold (Ctrl+B)"
          icon="format_bold"
        />
        <IconButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={activeMarks.italic}
          label="Italic (Ctrl+I)"
          icon="format_italic"
        />
        <IconButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={activeMarks.underline}
          label="Underline (Ctrl+U)"
          icon="format_underlined"
        />

        {/* Text Color */}
        <ColorPicker
          value={activeMarks.textColor}
          onChange={(color) => color ? editor.chain().focus().setColor(color).run() : editor.chain().focus().unsetColor().run()}
          colors={COLOR_PALETTE}
          label="Text color"
          icon="format_color_text"
        />

        {/* Highlight */}
        <ColorPicker
          value={activeMarks.highlightColor}
          onChange={(color) => color ? editor.chain().focus().toggleHighlight({ color }).run() : editor.chain().focus().unsetHighlight().run()}
          colors={HIGHLIGHT_PALETTE}
          label="Highlight color"
          icon="highlight"
          align="right"
        />

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 flex-shrink-0" />

        {/* Link */}
        <IconButton
          onClick={() => setIsLinkModalOpen(true)}
          isActive={activeMarks.link}
          label="Insert link (Ctrl+K)"
          icon="add_link"
        />

        {/* Image */}
        <IconButton
          onClick={() => setIsImageModalOpen(true)}
          label="Insert image"
          icon="image"
        />

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 flex-shrink-0" />

        {/* Alignment */}
        <IconButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={activeMarks.alignLeft}
          label="Align left (Ctrl+Shift+L)"
          icon="format_align_left"
        />
        <IconButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={activeMarks.alignCenter}
          label="Align center (Ctrl+Shift+E)"
          icon="format_align_center"
        />
        <IconButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={activeMarks.alignRight}
          label="Align right (Ctrl+Shift+R)"
          icon="format_align_right"
        />
        <IconButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={activeMarks.alignJustify}
          label="Justify"
          icon="format_align_justify"
        />

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 flex-shrink-0" />

        {/* Lists */}
        <IconButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={activeMarks.bulletList}
          label="Bullet list (Ctrl+Shift+8)"
          icon="format_list_bulleted"
        />
        <IconButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={activeMarks.orderedList}
          label="Numbered list (Ctrl+Shift+7)"
          icon="format_list_numbered"
        />

        <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 flex-shrink-0" />

        {/* Clear Formatting */}
        <IconButton
          onClick={() => {
            const { state } = editor
            const { from, to } = state.selection

            // Get all mark types except 'mention'
            const markTypes = Object.keys(state.schema.marks)
              .filter(markName => markName !== 'mention')
              .map(markName => state.schema.marks[markName])

            // Clear nodes and unset all marks except mentions
            editor.chain()
              .focus()
              .clearNodes()
              .command(({ tr, dispatch }) => {
                if (dispatch) {
                  markTypes.forEach(markType => {
                    tr.removeMark(from, to, markType)
                  })
                }
                return true
              })
              .run()
          }}
          label="Clear formatting (Ctrl+\\)"
          icon="format_clear"
        />

        {isSidebarCollapsed && (
          <div className="ml-auto flex-shrink-0">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onExpandSidebar?.()
              }}
              className="h-11 md:h-7 px-3 md:px-2 rounded hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
              style={{ color: BRAND_ICON_COLOR }}
              title="Expand member sidebar"
            >
              <img src="/icons/expandcontent.svg" alt="" className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </div>
    </>
  )
})
