export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${className}`}
      {...props}
    />
  )
}
