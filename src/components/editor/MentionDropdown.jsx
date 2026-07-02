import React, { useMemo, useImperativeHandle, forwardRef, useState, useEffect, useDeferredValue } from 'react'
import { colorFromString } from '../../lib/liveblocks'

const TYPE_COLORS = {
  npc: { color: '#3b82f6', label: 'blue' },
  item: { color: '#a16207', label: 'brown' },
  pet: { color: '#a855f7', label: 'purple' },
  location: { color: '#22c55e', label: 'green' },
  session: { color: '#ef4444', label: 'red' },
  user: 'user-specific'
}

const TYPE_ICONS = {
  npc: '/icons/NPCs.png',
  item: '/icons/Inventory.png',
  pet: '/icons/Pets.png',
  location: '/icons/Location.png',
}

const MentionDropdown = forwardRef(function MentionDropdown({
  query,
  position,
  editor,
  campaignMembers = [],
  journalEntities = [],
  sessionNotes = [],
  userColorMap = new Map(),
  onSelect
}, ref) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query)
    }, 150)
    return () => clearTimeout(handler)
  }, [query])

  const deferredQuery = useDeferredValue(debouncedQuery)

  const suggestions = useMemo(() => {
    const queryLower = (deferredQuery || '').toLowerCase()
    const results = []

    // Journal entities (NPCs, Inventory, Pets, Locations)
    journalEntities.forEach(entity => {
      if (entity.label.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'entity',
          id: entity.id,
          label: entity.label,
          entityType: entity.tag_type,
          order: 0,
        })
      }
    })

    // Users
    campaignMembers.forEach(user => {
      if (user.display_name.toLowerCase().includes(queryLower)) {
        // Use live color map if available, fallback to user.color or generated
        let color = userColorMap.get(user.user_id) || user.color || colorFromString(user.display_name)
        
        results.push({
          type: 'user',
          id: user.user_id,
          label: user.display_name,
          color: color,
          order: 1,
        })
      }
    })

    // Session notes
    sessionNotes.forEach(note => {
      if (note.name.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'session',
          id: note.id,
          label: note.name,
          order: 2,
        })
      }
    })

    // Sort by order, then by label
    return results.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  }, [deferredQuery, journalEntities, campaignMembers, sessionNotes, userColorMap])

  const handleSelect = (suggestion) => {
    if (!editor) return

    const { from } = editor.state.selection
    
    // Find the @ symbol by looking backward from current position
    const text = editor.state.doc.textBetween(Math.max(0, from - 50), from)
    const match = text.match(/@([\w]*)$/)
    
    if (!match) {
      // Pattern not found, just close dropdown
      onSelect()
      return
    }
    
    // Calculate exact positions based on current cursor
    const mentionLength = match[0].length // includes @ and query
    const deleteFrom = from - mentionLength
    
    // Build mark attributes based on type
    const attrs = {
      mentionType: suggestion.type,
    }
    
    if (suggestion.type === 'entity') {
      attrs.mentionEntityType = suggestion.entityType
      attrs.mentionId = suggestion.id
      attrs.mentionLabel = suggestion.label
      
    } else if (suggestion.type === 'user') {
      attrs.mentionId = suggestion.id
      attrs.mentionLabel = suggestion.label
      // Ensure we always have a color, falling back to generating one from label if needed
      attrs.mentionColor = suggestion.color || colorFromString(suggestion.label)
      
    } else if (suggestion.type === 'session') {
      attrs.mentionId = suggestion.id
      attrs.mentionLabel = suggestion.label
    }
    
    // Use raw transaction to insert text with mark applied
    const { tr } = editor.state
    tr.deleteRange(deleteFrom, from)
    
    // Create the mention mark
    const mentionMark = editor.schema.marks.mention.create(attrs)
    
    // Insert text with mention mark
    // Important: We need to pass the attributes that match the mark definition
    tr.insertText(suggestion.label + ' ', deleteFrom)
    
    // Add mark only to the label part
    tr.addMark(deleteFrom, deleteFrom + suggestion.label.length, mentionMark)
    
    // Remove stored mark so subsequent typing is clean
    tr.removeStoredMark(mentionMark)
    
    // Also explicitly remove the mention mark from the space we just inserted
    // This ensures that if the cursor moves there, it doesn't pick up the mark
    tr.removeMark(deleteFrom + suggestion.label.length, deleteFrom + suggestion.label.length + 1, mentionMark)
    
    // Force a view update to ensure DOM attributes are rendered
    editor.view.dispatch(tr)

    onSelect()
  }

  // Expose selectFirst method to parent
  useImperativeHandle(ref, () => ({
    selectFirst: () => {
      if (suggestions.length > 0) {
        handleSelect(suggestions[0])
      }
    }
  }))

  if (suggestions.length === 0) return null

  // Calculate position relative to editor view
  let style = { position: 'absolute', top: '0px', left: '0px', zIndex: 50 }
  
  try {
    const coords = editor?.view?.coordsAtPos?.(position)
    if (coords) {
      // Position dropdown below the current cursor position
      // Get the editor container's position to calculate relative coordinates
      const editorElement = editor?.view?.dom?.parentElement
      const editorRect = editorElement?.getBoundingClientRect?.()
      
      if (editorRect) {
        const relativeTop = coords.top - editorRect.top + 20
        const relativeLeft = coords.left - editorRect.left
        style = {
          position: 'absolute',
          top: `${Math.max(0, relativeTop)}px`,
          left: `${Math.max(0, relativeLeft)}px`,
          zIndex: 50,
        }
      }
    }
  } catch (e) {
    // Fallback if coordsAtPos fails
  }

  return (
    <div 
      className="mention-dropdown bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg shadow-xl max-w-xs max-h-48 overflow-y-auto"
      style={style}
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.type}-${suggestion.id}`}
          onClick={() => handleSelect(suggestion)}
          className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors text-slate-900 dark:text-gray-100 ${index === 0 ? 'mention-selected' : ''}`}
        >
          {suggestion.type === 'entity' && (
            <>
              <img
                src={TYPE_ICONS[suggestion.entityType]}
                alt=""
                className="w-4 h-4 flex-shrink-0 mention-dropdown-icon"
              />
              <span
                style={{
                  color: TYPE_COLORS[suggestion.entityType]?.color,
                  fontWeight: 'bold',
                }}
                className="text-sm"
              >
                {suggestion.label}
              </span>
            </>
          )}
          {suggestion.type === 'user' && (
            <>
              <div
                className="w-4 h-4 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: suggestion.color }}
              >
                {suggestion.label.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  color: suggestion.color,
                  fontWeight: 'bold',
                }}
                className="text-sm"
              >
                {suggestion.label}
              </span>
            </>
          )}
          {suggestion.type === 'session' && (
            <>
              <span className="text-xl flex-shrink-0">📄</span>
              <span
                style={{
                  color: TYPE_COLORS.session.color,
                  fontWeight: 'bold',
                }}
                className="text-sm"
              >
                {suggestion.label}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  )
})

import { memo } from 'react'
export default memo(MentionDropdown)
