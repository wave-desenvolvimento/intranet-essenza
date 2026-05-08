import Link from "next/link";
import { Home } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4">
      <BrandLogo width={80} height={40} />

      <div className="mt-10 text-center max-w-sm">
        <p className="text-7xl font-bold text-ink-100 mb-4">404</p>
        <h1 className="text-xl font-semibold text-ink-900 mb-2">Página não encontrada</h1>
        <p className="text-sm text-ink-500 mb-8">
          A página que você procura não existe ou foi movida.
        </p>
        <Link
          href="/inicio"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-olive px-6 py-3 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
        >
          <Home size={14} /> Ir ao Início
        </Link>
      </div>

      <p className="mt-16 text-[10px] text-ink-300">
        © {new Date().getFullYear()} Empório Essenza Serra Gaúcha
      </p>
    </div>
  );
}
