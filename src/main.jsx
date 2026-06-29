import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LiveblocksProvider } from '@liveblocks/react'

import App from './App'
import { applyMentionColorPreferences } from './lib/mentionColorPreferences'
import { applyEnableReferenceIconsPreference } from './lib/sessionDisplayPreferences'
import './index.css'

const queryClient = new QueryClient()
const liveblocksPublicKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY
applyMentionColorPreferences()
applyEnableReferenceIconsPreference()

const rootElement = document.getElementById('root')
if (rootElement) {
  const appTree = (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>

  )

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {liveblocksPublicKey ? (
        <LiveblocksProvider publicApiKey={liveblocksPublicKey}>
          {appTree}
        </LiveblocksProvider>
      ) : (
        appTree
      )}
    </React.StrictMode>
  )
}
