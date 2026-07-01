import AppRoutes from './routes'
import { supabase } from './lib/supabase'
import { Card } from './components/ui'
import { DarkModeProvider } from './components/DarkModeProvider'
import BypassApp from './dev/BypassApp'

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true'

export default function App() {
  if (BYPASS_AUTH) {
    return <BypassApp />
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full bg-gray-800 border-gray-700">
          <h1 className="text-2xl font-bold mb-2">Supabase configuration required</h1>
          <p className="text-gray-300 mb-2">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file.
          </p>
          <p className="text-xs text-gray-500">
            After updating <code>.env</code>, restart <code>npm run dev</code>.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <DarkModeProvider>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-md focus:text-sm focus:font-semibold">
        Skip to content
      </a>
      <AppRoutes />
    </DarkModeProvider>
  )
}
