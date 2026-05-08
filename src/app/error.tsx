"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-soft">
            <AlertTriangle size={28} className="text-danger" />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-ink-900 mb-2">Algo deu errado</h1>
        <p className="text-sm text-ink-500 mb-6">
          Ocorreu um erro inesperado. Tente novamente ou volte ao início.
        </p>
        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl bg-brand-olive px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
          >
            <RotateCcw size={14} /> Tentar novamente
          </button>
          <a
            href="/inicio"
            className="flex items-center gap-2 rounded-xl border border-ink-200 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
          >
            <Home size={14} /> Início
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-[10px] text-ink-300 font-mono">Ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
