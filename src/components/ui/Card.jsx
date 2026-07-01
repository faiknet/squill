import { forwardRef } from 'react'

const Card = forwardRef(function Card({ children, className = '', ...props }, ref) {
  return (
    <div ref={ref} className={`bg-white dark:bg-gray-800 border border-divider dark:border-gray-700 rounded-lg shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
})

export default Card
