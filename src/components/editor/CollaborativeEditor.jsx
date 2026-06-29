import { useEffect, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { useParams } from 'react-router-dom'
import { getMarkRange } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { useRoom, useOthers } from '@liveblocks/react'
import { getYjsProviderForRoom } from '@liveblocks/yjs'
import { colorFromString } from '../../lib/liveblocks'
import { getEditorExtensions } from './editorConfig'
import { useMentionHandling, getMentionAttrsFromEventTarget } from './useMentionHandling'
import MentionDropdown from './MentionDropdown'
import MentionActionModal from './MentionActionModal'

export default function CollaborativeEditor({
  noteContent,
  setNoteContent,
  userLabel,
  userColor,
  sharedMinHeight,
  campaignMembers = [],
  journalEntities = [],
  sessionNotes = [],
  currentUserId,
  onEditorReady,
}) {
  const room = useRoom()
  const others = useOthers()
  const yProvider = useMemo(() => getYjsProviderForRoom(room), [room])
  const ydoc = useMemo(() => yProvider.getYDoc(), [yProvider])
  const localColor = useMemo(() => userColor || colorFromString(userLabel), [userColor, userLabel])
  
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)
  const mentionDropdownRef = useRef(null)
  const { campaignSlug } = useParams()

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

  // --- Dynamic Styles for User Mentions ---
  const userColorMap = useMemo(() => {
    const styleMap = new Map()
    campaignMembers.forEach(member => {
      const color = member.color || colorFromString(member.display_name)
      styleMap.set(member.user_id, color)
    })
    others.forEach(user => {
      const name = user.presence?.name
      const color = user.presence?.color
      if (name && color) {
        const member = campaignMembers.find(m => m.display_name === name)
        if (member) styleMap.set(member.user_id, color)
      }
    })
    if (currentUserId && localColor) {
      styleMap.set(currentUserId, localColor)
    } else if (userLabel && localColor) {
      const selfMember = campaignMembers.find(m => m.display_name === userLabel)
      if (selfMember) styleMap.set(selfMember.user_id, localColor)
    }
    return styleMap
  }, [campaignMembers, others, userLabel, localColor, currentUserId])

  const userStyles = useMemo(() => {
    return Array.from(userColorMap.entries())
      .map(([userId, color]) => `.mention-user-${userId} { color: ${color} !important; }`)
      .join('\n')
  }, [userColorMap])

  // Presence updates
  useEffect(() => {
    room.updatePresence({ name: userLabel, color: localColor, typing: false })
  }, [room, userLabel, localColor])

  const handleTyping = (isTyping) => {
    if (isTyping) {
      if (!isTypingRef.current) {
        isTypingRef.current = true
        room.updatePresence({ typing: true })
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => handleTyping(false), 1500)
    } else {
      isTypingRef.current = false
      room.updatePresence({ typing: false })
      typingTimeoutRef.current = null
    }
  }

  const extensions = useMemo(() => getEditorExtensions({ collaborative: true, ydoc }), [ydoc])

  const editor = useEditor({
    extensions,
    onCreate: ({ editor: ed }) => {
      onEditorReady?.(ed)
    },
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
        
        if (event.target.tagName === 'A' && event.target.href) {
          if (event.ctrlKey || event.metaKey) {
            window.open(event.target.href, '_blank')
            event.preventDefault()
          }
          return true
        }
        
        const linkMark = resolvedPos.marks().find(m => m.type.name === 'link')
        if (linkMark && linkMark.attrs.href) {
          if (event.ctrlKey || event.metaKey) {
            window.open(linkMark.attrs.href, '_blank')
            event.preventDefault()
          }
          return true
        }
        
        const range = getMarkRange(resolvedPos, schema.marks.mention)
        if (range) {
          const mentionMark = resolvedPos.marks().find(m => m.type.name === 'mention')
          if (mentionMark) {
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
          }
        }
        return false
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
          handleTyping(true)
          return false
        },
        blur: () => { handleTyping(false); return false },
      },
    },
    onUpdate: ({ editor }) => {
      setNoteContent(editor.getHTML())
      const { from } = editor.state.selection
      const text = editor.state.doc.textBetween(Math.max(0, from - 50), from)
      const match = text.match(/@([\w]*)$/)
      
      if (match) {
        setMentionState({ active: true, query: match[1], position: from })
      } else {
        setMentionState({ active: false, query: '', position: null })
      }
    },
  }, [ydoc])

  useEffect(() => {
    if (editor) onEditorReady?.(editor)
  }, [editor, onEditorReady])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 relative">
      <style>{userStyles}</style>
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
