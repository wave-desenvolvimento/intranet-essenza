"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function RelatoriosError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Relatorios error:", error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle size={40} className="text-danger" />
      <h2 className="text-lg font-semibold text-ink-900">Erro ao carregar relatorios</h2>
      <p className="text-sm text-ink-500 max-w-md text-center">{error.message}</p>
      <button onClick={reset} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
        <RefreshCw size={14} /> Tentar novamente
      </button>
    </div>
  );
}
