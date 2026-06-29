import { useAchievements } from '../../hooks/useAchievements'
import { Modal } from '../ui'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function AchievementsModal({ isOpen, onClose }) {
  const { achievements, isLoading } = useAchievements()

  const earned = achievements.filter((a) => a.earned_at)
  const locked = achievements.filter((a) => !a.earned_at)

  const titleContent = (
    <div>
      <span className="text-lg font-bold text-slate-900 dark:text-gray-100 tracking-tight">Achievements</span>
      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 font-normal">
        {earned.length} of {achievements.length} earned
      </p>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titleContent} size="lg">
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center text-sm text-slate-500 dark:text-gray-400 py-8">Loading...</div>
        ) : achievements.length === 0 ? (
          <div className="text-center text-sm text-slate-500 dark:text-gray-400 py-8">No achievements available.</div>
        ) : (
          <>
            {earned.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3">Earned</p>
                <div className="space-y-2">
                  {earned.map((a) => (
                    <div
                      key={a.slug}
                      className="flex items-center gap-3 p-3 rounded-lg bg-brand-50/50 dark:bg-brand-900/15 border border-brand-200 dark:border-brand-900/30"
                    >
                      <span className="text-xl shrink-0">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{a.name}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{a.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Earned</span>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500">{formatDate(a.earned_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {locked.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3">Locked</p>
                <div className="space-y-2">
                  {locked.map((a) => (
                    <div
                      key={a.slug}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-gray-900/30 border border-slate-100 dark:border-gray-800/60 opacity-70"
                    >
                      <span className="text-xl shrink-0 opacity-50">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-600 dark:text-gray-400">{a.name}</p>
                        <p className="text-xs text-slate-400 dark:text-gray-500">{a.description}</p>
                        {a.progress > 0 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (a.progress / a.criteria_value) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-gray-500 shrink-0">{a.progress}/{a.criteria_value}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="border-t border-slate-200 dark:border-gray-700 pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-md hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
