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
  DEFAULT_ENABLE_REFERENCE_ICONS,
  getEnableReferenceIconsPreference,
  setEnableReferenceIconsPreference,
  applyEnableReferenceIconsPreference,
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
  const [enableReferenceIcons, setEnableReferenceIcons] = useState(() => getEnableReferenceIconsPreference())

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

  const handleEnableReferenceIconsChange = (checked) => {
    setEnableReferenceIcons(checked)
    setEnableReferenceIconsPreference(checked)
    applyEnableReferenceIconsPreference()
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

      <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Summary Tile */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100 font-sans">Browser Preferences</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                These settings are saved locally to this browser and apply across all campaigns.
              </p>
            </div>
            <button
              onClick={() => {
                resetNpcReferenceColor()
                resetItemReferenceColor()
                resetPetReferenceColor()
                resetLocationReferenceColor()
                resetSessionReferenceColor()
                handleShowOfflineMembersChange(true)
                handleEnableReferenceIconsChange(true)
              }}
              className="px-4 py-2 border border-slate-200 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-gray-300 transition-colors self-start md:self-auto"
            >
              Reset All to Default
            </button>
          </div>

          {/* Bento Adaptive Grid */}
          <div className="grid grid-cols-12 gap-6">

            {/* Reference Colors Container (Wide Bento Card) */}
            <section className="col-span-12 lg:col-span-8 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08)] transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="mb-6">
                  <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest mb-1.5 block">Style Preferences</span>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-gray-100 mb-1">Entity References</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Customize the highlighting colors of @ references in your session notes.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* NPC Reference */}
                  <div className="bg-slate-50 dark:bg-gray-900/50 p-4 border border-slate-100 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[140px]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">NPC Reference</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to NPC entities.</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-gray-800">
                      <input
                        type="color"
                        aria-label="NPC reference color"
                        value={npcReferenceColor}
                        onChange={(event) => updateNpcReferenceColor(event.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-0.5"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={resetNpcReferenceColor}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Inventory Reference */}
                  <div className="bg-slate-50 dark:bg-gray-900/50 p-4 border border-slate-100 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[140px]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Inventory Reference</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to gear and items.</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-gray-800">
                      <input
                        type="color"
                        aria-label="Inventory reference color"
                        value={itemReferenceColor}
                        onChange={(event) => updateItemReferenceColor(event.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-0.5"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={resetItemReferenceColor}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Pet Reference */}
                  <div className="bg-slate-50 dark:bg-gray-900/50 p-4 border border-slate-100 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[140px]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Pet Reference</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to companion animals.</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-gray-800">
                      <input
                        type="color"
                        aria-label="Pet reference color"
                        value={petReferenceColor}
                        onChange={(event) => updatePetReferenceColor(event.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-0.5"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={resetPetReferenceColor}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Location Reference */}
                  <div className="bg-slate-50 dark:bg-gray-900/50 p-4 border border-slate-100 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[140px]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Location Reference</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to regions/cities.</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-gray-800">
                      <input
                        type="color"
                        aria-label="Location reference color"
                        value={locationReferenceColor}
                        onChange={(event) => updateLocationReferenceColor(event.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-0.5"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={resetLocationReferenceColor}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Session Reference */}
                  <div className="bg-slate-50 dark:bg-gray-900/50 p-4 border border-slate-100 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[140px]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Session Reference</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to linked sessions.</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-gray-800">
                      <input
                        type="color"
                        aria-label="Session reference color"
                        value={sessionReferenceColor}
                        onChange={(event) => updateSessionReferenceColor(event.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300 dark:border-gray-600 bg-transparent p-0.5"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={resetSessionReferenceColor}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Enable Reference Icons Toggle */}
                  <div className="bg-slate-50 dark:bg-gray-900/50 p-4 border border-slate-100 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[140px]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Enable Reference Icons</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">When disabled, entity reference icons are hidden in the editor and mention dropdown.</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-gray-800">
                      <span className="text-xs font-medium text-slate-500 dark:text-gray-400">Entity Icons</span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          aria-label="Enable reference icons in editor"
                          checked={enableReferenceIcons}
                          onChange={(event) => handleEnableReferenceIconsChange(event.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Show Offline Members Card (Sidebar Bento Card) */}
            <section className="col-span-12 lg:col-span-4 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl p-6 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08)] transition-all duration-200 flex flex-col justify-between h-fit">
              <div>
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest mb-1.5 block">Members</span>
                <h3 className="font-semibold text-base text-slate-900 dark:text-gray-100 mb-1">Show Offline Members</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">When disabled, campaign members marked Offline are hidden from the sidebar.</p>
              </div>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-gray-700/50">
                <span className="text-xs font-medium text-slate-500 dark:text-gray-400">Sidebar Visibility</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    aria-label="Show offline members in member list"
                    checked={showOfflineMembers}
                    onChange={(event) => handleShowOfflineMembersChange(event.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                </label>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  )
}
