import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import ResizableImage from 'tiptap-extension-resize-image'
import FontFamily from '@tiptap/extension-font-family'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { FontSize } from '../../lib/fontSizeExtension'
import { IndentExtension } from '../../lib/indentExtension'
import EditorToolbar from './GoogleDocsToolbar'

export default function LocalEditor({
  noteContent,
  setNoteContent,
  sharedMinHeight,
  collabEnabled
}) {
  const editor = useEditor({
    extensions: [
      StarterKit, 
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      ResizableImage,
      FontFamily,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      IndentExtension,
    ],
    content: noteContent,
    editorProps: {
      attributes: {
        class: 'w-full min-h-full bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 text-base focus:outline-none px-12 md:px-24 lg:px-32 xl:px-48 py-8 md:py-12 prose prose-slate dark:prose-invert max-w-none transition-colors duration-200',
      },
      handleDOMEvents: {
        click: (view, event) => {
          // Handle link clicks - only open on Ctrl/Cmd+click
          if (event.target.tagName === 'A' && event.target.href) {
            if (event.ctrlKey || event.metaKey) {
              window.open(event.target.href, '_blank')
              event.preventDefault()
              return true
            }
          }
          return false
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => setNoteContent(currentEditor.getHTML()),
  }, [])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== noteContent) {
      editor.commands.setContent(noteContent, { emitUpdate: false })
    }
  }, [editor, noteContent])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors duration-200">
      {!collabEnabled && (
        <div className="px-6 py-2 bg-amber-50 dark:bg-brand-900/30 border-b border-amber-200 dark:border-brand-900/50 text-xs text-amber-700 dark:text-brand-200/80 flex items-center gap-2 justify-center">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Offline Mode (Liveblocks not configured)
        </div>
      )}
      <EditorToolbar editor={editor} />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </div>
  )
}
