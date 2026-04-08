import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui'
import {
  applyMentionColorPreferences,
  DEFAULT_ITEM_REFERENCE_MENTION_COLOR,
  DEFAULT_LOCATION_REFERENCE_MENTION_COLOR,
  DEFAULT_NPC_REFERENCE_MENTION_COLOR,
  DEFAULT_PET_REFERENCE_MENTION_COLOR,
  DEFAULT_SESSION_REFERENCE_MENTION_COLOR,
  getMentionColorPreferences,
  ITEM_REFERENCE_MENTION_COLOR_STORAGE_KEY,
  LOCATION_REFERENCE_MENTION_COLOR_STORAGE_KEY,
  NPC_REFERENCE_MENTION_COLOR_STORAGE_KEY,
  PET_REFERENCE_MENTION_COLOR_STORAGE_KEY,
  SESSION_REFERENCE_MENTION_COLOR_STORAGE_KEY,
  setMentionColorPreference,
} from '../lib/mentionColorPreferences'
import {
  DEFAULT_SHOW_OFFLINE_MEMBERS,
  getShowOfflineMembersPreference,
  setShowOfflineMembersPreference,
} from '../lib/sessionDisplayPreferences'

export default function SessionPreferences() {
  const { campaignSlug, sessionSlug } = useParams()
  const navigate = useNavigate()
  const initialPreferences = useMemo(() => getMentionColorPreferences(), [])
  const [npcReferenceColor, setNpcReferenceColor] = useState(
    initialPreferences.npcReferenceColor || DEFAULT_NPC_REFERENCE_MENTION_COLOR
  )
  const [itemReferenceColor, setItemReferenceColor] = useState(
    initialPreferences.itemReferenceColor || DEFAULT_ITEM_REFERENCE_MENTION_COLOR
  )
  const [petReferenceColor, setPetReferenceColor] = useState(
    initialPreferences.petReferenceColor || DEFAULT_PET_REFERENCE_MENTION_COLOR
  )
  const [locationReferenceColor, setLocationReferenceColor] = useState(
    initialPreferences.locationReferenceColor || DEFAULT_LOCATION_REFERENCE_MENTION_COLOR
  )
  const [sessionReferenceColor, setSessionReferenceColor] = useState(
    initialPreferences.sessionReferenceColor || DEFAULT_SESSION_REFERENCE_MENTION_COLOR
  )
  const [showOfflineMembers, setShowOfflineMembers] = useState(() => getShowOfflineMembersPreference())

  const updateNpcReferenceColor = (color) => {
    setNpcReferenceColor(color)
    setMentionColorPreference(NPC_REFERENCE_MENTION_COLOR_STORAGE_KEY, color)
    applyMentionColorPreferences()
  }

  const updateItemReferenceColor = (color) => {
    setItemReferenceColor(color)
    setMentionColorPreference(ITEM_REFERENCE_MENTION_COLOR_STORAGE_KEY, color)
    applyMentionColorPreferences()
  }

  const updatePetReferenceColor = (color) => {
    setPetReferenceColor(color)
    setMentionColorPreference(PET_REFERENCE_MENTION_COLOR_STORAGE_KEY, color)
    applyMentionColorPreferences()
  }

  const updateLocationReferenceColor = (color) => {
    setLocationReferenceColor(color)
    setMentionColorPreference(LOCATION_REFERENCE_MENTION_COLOR_STORAGE_KEY, color)
    applyMentionColorPreferences()
  }

  const updateSessionReferenceColor = (color) => {
    setSessionReferenceColor(color)
    setMentionColorPreference(SESSION_REFERENCE_MENTION_COLOR_STORAGE_KEY, color)
    applyMentionColorPreferences()
  }

  const resetNpcReferenceColor = () => {
    setNpcReferenceColor(DEFAULT_NPC_REFERENCE_MENTION_COLOR)
    setMentionColorPreference(NPC_REFERENCE_MENTION_COLOR_STORAGE_KEY, null)
    applyMentionColorPreferences()
  }

  const resetItemReferenceColor = () => {
    setItemReferenceColor(DEFAULT_ITEM_REFERENCE_MENTION_COLOR)
    setMentionColorPreference(ITEM_REFERENCE_MENTION_COLOR_STORAGE_KEY, null)
    applyMentionColorPreferences()
  }

  const resetPetReferenceColor = () => {
    setPetReferenceColor(DEFAULT_PET_REFERENCE_MENTION_COLOR)
    setMentionColorPreference(PET_REFERENCE_MENTION_COLOR_STORAGE_KEY, null)
    applyMentionColorPreferences()
  }

  const resetLocationReferenceColor = () => {
    setLocationReferenceColor(DEFAULT_LOCATION_REFERENCE_MENTION_COLOR)
    setMentionColorPreference(LOCATION_REFERENCE_MENTION_COLOR_STORAGE_KEY, null)
    applyMentionColorPreferences()
  }

  const resetSessionReferenceColor = () => {
    setSessionReferenceColor(DEFAULT_SESSION_REFERENCE_MENTION_COLOR)
    setMentionColorPreference(SESSION_REFERENCE_MENTION_COLOR_STORAGE_KEY, null)
    applyMentionColorPreferences()
  }

  const handleShowOfflineMembersChange = (checked) => {
    setShowOfflineMembers(checked)
    setShowOfflineMembersPreference(checked)
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 text-slate-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200 overflow-hidden">
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
            Preferences
          </h1>
        </div>

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
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug}/journal`)}
              className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
            >
              Journal
            </button>
            <button
              className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-medium bg-white dark:bg-gray-900 text-slate-900 dark:text-white border border-slate-200 dark:border-gray-700 transition-colors"
            >
              Preferences
            </button>
          </nav>
        </div>

        <div className="flex-1 md:flex-none md:w-1/4"></div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          <section className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Style Preferences</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
              Reference color selections are local to your browser and apply to all campaigns.
            </p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100">NPC reference color</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Controls @ references to NPC entities.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="NPC reference color"
                      value={npcReferenceColor}
                      onChange={(event) => updateNpcReferenceColor(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      onClick={resetNpcReferenceColor}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100">Inventory reference color</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Controls @ references to inventory entities.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Inventory reference color"
                      value={itemReferenceColor}
                      onChange={(event) => updateItemReferenceColor(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      onClick={resetItemReferenceColor}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100">Pet reference color</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Controls @ references to pet entities.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Pet reference color"
                      value={petReferenceColor}
                      onChange={(event) => updatePetReferenceColor(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      onClick={resetPetReferenceColor}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100">Location reference color</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Controls @ references to location entities.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Location reference color"
                      value={locationReferenceColor}
                      onChange={(event) => updateLocationReferenceColor(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      onClick={resetLocationReferenceColor}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100">Session reference color</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Controls @ references to linked sessions.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Session reference color"
                      value={sessionReferenceColor}
                      onChange={(event) => updateSessionReferenceColor(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      onClick={resetSessionReferenceColor}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Member List Preferences</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
              These visibility settings are local to your browser and apply to all campaigns.
            </p>
            <div className="mt-6 rounded-md border border-slate-200 dark:border-gray-700 p-4">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-gray-100">Show offline members</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    When disabled, users marked Offline are hidden from the Member List.
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label="Show offline members in member list"
                  checked={showOfflineMembers}
                  onChange={(event) => handleShowOfflineMembersChange(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
                />
              </label>

            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
