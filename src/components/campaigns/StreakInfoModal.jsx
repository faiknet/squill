import { Card } from '../ui'

const CADENCE_INFO = {
  weekly: {
    label: 'Weekly',
    period: 'week',
    description: 'You have a weekly streak going. Keep your streak alive by updating a session each week.',
  },
  biweekly: {
    label: 'Biweekly',
    period: 'biweekly period',
    description: 'You have a biweekly streak going. Keep your streak alive by updating a session each two-week window.',
  },
  monthly: {
    label: 'Monthly',
    period: 'month',
    description: 'You have a monthly streak going. Keep your streak alive by updating a session each month.',
  },
}

function getCadenceDays(cadence) {
  if (cadence === 'biweekly') return 14
  if (cadence === 'monthly') return 28
  return 7
}

function getPeriodStart(dateStr, cadence) {
  const date = new Date(`${dateStr}T00:00:00.000Z`)
  const anchor = new Date('1970-01-05T00:00:00.000Z')
  const dayMs = 24 * 60 * 60 * 1000
  const periodDays = getCadenceDays(cadence)
  const offsetDays = Math.floor((date.getTime() - anchor.getTime()) / dayMs)
  const periodOffset = Math.floor(offsetDays / periodDays) * periodDays
  return new Date(anchor.getTime() + periodOffset * dayMs)
}

function getNextPeriodStart(periodStartDate, cadence) {
  const next = new Date(periodStartDate.getTime())
  next.setUTCDate(next.getUTCDate() + getCadenceDays(cadence))
  return next
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function getStreakStatus(campaign) {
  const cadence = campaign?.streak_cadence || 'weekly'
  const streakCount = campaign?.streak_count ?? 0
  const lastPeriod = campaign?.streak_last_period_start

  const today = new Date().toISOString().split('T')[0]
  const currentPeriodStart = getPeriodStart(today, cadence)
  const currentPeriodEnd = getNextPeriodStart(currentPeriodStart, cadence)
  // Subtract 1 day for inclusive end
  const currentPeriodEndInclusive = new Date(currentPeriodEnd.getTime() - 24 * 60 * 60 * 1000)
  const nextPeriodEnd = getNextPeriodStart(currentPeriodEnd, cadence)
  const nextPeriodEndInclusive = new Date(nextPeriodEnd.getTime() - 24 * 60 * 60 * 1000)

  if (streakCount <= 0 || !lastPeriod) {
    return {
      active: false,
      currentPeriodStart,
      currentPeriodEndInclusive,
      daysRemaining: null,
      renewedThisPeriod: false,
    }
  }

  const lastPeriodDate = getPeriodStart(lastPeriod, cadence)
  const renewedThisPeriod = lastPeriodDate.getTime() === currentPeriodStart.getTime()

  // If renewed this period, deadline is end of NEXT period
  // If not yet renewed, deadline is end of THIS period
  const deadlineEnd = renewedThisPeriod ? nextPeriodEndInclusive : currentPeriodEndInclusive

  const todayDate = new Date(`${today}T00:00:00.000Z`)
  const daysRemaining = Math.ceil((deadlineEnd.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000))

  return {
    active: true,
    currentPeriodStart,
    currentPeriodEndInclusive,
    deadlineEnd,
    daysRemaining,
    renewedThisPeriod,
  }
}

export default function StreakInfoModal({ isOpen, onClose, campaign }) {
  if (!isOpen || !campaign) return null

  const cadence = campaign.streak_cadence || 'weekly'
  const cadenceInfo = CADENCE_INFO[cadence] || CADENCE_INFO.weekly
  const streakCount = campaign.streak_count ?? 0
  const status = getStreakStatus(campaign)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <img src="/icons/streak.png" alt="" className="h-8 w-8 shrink-0" aria-hidden="true" loading="lazy" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100 tracking-tight">
              Activity Streak
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Current Streak */}
          <div className="flex items-center justify-center gap-3 py-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
            <img src="/icons/streak.png" alt="" className="h-10 w-10 shrink-0" aria-hidden="true" loading="lazy" />
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 leading-none">
                {streakCount > 0 ? streakCount : '—'}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                {streakCount > 0 ? `${cadenceInfo.period} streak` : 'No active streak'}
              </p>
            </div>
          </div>



          {/* How it works */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">How Streaks Work</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {cadenceInfo.description}
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Streak Actions
              </p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-gray-400">
                  <span className="text-brand-500 mt-0.5 shrink-0">•</span>
                  Creating a new session
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-gray-400">
                  <span className="text-brand-500 mt-0.5 shrink-0">•</span>
                  Making changes to a session
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-gray-400">
                  <span className="text-brand-500 mt-0.5 shrink-0">•</span>
                  Adding a journal entry
                </li>
              </ul>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <span className="font-semibold">Tip:</span> Any party member's action counts toward the streak. If no one takes a streak action within the next {cadenceInfo.period} after the current one, the streak resets to zero.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-gray-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-md hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </Card>
    </div>
  )
}
