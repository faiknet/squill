export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-divider dark:border-gray-700 rounded-lg shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
}
