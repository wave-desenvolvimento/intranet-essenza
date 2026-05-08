"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft mb-4">
        <AlertTriangle size={24} className="text-danger" />
      </div>
      <h2 className="text-lg font-semibold text-ink-900 mb-1">Erro ao carregar</h2>
      <p className="text-sm text-ink-500 mb-5 text-center max-w-xs">
        Não foi possível carregar esta página. Tente novamente.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
        >
          <RotateCcw size={14} /> Tentar novamente
        </button>
        <a
          href="/inicio"
          className="flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
        >
          <Home size={14} /> Início
        </a>
      </div>
    </div>
  );
}
