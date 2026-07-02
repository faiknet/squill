import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
    },
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
    } : {},
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('react-dom')) {
                return 'vendor'
              }
              if (id.includes('supabase')) {
                return 'supabase'
              }
              if (id.includes('react-query') || id.includes('@tanstack')) {
                return 'query'
              }
            }
            if (id.includes('@react-pdf/renderer') || id.includes('react-pdf-html')) {
              return 'pdf-export'
            }
            if (id.includes('html-docx-js-typescript')) {
              return 'docx-export'
            }
            if (id.includes('odf-kit')) {
              return 'odt-export'
            }
            if (id.includes('@tiptap/react') || id.includes('@tiptap/starter-kit') || id.includes('@tiptap/extension-underline') ||
                id.includes('@tiptap/extension-link') || id.includes('@tiptap/extension-color') || id.includes('@tiptap/extension-highlight') ||
                id.includes('@tiptap/extension-text-align') || id.includes('@tiptap/extension-text-style') ||
                id.includes('@tiptap/extension-font-family') || id.includes('@tiptap/extension-image') ||
                id.includes('tiptap-extension-resize-image')) {
              return 'editor'
            }
            if (id.includes('@liveblocks/react') || id.includes('@liveblocks/yjs')) {
              return 'liveblocks'
            }
          }
        }
      }
    }
  }
})
