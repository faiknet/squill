import { Mark } from '@tiptap/core'

const mentionRenderCache = new Map()

export const MentionMark = Mark.create({
  name: 'mention',
  
  inclusive: false,
  
  addAttributes() {
    return {
      mentionType: {
        default: '',
        parseHTML: element => element.getAttribute('data-mention-type'),
        renderHTML: attributes => ({
          'data-mention-type': attributes.mentionType,
        }),
      },
      mentionEntityType: {
        default: '',
        parseHTML: element => element.getAttribute('data-mention-entity-type'),
        renderHTML: attributes => ({
          'data-mention-entity-type': attributes.mentionEntityType,
        }),
      },
      mentionId: {
        default: '',
        parseHTML: element => element.getAttribute('data-mention-id'),
        renderHTML: attributes => ({
          'data-mention-id': attributes.mentionId,
        }),
      },
      mentionLabel: {
        default: '',
        parseHTML: element => element.getAttribute('data-mention-label'),
        renderHTML: attributes => ({
          'data-mention-label': attributes.mentionLabel,
        }),
      },
      mentionColor: {
        default: '',
        parseHTML: element => element.getAttribute('data-mention-color'),
        renderHTML: attributes => {
          const key = `${attributes.mentionType || ''}:${attributes.mentionId || ''}:${attributes.mentionColor || ''}`
          if (mentionRenderCache.has(key)) {
            return mentionRenderCache.get(key)
          }
          const result = {
            'data-mention-color': attributes.mentionColor,
            class: attributes.mentionType === 'user' && attributes.mentionId 
              ? `mention-user-${attributes.mentionId}` 
              : null,
            style: attributes.mentionColor ? `color: ${attributes.mentionColor}; font-weight: bold;` : null,
            spellcheck: 'false',
          }
          mentionRenderCache.set(key, result)
          return result
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention-type]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },
})
