// Simple content placeholder - TipTap would replace this
export default function EditorContent({ doc }) {
  // For now, render markdown-like content
  // In production, use @tiptap/react with StarterKit extension
  return (
    <div className="prose prose-invert max-w-none">
      <p className="text-gray-300">
        Start writing your session notes here...
      </p>
      <p className="text-gray-500 text-sm mt-4">
        • Use keyboard shortcuts for formatting (Ctrl+B, Ctrl+I, etc.)
      </p>
    </div>
  )
}
