import { useState, useRef, useEffect } from 'react'

export function getMentionAttrsFromEventTarget(eventTarget) {
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

export function useMentionHandling({ journalEntities = [], sessionNotes = [] } = {}) {
  const [mentionState, setMentionState] = useState({ active: false, query: '', position: null })
  const mentionStateRef = useRef(mentionState)
  
  const [selectedJournalEntry, setSelectedJournalEntry] = useState(null)
  const [selectedJournalEntryAnchor, setSelectedJournalEntryAnchor] = useState(null)
  const [selectedSessionMention, setSelectedSessionMention] = useState(null)
  const [selectedSessionMentionAnchor, setSelectedSessionMentionAnchor] = useState(null)

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

  return {
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
  }
}
