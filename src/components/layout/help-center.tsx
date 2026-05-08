"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  HelpCircle, BookOpen, PlayCircle, MessageCircle, X,
  ShoppingCart, Image, FileText, GraduationCap, Palette,
  LayoutDashboard, Shield, Building2, BarChart3, Stamp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useGuidedTour } from "./guided-tour";

interface HelpTopic {
  icon: React.ElementType;
  title: string;
  description: string;
  module?: string; // filter by permission
}

const HELP_TOPICS: HelpTopic[] = [
  {
    icon: LayoutDashboard,
    title: "Início",
    description: "Sua página inicial com banners, favoritos e materiais recentes. Marque itens com estrela para acesso rápido.",
  },
  {
    icon: Image,
    title: "Galeria de Materiais",
    description: "Navegue pelos materiais da marca. Use filtros e busca para encontrar o que precisa. Clique em 'Ver' para ampliar, baixe em diferentes formatos ou compartilhe via WhatsApp.",
  },
  {
    icon: FileText,
    title: "Arquivos e Documentos",
    description: "Acesse PDFs, documentos e arquivos da marca. Baixe diretamente ou visualize no navegador.",
  },
  {
    icon: GraduationCap,
    title: "Treinamentos",
    description: "Assista aos cursos e treinamentos da rede. O progresso é salvo automaticamente — continue de onde parou a qualquer momento.",
  },
  {
    icon: ShoppingCart,
    title: "Pedidos",
    description: "Faça pedidos de produtos: navegue pelo catálogo, adicione ao carrinho, inclua observações e envie. Acompanhe o status na aba Histórico.",
    module: "pedidos",
  },
  {
    icon: Stamp,
    title: "Templates",
    description: "Baixe materiais personalizados com os dados da sua franquia. O sistema preenche automaticamente nome, telefone, endereço e gera QR Codes.",
    module: "templates",
  },
  {
    icon: Palette,
    title: "CMS — Gerenciador de Conteúdo",
    description: "Crie e gerencie coleções (banners, materiais, campanhas). Defina campos, faça upload de arquivos, publique e agende conteúdo.",
    module: "cms",
  },
  {
    icon: Building2,
    title: "Franquias",
    description: "Gerencie franquias da rede: cadastro completo com endereço, contato e redes sociais. Convide usuários e defina permissões.",
    module: "franquias",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    description: "Acompanhe visualizações e downloads por material e por franquia. Identifique os conteúdos mais acessados.",
    module: "analytics",
  },
  {
    icon: Shield,
    title: "Permissões",
    description: "Configure tipos de acesso com permissões granulares por módulo. Defina escopo (Sistema/Franquia) e nível hierárquico.",
    module: "configuracoes",
  },
];

const SHORTCUTS = [
  { keys: "⌘K", label: "Buscar" },
  { keys: "⌘S", label: "Salvar formulário" },
  { keys: "⌘↵", label: "Salvar (textarea)" },
  { keys: "Esc", label: "Fechar modal/sheet" },
];

export function HelpCenter() {
  const [open, setOpen] = useState(false);
  const { canModule } = usePermissions();
  const { startTour } = useGuidedTour();
  const panelRef = useRef<HTMLDivElement>(null);

  const visibleTopics = HELP_TOPICS.filter((t) => !t.module || canModule(t.module));

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleStartTour() {
    setOpen(false);
    // Small delay to let panel close before tour starts
    setTimeout(() => startTour(), 300);
  }

  return (
    <div className="relative" ref={panelRef} data-tour="help">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
        title="Ajuda"
      >
        <HelpCircle size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-ink-100 bg-white shadow-dropdown z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-ink-50/30">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Central de Ajuda</h3>
              <p className="text-[10px] text-ink-500"><span className="hidden md:inline">Guias e atalhos do sistema</span><span className="md:hidden">Guias do sistema</span></p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-400 hover:text-ink-700">
              <X size={14} />
            </button>
          </div>

          {/* Tour button */}
          <div className="px-4 py-3 border-b border-ink-100">
            <button
              onClick={handleStartTour}
              className="flex items-center gap-3 w-full rounded-xl bg-brand-olive-soft px-4 py-3 hover:bg-brand-olive/10 transition-colors text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-olive text-white">
                <PlayCircle size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-brand-olive-dark">Fazer tour guiado</p>
                <p className="text-[10px] text-ink-500">Passeio interativo por todas as funcionalidades</p>
              </div>
            </button>
          </div>

          {/* Topics */}
          <div className="max-h-72 overflow-y-auto">
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Módulos</p>
            {visibleTopics.map((topic) => (
              <div key={topic.title} className="px-4 py-2.5 hover:bg-ink-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-50 mt-0.5">
                    <topic.icon size={13} className="text-ink-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-900">{topic.title}</p>
                    <p className="text-[10px] text-ink-500 leading-relaxed mt-0.5">{topic.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Shortcuts — desktop only */}
          <div className="border-t border-ink-100 px-4 py-3 bg-ink-50/30 hidden md:block">
            <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Atalhos do teclado</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center gap-2 text-[10px]">
                  <kbd className="rounded bg-white border border-ink-200 px-1.5 py-0.5 font-mono text-[9px] text-ink-600">{s.keys}</kbd>
                  <span className="text-ink-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-ink-100 px-4 py-2.5 flex items-center justify-between">
            <a href="mailto:suporte@emporioessenza.com.br" className="flex items-center gap-1.5 text-[10px] font-medium text-brand-olive hover:text-brand-olive-dark transition-colors">
              <MessageCircle size={11} /> Falar com suporte
            </a>
            <span className="text-[9px] text-ink-300">Essenza Hub v1.0</span>
          </div>
        </div>
      )}
    </div>
  );
}
