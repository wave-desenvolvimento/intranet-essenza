"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useModKey } from "@/hooks/use-platform";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  title?: string;
  wide?: boolean;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, onSubmit, title, wide, children }: SheetProps) {
  const mod = useModKey();
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === "s" && onSubmit) {
      e.preventDefault();
      onSubmit();
      return;
    }

    if (mod && e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
      return;
    }

    if (e.key === "Enter" && onSubmit) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isRichText = (e.target as HTMLElement)?.closest?.(".ProseMirror");
      if (tag === "TEXTAREA" || isRichText) return;
      if (e.shiftKey) return;
      e.preventDefault();
      onSubmit();
    }
  }, [onClose, onSubmit]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
      return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", handleKeyDown); };
    }
    document.body.style.overflow = "";
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className={cn(
              "absolute right-0 top-0 h-full bg-white shadow-modal flex flex-col",
              wide ? "w-full max-w-2xl" : "w-full max-w-lg"
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 shrink-0">
                <h2 className="text-base font-semibold text-ink-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {/* Keyboard hints */}
            <div className="shrink-0 px-6 py-2 border-t border-ink-50 items-center gap-3 text-[10px] text-ink-400 hidden md:flex">
              <span><kbd className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[9px]">Esc</kbd> fechar</span>
              {onSubmit && (
                <>
                  <span><kbd className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[9px]">{mod}S</kbd> salvar</span>
                  <span><kbd className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[9px]">{mod}↵</kbd> salvar</span>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
