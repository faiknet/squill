import { useMemo, useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Input, ColorPickerModal } from '../components/ui'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useCampaignDisplayName } from '../lib/campaignDisplayPreferences'
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

function ReferenceColorPicker({ value, onChange, label }) {
  const inputRef = useRef(null)
  return (
    <div className="relative flex items-center shrink-0 mt-0.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-gray-700 transition-transform hover:scale-110 shadow-sm cursor-pointer"
        style={{ backgroundColor: value }}
        title={`Change ${label} colour`}
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={onChange}
        className="sr-only"
      />
    </div>
  )
}

const USER_COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#f59e0b', label: 'Yellow' },
  { value: '#84cc16', label: 'Green' },
  { value: '#10b981', label: 'Teal' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f43f5e', label: 'Rose' },
]

export default function SessionPreferences() {
  const { campaignSlug, sessionSlug } = useParams()

  useEffect(() => {
    document.title = 'Preferences — Squill'
  }, [])

  const { authState } = useAuth()
  const { isGuest } = authState
  const [campaignId, setCampaignId] = useState(null)
  const [resolvedCampaignName, setResolvedCampaignName] = useState('')
  const [campaignLabel, setCampaignLabel] = useState('Campaign')
  const [sessionLabel, setSessionLabel] = useState('Session')
  const [memberLabel, setMemberLabel] = useState('Players')
  const [gmLabel, setGmLabel] = useState('GM')

  useEffect(() => {
    if (isGuest) {
      setCampaignId('guest-campaign-id')
      return
    }

    async function resolveCampaign() {
      try {
        const client = requireSupabase()
        const { data, error } = await client
          .from('campaigns')
          .select('id, name, label_campaign, label_session, label_member, label_gm')
          .eq('slug', campaignSlug)
          .single()

        if (!error && data) {
          setCampaignId(data.id)
          setResolvedCampaignName(data.name)
          setCampaignLabel(data.label_campaign || 'Campaign')
          setSessionLabel(data.label_session || 'Session')
          setMemberLabel(data.label_member || 'Players')
          setGmLabel(data.label_gm || 'GM')
        }
      } catch (err) {
        console.error('Failed to resolve campaign ID:', err)
      }
    }
    resolveCampaign()
  }, [campaignSlug, isGuest])

  const { displayName, isLoading: displayNameLoading, setDisplayName } = useCampaignDisplayName(campaignId)
  const [inputValue, setInputValue] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (displayName !== undefined) {
      setInputValue(displayName || '')
    }
  }, [displayName])
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
  const [isColorModalOpen, setIsColorModalOpen] = useState(false)
  const [userColor, setUserColor] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('squill:session-editor:user-color') || ''
  })

  const handleUserColorChange = async (color) => {
    setUserColor(color)
    if (color) {
      window.localStorage.setItem('squill:session-editor:user-color', color)
      if (!isGuest && authState.user?.id) {
        try {
          const client = requireSupabase()
          await client.rpc('set_user_color_preference', { color_hex: color })
        } catch (err) {
          console.warn('Error saving color preference:', err)
        }
      }
    } else {
      window.localStorage.removeItem('squill:session-editor:user-color')
      if (!isGuest && authState.user?.id) {
        try {
          const client = requireSupabase()
          await client.rpc('set_user_color_preference', { color_hex: null })
        } catch (err) {
          console.warn('Error saving color preference:', err)
        }
      }
    }
  }

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
    <div className="flex-1 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200 overflow-hidden">
      <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Summary Tile */}
          <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                handleUserColorChange('')
              }}
              className="px-4 py-2 border border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-gray-300 transition-colors self-start md:self-auto"
            >
              Reset All to Default
            </button>
          </div>

          {/* Bento Adaptive Grid */}
          <div className="grid grid-cols-12 gap-6">

            {/* Reference Colors Container (Wide Bento Card) */}
            <section className="col-span-12 lg:col-span-8 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl p-6 transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="mb-6">
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-gray-100 mb-1">Entity References</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Customize the highlighting colors of @ references in your session notes.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* NPC Reference */}
                  <div className="bg-slate-50/40 dark:bg-gray-900/50 p-4 border border-slate-100/60 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">NPC Reference</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to NPC entities.</p>
                        <button
                          type="button"
                          onClick={resetNpcReferenceColor}
                          className="text-[10px] text-slate-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400 underline cursor-pointer mt-1"
                        >
                          Reset
                        </button>
                      </div>
                      <ReferenceColorPicker
                        value={npcReferenceColor}
                        onChange={(event) => updateNpcReferenceColor(event.target.value)}
                        label="NPC reference"
                      />
                    </div>
                  </div>

                  {/* Inventory Reference */}
                  <div className="bg-slate-50/40 dark:bg-gray-900/50 p-4 border border-slate-100/60 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Inventory Reference</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to gear and items.</p>
                        <button
                          type="button"
                          onClick={resetItemReferenceColor}
                          className="text-[10px] text-slate-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400 underline cursor-pointer mt-1"
                        >
                          Reset
                        </button>
                      </div>
                      <ReferenceColorPicker
                        value={itemReferenceColor}
                        onChange={(event) => updateItemReferenceColor(event.target.value)}
                        label="Inventory reference"
                      />
                    </div>
                  </div>

                  {/* Pet Reference */}
                  <div className="bg-slate-50/40 dark:bg-gray-900/50 p-4 border border-slate-100/60 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Pet Reference</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to companion animals.</p>
                        <button
                          type="button"
                          onClick={resetPetReferenceColor}
                          className="text-[10px] text-slate-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400 underline cursor-pointer mt-1"
                        >
                          Reset
                        </button>
                      </div>
                      <ReferenceColorPicker
                        value={petReferenceColor}
                        onChange={(event) => updatePetReferenceColor(event.target.value)}
                        label="Pet reference"
                      />
                    </div>
                  </div>

                  {/* Location Reference */}
                  <div className="bg-slate-50/40 dark:bg-gray-900/50 p-4 border border-slate-100/60 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Location Reference</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to regions/cities.</p>
                        <button
                          type="button"
                          onClick={resetLocationReferenceColor}
                          className="text-[10px] text-slate-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400 underline cursor-pointer mt-1"
                        >
                          Reset
                        </button>
                      </div>
                      <ReferenceColorPicker
                        value={locationReferenceColor}
                        onChange={(event) => updateLocationReferenceColor(event.target.value)}
                        label="Location reference"
                      />
                    </div>
                  </div>

                  {/* Session Reference */}
                  <div className="bg-slate-50/40 dark:bg-gray-900/50 p-4 border border-slate-100/60 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{sessionLabel} Reference</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Controls @ references to linked {sessionLabel.toLowerCase()}s.</p>
                        <button
                          type="button"
                          onClick={resetSessionReferenceColor}
                          className="text-[10px] text-slate-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400 underline cursor-pointer mt-1"
                        >
                          Reset
                        </button>
                      </div>
                      <ReferenceColorPicker
                        value={sessionReferenceColor}
                        onChange={(event) => updateSessionReferenceColor(event.target.value)}
                        label={`${sessionLabel} reference`}
                      />
                    </div>
                  </div>

                  {/* Enable Reference Icons Toggle */}
                  <div className="bg-slate-50/40 dark:bg-gray-900/50 p-4 border border-slate-100/60 dark:border-gray-800/80 rounded-xl flex flex-col justify-between min-h-[110px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">Enable Reference Icons</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">When disabled, entity reference icons are hidden in the editor and mention dropdown.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 mt-1">
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

            {/* Sidebar Cards Container */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              {/* Campaign Display Name Card */}
              <section className="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl p-6 transition-all duration-200 flex flex-col justify-between h-fit">
                <div>
                  <h3 className="font-semibold text-base text-slate-900 dark:text-gray-100 mb-1">{campaignLabel} Display Name</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">Set a custom display name for yourself in this {campaignLabel.toLowerCase()}. This name will be visible to all {memberLabel.toLowerCase()}.<br /></p>
                  <Input
                    type="text"
                    placeholder={resolvedCampaignName ? `e.g. Voldryn Stoneborn` : "Enter display name..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={displayNameLoading}
                    className="w-full text-sm h-10 mb-2 bg-slate-50/50 dark:bg-gray-900 border-slate-100 dark:border-gray-700 text-slate-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex items-center justify-end mt-2">
                  <div className="flex items-center gap-2">
                    {savedSuccess && <span className="text-xs text-green-600 dark:text-green-400">Saved!</span>}
                    <Button
                      type="button"
                      variant="primary"
                      className="h-9 px-4 text-xs font-semibold min-h-[36px]"
                      disabled={displayNameLoading}
                      onClick={async () => {
                        await setDisplayName(inputValue)
                        setSavedSuccess(true)
                        setTimeout(() => setSavedSuccess(false), 2000)
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </section>

              {/* User Color Card */}
              <section className="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl p-6 transition-all duration-200 flex flex-col justify-between h-fit">
                <div>
                  <h3 className="font-semibold text-base text-slate-900 dark:text-gray-100 mb-1">User Color</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Set your active cursor and highlight color in the collaborative editor.</p>


                  <div className="flex items-center gap-3 py-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Current colour:</span>
                    <button
                      onClick={() => setIsColorModalOpen(true)}
                      className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-gray-600 transition-transform hover:scale-110 shadow-sm cursor-pointer"
                      style={{ backgroundColor: userColor || '#ef4444' }}
                      title="Change colour"
                    />
                  </div>
                  <ColorPickerModal
                    isOpen={isColorModalOpen}
                    onClose={() => setIsColorModalOpen(false)}
                    currentColor={userColor}
                    onSelectColor={handleUserColorChange}
                  />
                </div>
              </section>

              {/* Show Offline Members Card (Sidebar Bento Card) */}
              <section className="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl p-6 transition-all duration-200 flex flex-col justify-between h-fit">
                <div>
                  <h3 className="font-semibold text-base text-slate-900 dark:text-gray-100 mb-1">Show Offline {memberLabel}</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">When disabled, {campaignLabel.toLowerCase()} {memberLabel.toLowerCase()} marked Offline are hidden from the sidebar.</p>
                </div>
                <div className="flex items-center justify-between mt-auto ">
                  <span className="text-xs font-medium text-slate-500 dark:text-gray-400">Sidebar Visibility</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      aria-label={`Show offline ${memberLabel.toLowerCase()} in ${memberLabel.toLowerCase()} list`}
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
        </div>
      </main>
    </div>
  )
}
