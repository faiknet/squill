import React, { useState } from 'react'
import BoldIcon from '../../assets/icons/Bold.png'
import ItalicsIcon from '../../assets/icons/Italics.png'
import ListIcon from '../../assets/icons/List.png'
import NumListIcon from '../../assets/icons/NumList.png'

const BRAND_ICON_COLOR = '#265d5c'

const FONTS = [
  { name: 'Default', value: '' },
  { name: 'Serif', value: 'serif' },
  { name: 'Monospace', value: 'monospace' },
  { name: 'Cursive', value: 'cursive' },
]

const FONT_SIZES = [
  { name: 'Small', value: '12px' },
  { name: 'Normal', value: '16px' },
  { name: 'Large', value: '20px' },
  { name: 'Huge', value: '24px' },
]

const COLORS = [
  '#000000', '#4b5563', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'
]

const HIGHLIGHTS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fecaca', '#e5e7eb'
]

export default function EditorToolbar({ editor }) {
  if (!editor) return null

  const IconButton = ({ onClick, isActive, label, iconSrc, svg, className = '' }) => {
    const handleMouseDown = (e) => {
      e.preventDefault() // Prevent focus loss
      onClick()
    }

    return (
      <button
        type="button"
        onMouseDown={handleMouseDown}
        className={`p-2 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-center ${
          isActive
            ? 'bg-slate-100 dark:bg-gray-700 opacity-100'
            : 'opacity-70 hover:opacity-100'
        } ${className}`}
        title={label}
        aria-label={label}
        >
        {iconSrc ? (
          <span
            aria-hidden="true"
            className={`inline-block w-4 h-4 md:w-5 md:h-5 ${isActive ? 'scale-110' : ''} transition-transform pointer-events-none`}
            style={{
              backgroundColor: BRAND_ICON_COLOR,
              WebkitMaskImage: `url(${iconSrc})`,
              maskImage: `url(${iconSrc})`,
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />
        ) : (
          <span className="text-slate-700 dark:text-gray-200 pointer-events-none" style={{ color: BRAND_ICON_COLOR }}>{svg}</span>
        )}
      </button>
    )
  }

  const Dropdown = ({ options, value, onChange, label, width = 'w-24' }) => {
    return (
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          editor.commands.focus()
        }}
        className={`h-8 md:h-9 ${width} text-xs md:text-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded px-2 text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-gray-600 cursor-pointer`}
        aria-label={label}
        title={label}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.name}</option>
        ))}
      </select>
    )
  }

  const ColorPicker = ({ value, onChange, options, icon, label }) => {
    const [isOpen, setIsOpen] = useState(false)
    
    return (
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsOpen(!isOpen)
          }}
          className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 opacity-70 hover:opacity-100"
          title={label}
        >
          <span className="text-slate-700 dark:text-gray-200">{icon}</span>
          <div 
            className="w-3 h-3 rounded-full border border-slate-200 dark:border-gray-600" 
            style={{ backgroundColor: value || 'transparent' }}
          />
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 z-50 mt-1 p-2 bg-white dark:bg-gray-800 rounded shadow-lg border border-slate-200 dark:border-gray-700 grid grid-cols-4 gap-1 w-32">
              <button
                type="button"
                onMouseDown={(e) => {
                   e.preventDefault()
                   onChange(null)
                   setIsOpen(false)
                }}
                className="col-span-4 text-xs text-center py-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded mb-1 text-slate-500 dark:text-gray-400"
              >
                Reset
              </button>
              {options.map(color => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(color)
                    setIsOpen(false)
                  }}
                  className="w-6 h-6 rounded-full border border-slate-200 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="px-2 md:px-5 py-2 md:py-3 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 flex gap-1 md:gap-2 flex-wrap items-center transition-colors duration-200 sticky top-0 z-10">
      {/* Font Family */}
      <Dropdown 
        options={FONTS}
        value={editor.getAttributes('textStyle').fontFamily || ''} 
        onChange={(val) => val ? editor.chain().focus().setFontFamily(val).run() : editor.chain().focus().unsetFontFamily().run()}
        label="Font Family"
        width="w-20 md:w-24"
      />

      {/* Font Size */}
      <Dropdown 
        options={FONT_SIZES}
        value={editor.getAttributes('textStyle').fontSize || '16px'} 
        onChange={(val) => editor.chain().focus().setFontSize(val).run()}
        label="Font Size"
        width="w-16 md:w-20"
      />

      <span className="w-px h-5 bg-slate-200 dark:bg-gray-700 mx-0.5 md:mx-1" />

      {/* Text Style Group */}
      <div className="flex bg-slate-50 dark:bg-gray-900/50 rounded-md p-0.5 gap-0.5">
        <IconButton 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          isActive={editor.isActive('bold')} 
          label="Bold"
          iconSrc={BoldIcon}
        />
        <IconButton 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          isActive={editor.isActive('italic')} 
          label="Italic"
          iconSrc={ItalicsIcon}
        />
        <IconButton 
          onClick={() => editor.chain().focus().toggleUnderline().run()} 
          isActive={editor.isActive('underline')} 
          label="Underline"
          svg={
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 21h12" />
            </svg>
          }
        />
      </div>

      {/* Colors */}
      <div className="flex bg-slate-50 dark:bg-gray-900/50 rounded-md p-0.5 gap-0.5">
        <ColorPicker 
          value={editor.getAttributes('textStyle').color}
          onChange={(color) => color ? editor.chain().focus().setColor(color).run() : editor.chain().focus().unsetColor().run()}
          options={COLORS}
          label="Text Color"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10M12 3v18M5 9l2-2 2 2M19 9l-2-2-2 2" />
            </svg>
          }
        />
        <ColorPicker 
          value={editor.getAttributes('highlight').color}
          onChange={(color) => color ? editor.chain().focus().toggleHighlight({ color }).run() : editor.chain().focus().unsetHighlight().run()}
          options={HIGHLIGHTS}
          label="Highlight"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          }
        />
      </div>

      <span className="w-px h-5 bg-slate-200 dark:bg-gray-700 mx-0.5 md:mx-1 hidden md:block" />

      {/* Alignment */}
      <div className="flex bg-slate-50 dark:bg-gray-900/50 rounded-md p-0.5 gap-0.5 hidden md:flex">
        <IconButton 
          onClick={() => editor.chain().focus().setTextAlign('left').run()} 
          isActive={editor.isActive({ textAlign: 'left' })} 
          label="Align Left"
          svg={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
            </svg>
          }
        />
        <IconButton 
          onClick={() => editor.chain().focus().setTextAlign('center').run()} 
          isActive={editor.isActive({ textAlign: 'center' })} 
          label="Align Center"
          svg={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M7 18h10" />
            </svg>
          }
        />
        <IconButton 
          onClick={() => editor.chain().focus().setTextAlign('right').run()} 
          isActive={editor.isActive({ textAlign: 'right' })} 
          label="Align Right"
          svg={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M13 18h7" />
            </svg>
          }
        />
      </div>

      <span className="w-px h-5 bg-slate-200 dark:bg-gray-700 mx-0.5 md:mx-1 hidden md:block" />

      {/* Lists & Media */}
      <div className="flex bg-slate-50 dark:bg-gray-900/50 rounded-md p-0.5 gap-0.5 hidden lg:flex">
        <IconButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          isActive={editor.isActive('bulletList')} 
          label="Bullet List"
          iconSrc={ListIcon}
        />
        <IconButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          isActive={editor.isActive('orderedList')} 
          label="Numbered List"
          iconSrc={NumListIcon}
        />
        <IconButton 
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }} 
          isActive={editor.isActive('link')} 
          label="Link"
          svg={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          }
        />
      </div>
    </div>
  )
}
