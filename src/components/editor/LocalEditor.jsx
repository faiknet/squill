import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { useParams } from 'react-router-dom'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import ResizableImage from 'tiptap-extension-resize-image'
import FontFamily from '@tiptap/extension-font-family'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { getMarkRange } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { colorFromString } from '../../lib/liveblocks'
import { MentionMark } from '../../lib/mentionMark'
import { FontSize } from '../../lib/fontSizeExtension'
import { IndentExtension } from '../../lib/indentExtension'
import EditorToolbar from './GoogleDocsToolbar'
import MentionDropdown from './MentionDropdown'
import JournalEntryMentionModal from './JournalEntryMentionModal'
import SessionMentionModal from './SessionMentionModal'

export default function LocalEditor({
  noteContent,
  setNoteContent,
  sharedMinHeight,
  collabEnabled,
  campaignMembers = [],
  journalEntities = [],
  sessionNotes = [],
  currentUserId,
  userLabel = 'Guest',
  userColor,
  isSidebarCollapsed = false,
  onExpandSidebar,
}) {
  const [mentionState, setMentionState] = useState({ active: false, query: '', position: null })
  const mentionStateRef = useRef(mentionState)
  const mentionDropdownRef = useRef(null)
  const [selectedJournalEntry, setSelectedJournalEntry] = useState(null)
  const [selectedJournalEntryAnchor, setSelectedJournalEntryAnchor] = useState(null)
  const [selectedSessionMention, setSelectedSessionMention] = useState(null)
  const [selectedSessionMentionAnchor, setSelectedSessionMentionAnchor] = useState(null)
  const { campaignSlug } = useParams()
  // Debounce timer ref for setNoteContent — prevents serializing HTML on every keystroke
  const noteContentDebounceRef = useRef(null)
  // Track whether the editor has been initially seeded with content
  const isFirstLoadRef = useRef(true)

  useEffect(() => {
    mentionStateRef.current = mentionState
  }, [mentionState])

  const openJournalEntryModal = (mentionAttrs, anchorRect = null) => {
    const entity = journalEntities.find((item) => String(item.id) === String(mentionAttrs.mentionId))
    if (entity) {
      setSelectedJournalEntry(entity)
      setSelectedJournalEntryAnchor(anchorRect)
      return
    }

    setSelectedJournalEntry({
      id: mentionAttrs.mentionId,
      label: mentionAttrs.mentionLabel,
      tag_type: mentionAttrs.mentionEntityType,
      created_at: null,
    })
    setSelectedJournalEntryAnchor(anchorRect)
  }

  const closeJournalEntryModal = () => {
    setSelectedJournalEntry(null)
    setSelectedJournalEntryAnchor(null)
  }

  const openSessionMentionModal = (mentionAttrs, anchorRect = null) => {
    const session = sessionNotes.find((item) => String(item.id) === String(mentionAttrs.mentionId))
    if (session) {
      setSelectedSessionMention(session)
      setSelectedSessionMentionAnchor(anchorRect)
      return
    }

    setSelectedSessionMention({
      id: mentionAttrs.mentionId,
      name: mentionAttrs.mentionLabel,
      label: mentionAttrs.mentionLabel,
      slug: null,
      session_date: null,
      created_at: null,
    })
    setSelectedSessionMentionAnchor(anchorRect)
  }

  const closeSessionMentionModal = () => {
    setSelectedSessionMention(null)
    setSelectedSessionMentionAnchor(null)
  }

  const getMentionAttrsFromEventTarget = (eventTarget) => {
    const sourceElement = eventTarget?.nodeType === Node.TEXT_NODE
      ? eventTarget.parentElement
      : eventTarget
    const mentionElement = sourceElement?.closest?.('[data-mention-id]')
    if (!mentionElement) return null

    return {
      mentionType: mentionElement.getAttribute('data-mention-type') || '',
      mentionEntityType: mentionElement.getAttribute('data-mention-entity-type') || '',
      mentionId: mentionElement.getAttribute('data-mention-id') || '',
      mentionLabel: mentionElement.getAttribute('data-mention-label') || mentionElement.textContent || '',
      anchorRect: mentionElement.getBoundingClientRect(),
    }
  }

  const userColorMap = useMemo(() => {
    const styleMap = new Map()

    campaignMembers.forEach(member => {
      const color = member.color || colorFromString(member.display_name)
      styleMap.set(member.user_id, color)
    })

    if (currentUserId) {
      styleMap.set(currentUserId, userColor || colorFromString(userLabel))
    }

    return styleMap
  }, [campaignMembers, currentUserId, userColor, userLabel])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      ResizableImage,
      MentionMark,
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
      handleClick: (view, pos, event) => {
        const { schema, doc, tr } = view.state
        const resolvedPos = doc.resolve(pos)

        const clickedMentionAttrs = getMentionAttrsFromEventTarget(event.target)
        if (
          clickedMentionAttrs &&
          (
            clickedMentionAttrs.mentionType === 'entity' ||
            (clickedMentionAttrs.mentionEntityType && clickedMentionAttrs.mentionId)
          )
        ) {
          closeSessionMentionModal()
          openJournalEntryModal(clickedMentionAttrs, clickedMentionAttrs.anchorRect)
          return true
        }

        if (clickedMentionAttrs?.mentionType === 'session' && clickedMentionAttrs.mentionId) {
          closeJournalEntryModal()
          openSessionMentionModal(clickedMentionAttrs, clickedMentionAttrs.anchorRect)
          return true
        }

        const range = getMarkRange(resolvedPos, schema.marks.mention)

        if (!range) return false

        const mentionMark = resolvedPos.marks().find((mark) => mark.type.name === 'mention')
        if (!mentionMark) return false

        if (mentionMark.attrs.mentionType === 'entity') {
          closeSessionMentionModal()
          const coords = view.coordsAtPos(range.from)
          openJournalEntryModal(mentionMark.attrs, {
            top: coords.top,
            left: coords.left,
            bottom: coords.bottom,
            right: coords.left,
          })
          return true
        }

        if (mentionMark.attrs.mentionType === 'session' && mentionMark.attrs.mentionId) {
          closeJournalEntryModal()
          const coords = view.coordsAtPos(range.from)
          openSessionMentionModal(mentionMark.attrs, {
            top: coords.top,
            left: coords.left,
            bottom: coords.bottom,
            right: coords.left,
          })
          return true
        }

        const selection = TextSelection.create(doc, range.from, range.to)
        view.dispatch(tr.setSelection(selection))
        return true
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
        keydown: (view, event) => {
          if (selectedJournalEntry) {
            closeJournalEntryModal()
          }
          if (selectedSessionMention) {
            closeSessionMentionModal()
          }

          if (mentionStateRef.current.active) {
            if (event.key === 'Escape') {
              setMentionState({ active: false, query: '', position: null })
              return true
            }
            if (event.key === 'Tab') {
              event.preventDefault()
              if (mentionDropdownRef.current) {
                mentionDropdownRef.current.selectFirst()
                return true
              }
            }
          }
          return false
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      // Debounce HTML serialization: only call setNoteContent after 100ms of inactivity
      // so rapid keystrokes don't serialize on every single character
      clearTimeout(noteContentDebounceRef.current)
      noteContentDebounceRef.current = setTimeout(() => {
        setNoteContent(currentEditor.getHTML())
      }, 100)

      const { from } = currentEditor.state.selection
      const text = currentEditor.state.doc.textBetween(Math.max(0, from - 50), from)
      const match = text.match(/@([\w]*)$/)

      if (match) {
        setMentionState({
          active: true,
          query: match[1],
          position: from,
        })
      } else {
        setMentionState({ active: false, query: '', position: null })
      }
    },
  }, [])

  useEffect(() => {
    if (!editor) return
    // Only sync external content changes on first load (initial mount).
    // After that, the editor is the source of truth — the onUpdate debounce
    // propagates changes outward, not inward.
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false
      const current = editor.getHTML()
      if (current !== noteContent) {
        editor.commands.setContent(noteContent, { emitUpdate: false })
      }
    }
  }, [editor, noteContent])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors duration-200">
      {!collabEnabled && (
        <div className="px-6 py-2 bg-amber-50 dark:bg-brand-900/30 border-b border-amber-200 dark:border-brand-900/50 text-xs text-amber-700 dark:text-brand-200/80 flex items-center gap-2 justify-center">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Offline Guest Mode - Changes will be lost when you close this tab or sign out.
        </div>
      )}
      <EditorToolbar
        editor={editor}
        isSidebarCollapsed={isSidebarCollapsed}
        onExpandSidebar={onExpandSidebar}
      />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>
        {mentionState.active && mentionState.position && (
          <MentionDropdown
            ref={mentionDropdownRef}
            query={mentionState.query}
            position={mentionState.position}
            editor={editor}
            campaignMembers={campaignMembers}
            journalEntities={journalEntities}
            sessionNotes={sessionNotes}
            userColorMap={userColorMap}
            onSelect={() => setMentionState({ active: false, query: '', position: null })}
          />
        )}
        <JournalEntryMentionModal
          entry={selectedJournalEntry}
          anchorRect={selectedJournalEntryAnchor}
          onClose={closeJournalEntryModal}
        />
        <SessionMentionModal
          session={selectedSessionMention}
          anchorRect={selectedSessionMentionAnchor}
          campaignSlug={campaignSlug}
          onClose={closeSessionMentionModal}
        />
      </div>
    </div>
  )
}
