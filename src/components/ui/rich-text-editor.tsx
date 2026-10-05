'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={cn(
        'p-1.5 rounded text-sm transition-colors',
        active ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
      )}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[160px] px-4 py-3 text-zinc-700 focus:outline-none',
      },
    },
    immediatelyRender: false,
  })

  // Sync external value changes (e.g. when switching modules)
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-red-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-100 bg-zinc-50 flex-wrap">
        <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-zinc-200 mx-1" />
        <ToolbarButton title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-zinc-200 mx-1" />
        <ToolbarButton title="Bullet List" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Numbered List" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-zinc-200 mx-1" />
        <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="relative bg-white">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-3 left-4 text-zinc-400 text-sm pointer-events-none">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>

      {/* Style overrides for content inside editor */}
      <style>{`
        .ProseMirror h2 { font-size: 1rem; font-weight: 700; margin: 0.75rem 0 0.4rem; color: #18181b; }
        .ProseMirror h3 { font-size: 0.875rem; font-weight: 600; margin: 0.6rem 0 0.3rem; color: #27272a; }
        .ProseMirror p { margin-bottom: 0.5rem; line-height: 1.6; }
        .ProseMirror ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .ProseMirror li { margin-bottom: 0.2rem; }
        .ProseMirror strong { font-weight: 600; color: #18181b; }
        .ProseMirror em { font-style: italic; }
        .ProseMirror hr { border: none; border-top: 1px solid #e4e4e7; margin: 0.75rem 0; }
        .ProseMirror:focus { outline: none; }
      `}</style>
    </div>
  )
}
