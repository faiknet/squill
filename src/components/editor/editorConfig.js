import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import ResizableImage from 'tiptap-extension-resize-image'
import Collaboration from '@tiptap/extension-collaboration'
import FontFamily from '@tiptap/extension-font-family'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { MentionMark } from '../../lib/mentionMark'
import { FontSize } from '../../lib/fontSizeExtension'
import { IndentExtension } from '../../lib/indentExtension'

export function getEditorExtensions({ collaborative = false, ydoc } = {}) {
  const extensions = [
    StarterKit.configure({ 
      history: !collaborative, 
      heading: { levels: [1, 2, 3, 4] } 
    }),
    Underline,
    Link.configure({
      openOnClick: false,
    }),
    ResizableImage,
    MentionMark,
    FontFamily,
    TextStyle,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    IndentExtension,
  ]

  if (collaborative && ydoc) {
    extensions.push(Collaboration.configure({ document: ydoc }))
  }

  return extensions
}
