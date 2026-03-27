import React from 'react'

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

export default function ColorPickerOverlay({ userColor, setUserColor, effectiveUserColor }) {
  return (
    <div className="px-4 py-3 md:px-6 md:py-4 bg-white dark:bg-gray-800 border-t border-slate-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-3 transition-colors duration-200">
      <span className="text-sm text-slate-500 dark:text-gray-400 font-medium whitespace-nowrap">Your cursor color:</span>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {USER_COLOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setUserColor(option.value)}
            className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-transform hover:scale-110 shrink-0 ${
              effectiveUserColor === option.value ? 'border-slate-900 ring-2 ring-slate-900/20 dark:border-white dark:ring-white/20' : 'border-transparent'
            }`}
            style={{ backgroundColor: option.value }}
            title={option.label}
          />
        ))}
        {userColor && (
          <button
            type="button"
            onClick={() => setUserColor('')}
            className="ml-2 text-xs text-slate-500 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300 underline whitespace-nowrap"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
