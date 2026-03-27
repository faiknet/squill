import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export function createMentionPlugin(onMention) {
  return new Plugin({
    key: new PluginKey('mention'),
    state: {
      init: () => ({
        active: false,
        query: '',
        position: null,
        suggestions: [],
      }),
      apply: (tr, value) => {
        const meta = tr.getMeta('mention')
        if (meta) {
          return meta
        }
        return value
      },
    },
    props: {
      handleKeyDown: (view, event) => {
        const state = this.getState(view.state)
        
        // Handle escape to close dropdown
        if (event.key === 'Escape' && state.active) {
          view.dispatch(view.state.tr.setMeta('mention', { active: false, query: '', position: null, suggestions: [] }))
          return true
        }

        // Handle arrow keys and enter for selection
        if (state.active) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            return true
          }
        }

        return false
      },
    },
  })
}
