export default function Button({ children, className = '', variant = 'primary', ...props }) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background px-4 py-3 md:py-2 min-h-[44px] md:min-h-0'
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
    outline: 'border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
    ghost: 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-gray-700 dark:hover:text-gray-100',
    link: 'text-slate-900 underline-offset-4 hover:underline dark:text-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600 dark:hover:bg-red-600',
  }

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
