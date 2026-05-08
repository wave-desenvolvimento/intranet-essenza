"use client";

import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", destructive, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-white shadow-modal p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <button onClick={onCancel} className="rounded-md p-1 text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>
        <p className="text-sm text-ink-500 mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${destructive ? "bg-danger text-white hover:bg-danger/90" : "bg-brand-olive text-white hover:bg-brand-olive-dark"}`}
          >
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
