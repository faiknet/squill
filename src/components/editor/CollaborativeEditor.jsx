import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { useNavigate, useParams } from 'react-router-dom'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import ResizableImage from 'tiptap-extension-resize-image'
import Collaboration from '@tiptap/extension-collaboration'
import FontFamily from '@tiptap/extension-font-family'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { getMarkRange } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { useRoom, useOthers } from '@liveblocks/react'
import { getYjsProviderForRoom } from '@liveblocks/yjs'
import { colorFromString } from '../../lib/liveblocks'
import { MentionMark } from '../../lib/mentionMark'
import { FontSize } from '../../lib/fontSizeExtension'
import { IndentExtension } from '../../lib/indentExtension'
import EditorToolbar from './GoogleDocsToolbar'
import MentionDropdown from './MentionDropdown'

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
}) {
  const room = useRoom()
  const others = useOthers()
  const yProvider = useMemo(() => getYjsProviderForRoom(room), [room])
  const ydoc = useMemo(() => yProvider.getYDoc(), [yProvider])
  const localColor = useMemo(() => userColor || colorFromString(userLabel), [userColor, userLabel])
  
  const typingTimeoutRef = useRef(null)
  const [mentionState, setMentionState] = useState({ active: false, query: '', position: null })
  const mentionStateRef = useRef(mentionState)
  
  // Keep ref in sync with state for event handlers
  useEffect(() => {
    mentionStateRef.current = mentionState
  }, [mentionState])

  // Ref to access the select method from outside
  const mentionDropdownRef = useRef(null)
  
  const navigate = useNavigate()
  const { id: campaignId } = useParams()

  // --- Dynamic Styles for User Mentions ---
  const userColorMap = useMemo(() => {
    const styleMap = new Map()

    // 1. Initial/Offline colors from Campaign Members
    campaignMembers.forEach(member => {
      const color = member.color || colorFromString(member.display_name)
      styleMap.set(member.user_id, color)
    })

    // 2. Active/Online colors from Liveblocks (Overrides offline)
    others.forEach(user => {
      const name = user.presence?.name
      const color = user.presence?.color
      if (name && color) {
        // Match by name if we don't have ID in presence (should ideally have userId)
        const member = campaignMembers.find(m => m.display_name === name)
        if (member) {
          styleMap.set(member.user_id, color)
        }
      }
    })

    // 3. Current User (Highest priority for self view)
    if (currentUserId && localColor) {
      styleMap.set(currentUserId, localColor)
    } else if (userLabel && localColor) {
      // Fallback to name matching if currentUserId not provided
      const selfMember = campaignMembers.find(m => m.display_name === userLabel)
      if (selfMember) {
        styleMap.set(selfMember.user_id, localColor)
      }
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
      room.updatePresence({ typing: true })
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => handleTyping(false), 1500)
    } else {
      room.updatePresence({ typing: false })
      typingTimeoutRef.current = null
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }), // YJS handles history
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      ResizableImage,
      MentionMark,
      Collaboration.configure({ document: ydoc }),
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
    editorProps: {
      attributes: {
        class: 'w-full min-h-full bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 text-base focus:outline-none px-12 md:px-24 lg:px-32 xl:px-48 py-8 md:py-12 prose prose-slate dark:prose-invert max-w-none transition-colors duration-200',
      },
      handleClick: (view, pos, event) => {
        const { schema, doc, tr } = view.state
        const resolvedPos = doc.resolve(pos)
        
        // Check if click target is an <a> tag (direct DOM click)
        if (event.target.tagName === 'A' && event.target.href) {
          // Only open link if Ctrl/Cmd is held
          if (event.ctrlKey || event.metaKey) {
            window.open(event.target.href, '_blank')
            event.preventDefault()
          }
          return true
        }
        
        // Check for link mark (editor level)
        const linkMark = resolvedPos.marks().find(m => m.type.name === 'link')
        if (linkMark && linkMark.attrs.href) {
          // Only open link if Ctrl/Cmd is held
          if (event.ctrlKey || event.metaKey) {
            window.open(linkMark.attrs.href, '_blank')
            event.preventDefault()
          }
          return true
        }
        
        // Check for mention range
        const range = getMarkRange(resolvedPos, schema.marks.mention)
        
        if (range) {
          // Check for session navigation (Ctrl/Meta + Click)
          const mentionMark = resolvedPos.marks().find(m => m.type.name === 'mention')
          
          if (mentionMark) {
            if (mentionMark.attrs.mentionType === 'session' && (event.ctrlKey || event.metaKey)) {
              const sessionId = mentionMark.attrs.mentionId
              if (sessionId && campaignId) {
                navigate(`/campaigns/${campaignId}/sessions/${sessionId}`)
                return true
              }
            }
            
            // Otherwise, select the whole mention (Notion-style)
            const selection = TextSelection.create(doc, range.from, range.to)
            view.dispatch(tr.setSelection(selection))
            return true
          }
        }
        return false
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
          if (mentionStateRef.current.active) {
            if (event.key === 'Escape') {
              setMentionState({ active: false, query: '', position: null })
              return true
            }
            if (event.key === 'Tab') {
              event.preventDefault()
              // Call the select method if available
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
      
      // Check for @ mentions
      const { from } = editor.state.selection
      const text = editor.state.doc.textBetween(Math.max(0, from - 50), from)
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
  }, [ydoc])

  // Legacy DOM listener removed in favor of TipTap handleClick
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 relative">
      <style>{userStyles}</style>
      <EditorToolbar editor={editor} />
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
      </div>
    </div>
  )
}
