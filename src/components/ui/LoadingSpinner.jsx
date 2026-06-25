import React from 'react'

export function LoadingSpinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="relative w-12 h-12">
        {/* Outer glowing track */}
        <div className="absolute inset-0 rounded-full border-4 border-slate-200/20 dark:border-gray-800/40"></div>
        {/* Spinning gradient arc */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 border-r-brand-500 animate-spin"></div>
      </div>
    </div>
  )
}
