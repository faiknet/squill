import { Button, Card } from './'

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

export default function ColorPickerModal({ isOpen, onClose, currentColor, onSelectColor }) {
  if (!isOpen) return null

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300"
    >
      <Card 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-2xl rounded-2xl overflow-hidden transform scale-100 transition-all"
      >
        <div className="border-b border-slate-100 dark:border-gray-700 p-5 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-gray-100 tracking-tight">Pick a Colour</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Choose your presence and cursor color.</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-5 gap-3">
            {USER_COLOR_OPTIONS.map((option) => {
              const isSelected = currentColor === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    onSelectColor(option.value)
                    onClose()
                  }}
                  className={`relative group w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm mx-auto ${
                    isSelected 
                      ? 'border-slate-800 ring-2 ring-slate-800/20 scale-105 dark:border-white dark:ring-white/20' 
                      : 'border-transparent hover:border-slate-300 dark:hover:border-gray-600'
                  }`}
                  style={{ backgroundColor: option.value }}
                  title={option.label}
                >
                  {isSelected && (
                    <svg className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className="absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-md font-medium">
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
          
          <div className="flex justify-end gap-2.5 pt-6 mt-4 border-t border-slate-100 dark:border-gray-700/50">
            <Button 
              variant="outline" 
              type="button" 
              onClick={onClose} 
              className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs font-semibold px-4 py-2 min-h-[36px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
