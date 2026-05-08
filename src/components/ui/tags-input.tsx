"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagsInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TagsInput({ value, onChange, placeholder }: TagsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = value ? value.split(",").map((t) => t.trim()).filter(Boolean) : [];

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const next = [...tags, trimmed].join(", ");
    onChange(next);
    setInputValue("");
  }

  function removeTag(index: number) {
    const next = tags.filter((_, i) => i !== index).join(", ");
    onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-100 bg-white px-2.5 py-2 min-h-[40px] focus-within:border-brand-olive focus-within:ring-2 focus-within:ring-brand-olive/10 transition-colors cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-md bg-brand-olive-soft px-2 py-0.5 text-xs font-medium text-brand-olive-dark"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
            className="rounded-sm hover:bg-brand-olive/20 transition-colors p-0.5"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue) addTag(inputValue); }}
        placeholder={tags.length === 0 ? (placeholder || "Digite e pressione vírgula...") : ""}
        className="flex-1 min-w-[80px] bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
      />
    </div>
  );
}
