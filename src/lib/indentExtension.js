import { Extension } from '@tiptap/core'

export const IndentExtension = Extension.create({
  name: 'indent',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Insert 4 spaces for indentation
        return this.editor.commands.insertContent('    ')
      },
      'Shift-Tab': () => {
        // Remove up to 4 spaces before cursor (outdent)
        const { state } = this.editor
        const { from } = state.selection
        const textBefore = state.doc.textBetween(Math.max(0, from - 4), from)
        
        // Count how many spaces to remove (up to 4)
        let spacesToRemove = 0
        for (let i = textBefore.length - 1; i >= 0; i--) {
          if (textBefore[i] === ' ') {
            spacesToRemove++
          } else {
            break
          }
        }
        
        if (spacesToRemove > 0) {
          const deleteFrom = from - Math.min(spacesToRemove, 4)
          this.editor.commands.deleteRange({ from: deleteFrom, to: from })
          return true
        }
        
        return false
      },
    }
  },
})
