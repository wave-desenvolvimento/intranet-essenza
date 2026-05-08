"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Quote, Undo, Redo, Smile,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const EMOJI_LIST = [
  "😀", "😂", "😍", "🥰", "😎", "🤩", "🔥", "✨", "💎", "🎉",
  "❤️", "💚", "💛", "🧡", "💜", "🤍", "🖤", "💪", "👏", "🙌",
  "⭐", "🌟", "🌿", "🍃", "🌸", "🌺", "🌻", "☕", "🍷", "🥂",
  "🎁", "🎀", "💐", "🕯️", "🏷️", "📦", "📸", "🛍️", "🏪", "✅",
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiBtnRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [emojiPos, setEmojiPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (showEmoji && emojiBtnRef.current) {
      const rect = emojiBtnRef.current.getBoundingClientRect();
      const pickerWidth = 272;
      let left = rect.left;
      if (left + pickerWidth > window.innerWidth - 8) {
        left = window.innerWidth - pickerWidth - 8;
      }
      setEmojiPos({ top: rect.bottom + 4, left });
    }
  }, [showEmoji]);

  useEffect(() => {
    if (!showEmoji) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        emojiBtnRef.current && !emojiBtnRef.current.contains(target) &&
        emojiPickerRef.current && !emojiPickerRef.current.contains(target)
      ) {
        setShowEmoji(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmoji]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || "Escreva aqui..." }),
      Link.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2.5 min-h-[120px] focus:outline-none text-ink-900",
      },
    },
  });

  if (!editor) return null;

  function addLink() {
    const url = prompt("URL do link:");
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }

  function insertEmoji(emoji: string) {
    editor?.chain().focus().insertContent(emoji).run();
    setShowEmoji(false);
  }

  return (
    <div className="relative rounded-lg border border-ink-100 bg-white focus-within:border-brand-olive focus-within:ring-2 focus-within:ring-brand-olive/10 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-ink-100 bg-ink-50/30">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><Bold size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><Italic size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado"><UnderlineIcon size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado"><Strikethrough size={14} /></ToolbarButton>

        <div className="w-px h-5 bg-ink-200 mx-1" />

        <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1"><Heading1 size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2"><Heading2 size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3"><Heading3 size={14} /></ToolbarButton>

        <div className="w-px h-5 bg-ink-200 mx-1" />

        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote size={14} /></ToolbarButton>

        <div className="w-px h-5 bg-ink-200 mx-1" />

        <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Alinhar esquerda"><AlignLeft size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centralizar"><AlignCenter size={14} /></ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Alinhar direita"><AlignRight size={14} /></ToolbarButton>

        <div className="w-px h-5 bg-ink-200 mx-1" />

        <ToolbarButton active={editor.isActive("link")} onClick={addLink} title="Link"><LinkIcon size={14} /></ToolbarButton>

        <div ref={emojiBtnRef}>
          <ToolbarButton active={showEmoji} onClick={() => setShowEmoji(!showEmoji)} title="Emoji"><Smile size={14} /></ToolbarButton>
        </div>

        <div className="flex-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo size={14} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo size={14} /></ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Emoji picker via portal */}
      {showEmoji && createPortal(
        <div
          ref={emojiPickerRef}
          className="fixed z-[300] rounded-lg border border-ink-100 bg-white shadow-dropdown p-2 w-[272px]"
          style={{ top: emojiPos.top, left: emojiPos.left }}
        >
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJI_LIST.map((emoji) => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="flex h-7 w-7 items-center justify-center rounded hover:bg-ink-50 text-base">
                {emoji}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ToolbarButton({ children, active, onClick, title }: { children: React.ReactNode; active?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active ? "bg-brand-olive/10 text-brand-olive" : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
      )}
    >
      {children}
    </button>
  );
}
