import { useNavigate, useParams } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { requireSupabase } from '../lib/supabase'
import { useSessionData } from '../hooks/useSessionData'
import { Button, Input, Card } from '../components/ui'
import NewJournalEntryModal from '../components/journal/NewJournalEntryModal'
import { formatDistanceToNow } from 'date-fns'

const TAG_SECTIONS = [
  { type: 'npc', title: 'NPCs', placeholder: 'Add NPC Name' },
  { type: 'inventory', title: 'Inventory', placeholder: 'Add Item Name' },
  { type: 'pet', title: 'Pets', placeholder: 'Add Pet Name' },
  { type: 'location', title: 'Locations', placeholder: 'Add Location Name' },
]

export default function Journal() {
  const { campaignSlug, sessionSlug } = useParams()
  const navigate = useNavigate()
  const [campaignId, setCampaignId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [loadingIds, setLoadingIds] = useState(true)

  // First, resolve slugs to IDs
  useEffect(() => {
    const resolveIds = async () => {
      try {
        const client = requireSupabase()
        const { data: campaignData, error: campaignError } = await client
          .from('campaigns')
          .select('id')
          .eq('slug', campaignSlug)
          .single()
        
        if (campaignError || !campaignData) {
          navigate('/campaigns')
          return
        }

        const { data: sessionData, error: sessionError } = await client
          .from('sessions')
          .select('id')
          .eq('slug', sessionSlug)
          .eq('campaign_id', campaignData.id)
          .single()
        
        if (sessionError || !sessionData) {
          navigate(`/campaigns/${campaignSlug}`)
          return
        }

        setCampaignId(campaignData.id)
        setSessionId(sessionData.id)
      } catch (err) {
        console.error('Error resolving slugs:', err)
        navigate('/campaigns')
      } finally {
        setLoadingIds(false)
      }
    }

    resolveIds()
  }, [campaignSlug, sessionSlug, navigate])

  const {
    session,
    tags,
    loading,
    error,
    addTag,
    removeTag,
    updateTag
  } = useSessionData(sessionId, campaignId)

  const [drafts, setDrafts] = useState({ npc: '', inventory: '', pet: '', location: '' })
  const [searchTerms, setSearchTerms] = useState({ npc: '', inventory: '', pet: '', location: '' })
  const [sortBy, setSortBy] = useState({ npc: 'order', inventory: 'order', pet: 'order', location: 'order' })
  const [draggedItem, setDraggedItem] = useState(null)
  const [draggedOverType, setDraggedOverType] = useState(null)
  const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState(false)
  const [newEntrySection, setNewEntrySection] = useState(null)

  // Group tags by type
  const groupedTags = useMemo(() => {
    const groups = { npc: [], inventory: [], pet: [], location: [] }
    tags.forEach(tag => {
      let type = tag.tag_type
      if (type === 'item') type = 'inventory'

      if (groups[type]) {
        groups[type].push(tag)
      }
    })

    // Filter by search and sort
    Object.keys(groups).forEach(type => {
      // Filter by search term
      if (searchTerms[type]) {
        groups[type] = groups[type].filter(tag =>
          tag.label.toLowerCase().includes(searchTerms[type].toLowerCase())
        )
      }

      // Sort based on selected option
      if (sortBy[type] === 'name') {
        groups[type].sort((a, b) => a.label.localeCompare(b.label))
      } else if (sortBy[type] === 'date') {
        groups[type].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      } else {
        // Sort by order_index (default)
        groups[type].sort((a, b) => {
          if (a.order_index !== undefined && b.order_index !== undefined) {
            return a.order_index - b.order_index
          }
          return new Date(a.created_at) - new Date(b.created_at)
        })
      }
    })

    return groups
  }, [tags, searchTerms, sortBy])

  const handleAdd = async (e, type) => {
    e.preventDefault()
    if (!drafts[type]?.trim()) return
    await addTag(type, drafts[type])
    setDrafts(prev => ({ ...prev, [type]: '' }))
  }

  const handleNewEntryClick = (section) => {
    setNewEntrySection(section)
    setIsNewEntryModalOpen(true)
  }

  const handleNewEntrySave = async (name) => {
    if (newEntrySection) {
      await addTag(newEntrySection.type, name)
      setIsNewEntryModalOpen(false)
      setNewEntrySection(null)
    }
  }

  const handleDragStart = (e, tag, type) => {
    setDraggedItem({ tag, type })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, type) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggedOverType(type)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDraggedOverType(null)
  }

  const handleDrop = async (e, targetTag, targetType) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.type !== targetType) return

    const sourceTag = draggedItem.tag
    if (sourceTag.id === targetTag.id) return

    const items = groupedTags[targetType]
    const sourceIndex = items.findIndex(t => t.id === sourceTag.id)
    const targetIndex = items.findIndex(t => t.id === targetTag.id)

    if (sourceIndex === -1 || targetIndex === -1) return

    // Reorder the items
    const reordered = [...items]
    const [removed] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, removed)

    // Update order_index for all items in this type
    const updates = reordered.map((tag, index) =>
      updateTag(tag.id, { order_index: index })
    )

    await Promise.all(updates)
    setDraggedItem(null)
  }

  const toggleSort = (type) => {
    setSortBy(prev => ({
      ...prev,
      [type]: prev[type] === 'order' ? 'name' : prev[type] === 'name' ? 'date' : 'order'
    }))
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'recently'
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
        .replace('about ', '')
    } catch (error) {
      return 'recently'
    }
  }

  if (loadingIds) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <p className="text-slate-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <p className="text-slate-500 dark:text-gray-400">Loading journal...</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 text-slate-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200 overflow-hidden">
      {/* Header */}
      <header className="h-16 px-4 md:px-6 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between gap-2 transition-colors duration-200 shrink-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1 md:flex-none md:w-1/4 min-w-0">
          <Button
            onClick={() => navigate(`/campaigns/${campaignSlug}`)}
            variant="ghost"
            className="text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white pl-0 shrink-0 hover:bg-transparent dark:hover:bg-transparent"
          >
            <span className="hidden md:inline">Back</span>
            <span className="md:hidden">←</span>
          </Button>
          <div className="h-6 w-px bg-slate-200 dark:bg-gray-700 mx-1 md:mx-2 shrink-0"></div>
          <h1 className="text-base md:text-lg font-semibold text-slate-900 dark:text-gray-100 truncate font-sans">
            {session?.name || 'Session'}
          </h1>
        </div>

        {/* Navigation Tabs - Centered */}
        <div className="flex-1 flex items-center justify-center">
          <nav className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 border border-slate-200 dark:border-gray-700 shrink-0 rounded-md">
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug}`)}
              className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="hidden md:inline">Workspace</span>
              <span className="md:hidden">Edit</span>
            </button>
            <button
              className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-medium bg-white dark:bg-gray-900 text-slate-900 dark:text-white border border-slate-200 dark:border-gray-700 transition-colors"
            >
              Journal
            </button>
          </nav>
        </div>

        <div className="flex-1 md:flex-none md:w-1/4"></div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="mx-6 my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md shrink-0">
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {TAG_SECTIONS.map((section) => (
            <div
              key={section.type}
              className="flex flex-col bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 last:border-r-0 transition-colors duration-200"
              onDragOver={(e) => handleDragOver(e, section.type)}
            >
              {/* Section Header */}
              <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100 uppercase tracking-wider">
                    {section.title}
                  </h2>
                  <span className="bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">
                    {groupedTags[section.type]?.length || 0}
                  </span>
                </div>

                {/* Search Bar */}
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchTerms[section.type]}
                  onChange={(e) => setSearchTerms(prev => ({ ...prev, [section.type]: e.target.value }))}
                  className="bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 text-sm h-8"
                />

                {/* Sort Button */}
                <button
                  onClick={() => toggleSort(section.type)}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Sort by: {sortBy[section.type] === 'order' ? 'Order' : sortBy[section.type] === 'name' ? 'Name' : 'Date Added'}
                </button>
              </div>

              {/* Scrollable Entity List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {/* New Entry Button at Top */}
                <button
                  onClick={() => handleNewEntryClick(section)}
                  className="w-full p-3 border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-md hover:border-brand-600 dark:hover:border-brand-600 transition-colors text-center text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 font-medium text-sm"
                >
                  New Entry
                </button>

                {groupedTags[section.type]?.length > 0 ? (
                  groupedTags[section.type].map((tag) => (
                    <div
                      key={tag.id}
                      draggable={sortBy[section.type] === 'order'}
                      onDragStart={(e) => handleDragStart(e, tag, section.type)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, tag, section.type)}
                      className={`group flex items-start justify-between p-3 bg-slate-50 dark:bg-gray-900/50 border border-slate-200 dark:border-gray-700 rounded-md hover:border-brand-400 dark:hover:border-gray-600 transition-all ${sortBy[section.type] === 'order' ? 'cursor-move' : ''
                        } ${draggedItem?.tag.id === tag.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-gray-200 text-sm truncate">
                          {tag.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                          Added {formatTimestamp(tag.created_at)} in {tag.sessions?.name || 'Unknown Session'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeTag(tag.id, tag)}
                        className="text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 ml-2 shrink-0"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400 dark:text-gray-500 italic text-sm">
                    {searchTerms[section.type] ? 'No results found' : `No ${section.title.toLowerCase()} yet.`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <NewJournalEntryModal
        isOpen={isNewEntryModalOpen}
        onClose={() => setIsNewEntryModalOpen(false)}
        onSave={handleNewEntrySave}
        sectionType={newEntrySection?.type}
        sectionTitle={newEntrySection?.title}
      />
    </div>
  )
}
