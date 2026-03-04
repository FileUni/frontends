import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { 
  Bold, Italic, List, ListOrdered, Link as LinkIcon, 
  Table as TableIcon, Image as ImageIcon, Undo, Redo, 
  Eraser, Quote
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';

interface Props {
  content: string;
  onChange: (html: string) => void;
  isDark: boolean;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setLink = () => {
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  const btnClass = "p-1.5 rounded-md hover:bg-muted transition-all";
  const activeClass = "bg-primary/20 text-primary";

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 mb-2 border-b border-border/40 bg-muted/5">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={cn(btnClass, editor.isActive('bold') && activeClass)}><Bold size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={cn(btnClass, editor.isActive('italic') && activeClass)}><Italic size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cn(btnClass, editor.isActive('blockquote') && activeClass)}><Quote size={16} /></button>
      <div className="w-px h-4 bg-border/40 mx-1" />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn(btnClass, editor.isActive('bulletList') && activeClass)}><List size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn(btnClass, editor.isActive('orderedList') && activeClass)}><ListOrdered size={16} /></button>
      <div className="w-px h-4 bg-border/40 mx-1" />
      <button onClick={setLink} className={cn(btnClass, editor.isActive('link') && activeClass)}><LinkIcon size={16} /></button>
      <button onClick={addImage} className={btnClass}><ImageIcon size={16} /></button>
      <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={btnClass}><TableIcon size={16} /></button>
      <div className="w-px h-4 bg-border/40 mx-1" />
      <button onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={btnClass}><Eraser size={16} /></button>
      <div className="flex-1" />
      <button onClick={() => editor.chain().focus().undo().run()} className={btnClass}><Undo size={16} /></button>
      <button onClick={() => editor.chain().focus().redo().run()} className={btnClass}><Redo size={16} /></button>
    </div>
  );
};

export const EmailRichEditor: React.FC<Props> = ({ content, onChange, isDark }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-4 custom-scrollbar',
      },
    },
  });

  // Sync content if changed from outside (e.g. Reply)
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className={cn(
      "border border-input rounded-xl overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary/30 transition-all",
      isDark ? "dark" : ""
    )}>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
      
      <style>{`
        .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; overflow: hidden; }
        .ProseMirror td, .ProseMirror th { min-width: 1em; border: 1px solid #ddd; padding: 3px 5px; vertical-align: top; box-sizing: border-box; position: relative; }
        .ProseMirror th { font-weight: bold; text-align: left; background-color: rgba(0,0,0,0.05); }
        .dark .ProseMirror td, .dark .ProseMirror th { border-color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};
