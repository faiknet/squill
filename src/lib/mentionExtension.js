import { Mark } from '@tiptap/core'

export const MentionMark = Mark.create({
  name: 'mention',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, 'data-mention': true }, 0]
  },

  addAttributes() {
    return {
      type: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-type'),
        renderHTML: attributes => {
          return {
            'data-mention-type': attributes.type,
          }
        },
      },
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-id'),
        renderHTML: attributes => {
          return {
            'data-mention-id': attributes.id,
          }
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-label'),
        renderHTML: attributes => {
          return {
            'data-mention-label': attributes.label,
          }
        },
      },
      color: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-color'),
        renderHTML: attributes => {
          return {
            'data-mention-color': attributes.color,
          }
        },
      },
    }
  },
})
