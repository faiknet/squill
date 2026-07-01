import { useState, useEffect, useRef } from 'react'

const MESSAGES = [
  'Putting pen to paper...',
  'Refilling your inkwell...',
  'Getting fresh paper...',
  'Feeding Squillbert...',
  'Making the pen mightier than the sword...',
]

export function LoadingSpinner({ className = '' }) {
  const [message, setMessage] = useState(() =>
    MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  )
  const [stalled, setStalled] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => setStalled(true), 10000)
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center gap-4 p-4 bg-gray-50 dark:bg-gray-950 ${className}`}>
      {!stalled && <div className="custom-loader" />}
      <p className="text-sm text-slate-500 dark:text-gray-400 animate-pulse">
        {stalled
          ? 'This is taking longer than anticipated, please hold on...'
          : message}
      </p>
    </div>
  )
}
