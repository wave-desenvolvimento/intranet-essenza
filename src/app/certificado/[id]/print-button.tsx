"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-brand-olive px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors print:hidden"
    >
      Imprimir ou salvar em PDF
    </button>
  );
}
