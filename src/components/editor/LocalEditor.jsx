import { useEffect, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { useParams } from 'react-router-dom'
import { getMarkRange } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { colorFromString } from '../../lib/liveblocks'
import { getEditorExtensions } from './editorConfig'
import { useMentionHandling, getMentionAttrsFromEventTarget } from './useMentionHandling'
import MentionDropdown from './MentionDropdown'
import MentionActionModal from './MentionActionModal'

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
  onEditorReady,
}) {
  const mentionDropdownRef = useRef(null)
  const { campaignSlug } = useParams()
  const noteContentDebounceRef = useRef(null)
  const isFirstLoadRef = useRef(true)

  const {
    mentionState,
    setMentionState,
    mentionStateRef,
    selectedJournalEntry,
    selectedJournalEntryAnchor,
    selectedSessionMention,
    selectedSessionMentionAnchor,
    openJournalEntryModal,
    closeJournalEntryModal,
    openSessionMentionModal,
    closeSessionMentionModal,
  } = useMentionHandling({ journalEntities, sessionNotes })

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

  const extensions = useMemo(() => getEditorExtensions({ collaborative: false }), [])

  const editor = useEditor({
    extensions,
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
          if (selectedJournalEntry) closeJournalEntryModal()
          if (selectedSessionMention) closeSessionMentionModal()

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
      clearTimeout(noteContentDebounceRef.current)
      noteContentDebounceRef.current = setTimeout(() => {
        setNoteContent(currentEditor.getHTML())
      }, 100)

      const { from } = currentEditor.state.selection
      const text = currentEditor.state.doc.textBetween(Math.max(0, from - 50), from)
      const match = text.match(/@([\w]*)$/)

      if (match) {
        setMentionState({ active: true, query: match[1], position: from })
      } else {
        setMentionState({ active: false, query: '', position: null })
      }
    },
    onCreate: ({ editor: ed }) => {
      onEditorReady?.(ed)
    },
  }, [])

  useEffect(() => {
    if (editor) onEditorReady?.(editor)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor) return
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
        <MentionActionModal
          type="entity"
          data={selectedJournalEntry}
          anchorRect={selectedJournalEntryAnchor}
          onClose={closeJournalEntryModal}
        />
        <MentionActionModal
          type="session"
          data={selectedSessionMention}
          anchorRect={selectedSessionMentionAnchor}
          campaignSlug={campaignSlug}
          onClose={closeSessionMentionModal}
        />
      </div>
    </div>
  )
}
