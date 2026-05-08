"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Database, Pencil, Trash2, X, FileText, Layers, Image,
  Megaphone, Folder, Search, Copy,
} from "lucide-react";
import { createCollection, updateCollection, deleteCollection, duplicateCollection } from "./actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

const ICON_MAP: Record<string, React.ElementType> = {
  folder: Folder, image: Image, megaphone: Megaphone, file: FileText, layers: Layers, database: Database,
};
const ICON_OPTIONS = [
  { value: "folder", label: "Pasta" }, { value: "image", label: "Imagem" }, { value: "megaphone", label: "Megafone" },
  { value: "file", label: "Arquivo" }, { value: "layers", label: "Camadas" }, { value: "database", label: "Banco" },
];

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  parent_id: string | null;
  is_group: boolean;
  view_type: string;
  fields: { id: string }[];
  items: { id: string }[];
}

export function CmsOverview({ collections }: { collections: Collection[] }) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("folder");
  const [parentId, setParentId] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [viewType, setViewType] = useState("table");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const groups = collections.filter((c) => c.is_group);
  const groupOptions = [
    { value: "", label: "Nenhum (raiz)" },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];
  const viewTypeOptions = [
    { value: "table", label: "Tabela" },
    { value: "gallery", label: "Galeria" },
    { value: "files", label: "Arquivos" },
    { value: "course", label: "Curso" },
  ];

  // Group collections: root (no parent, not group), then by group
  const rootCollections = collections.filter((c) => !c.parent_id && !c.is_group);
  const grouped = groups.map((g) => ({
    group: g,
    children: collections.filter((c) => c.parent_id === g.id),
  })).filter((g) => g.children.length > 0);

  function matchSearch(c: Collection) {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase());
  }

  function openCreate() { setEditing(null); setName(""); setDescription(""); setIcon("folder"); setParentId(""); setIsGroup(false); setViewType("table"); setError(""); setShowModal(true); }
  function openEdit(c: Collection) { setEditing(c); setName(c.name); setDescription(c.description || ""); setIcon(c.icon); setParentId(c.parent_id || ""); setIsGroup(c.is_group); setViewType(c.view_type || "table"); setError(""); setShowModal(true); }
  function close() { setShowModal(false); setEditing(null); setError(""); }

  function handleSave() {
    const fd = new FormData();
    fd.set("name", name); fd.set("description", description); fd.set("icon", icon);
    fd.set("parentId", parentId); fd.set("isGroup", String(isGroup)); fd.set("viewType", viewType);
    if (editing) {
      fd.set("id", editing.id);
      startTransition(async () => { const r = await updateCollection(fd); r?.error ? setError(r.error) : close(); });
    } else {
      startTransition(async () => { const r = await createCollection(fd); r?.error ? setError(r.error) : close(); });
    }
  }

  // Keyboard shortcuts for modal
  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { close(); return; }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") { e.preventDefault(); handleSave(); return; }
      if (mod && e.key === "Enter") { e.preventDefault(); handleSave(); return; }
      if (e.key === "Enter" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "TEXTAREA") return;
        e.preventDefault();
        handleSave();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function handleDuplicate(id: string) {
    startTransition(async () => { const r = await duplicateCollection(id); if (r?.error) setError(r.error); });
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({ title: "Remover collection", message: "Remover esta collection e todos os seus itens? Essa ação não pode ser desfeita.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteCollection(id); if (r?.error) setError(r.error); });
  }

  function renderRow(c: Collection) {
    const Icon = ICON_MAP[c.icon] || Folder;
    return (
      <Link key={c.id} href={`/cms/${c.slug}`} className="flex items-center gap-4 px-5 py-3 hover:bg-ink-50/50 transition-colors cursor-pointer">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-olive-soft">
          <Icon size={16} className="text-brand-olive" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink-900">{c.name}</p>
            <span className="text-[9px] font-mono text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded hidden sm:inline">{c.slug}</span>
          </div>
          {c.description && <p className="text-xs text-ink-400 truncate">{c.description}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-400 shrink-0 hidden md:flex">
          <span>{c.fields.length} campos</span>
          <span>{c.items.length} itens</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(c); }} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={13} /></button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(c.id); }} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Duplicar"><Copy size={13} /></button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(c.id); }} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={13} /></button>
        </div>
      </Link>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">CMS</h1>
          <p className="text-sm text-ink-500">{collections.filter((c) => !c.is_group).length} coleções · {collections.filter((c) => c.is_group).length} sessões</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
          <Plus size={16} /> Nova Coleção
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 max-w-xs mb-4">
        <Search size={14} className="text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar coleção..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
      </div>

      {error && !showModal && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Root collections */}
      {rootCollections.filter(matchSearch).length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1 mb-2">Coleções</p>
          <div className="rounded-xl border border-ink-100 bg-white overflow-hidden divide-y divide-ink-50">
            {rootCollections.filter(matchSearch).map(renderRow)}
          </div>
        </div>
      )}

      {/* Grouped collections */}
      {grouped.map(({ group, children }) => {
        const filteredChildren = children.filter(matchSearch);
        if (filteredChildren.length === 0 && !matchSearch(group)) return null;

        return (
          <div key={group.id} className="mb-4">
            <div className="flex items-center gap-2 px-1 mb-2">
              <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{group.name}</p>
              <button onClick={() => openEdit(group)} className="rounded-md p-0.5 text-ink-300 hover:text-ink-500 transition-colors" title="Editar seção">
                <Pencil size={10} />
              </button>
            </div>
            <div className="rounded-xl border border-ink-100 bg-white overflow-hidden divide-y divide-ink-50">
              {filteredChildren.map(renderRow)}
            </div>
          </div>
        );
      })}

      {collections.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-20">
          <Database size={36} className="text-ink-300 mb-3" />
          <p className="text-sm text-ink-500">Nenhuma coleção</p>
          <button onClick={openCreate} className="mt-2 text-sm font-medium text-brand-olive">Criar primeira</button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={close}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-modal p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-ink-900">{editing ? "Editar Coleção" : "Nova Coleção"}</h2>
              <button onClick={close} className="rounded-md p-1 text-ink-400 hover:text-ink-700"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Ex: Banners..." />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-ink-700 mb-2 block">Ícone</label>
                <div className="flex gap-2">
                  {ICON_OPTIONS.map((o) => { const I = ICON_MAP[o.value] || Folder; return (
                    <button key={o.value} type="button" onClick={() => setIcon(o.value)} className={cn("flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors", icon === o.value ? "border-brand-olive bg-brand-olive-soft text-brand-olive" : "border-ink-100 text-ink-400 hover:border-ink-200")} title={o.label}><I size={18} /></button>
                  ); })}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} className="sr-only" />
                <div className={cn("flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors", isGroup ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>
                  {isGroup && <span className="text-white text-[9px] font-bold">✓</span>}
                </div>
                <span className="text-sm text-ink-700">É uma seção</span>
              </label>
              {!isGroup && (
                <>
                  <div>
                    <label className="text-sm font-medium text-ink-700 mb-1.5 block">Visualização</label>
                    <CustomSelect options={viewTypeOptions} value={viewType} onChange={setViewType} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-ink-700 mb-1.5 block">Seção</label>
                    <CustomSelect options={groupOptions} value={parentId} onChange={setParentId} placeholder="Nenhuma" />
                  </div>
                </>
              )}
              {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={isPending || !name} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}</button>
                <button onClick={close} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
              </div>
              <div className="flex items-center gap-3 pt-2 text-[10px] text-ink-400">
                <span><kbd className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[9px]">Esc</kbd> fechar</span>
                <span><kbd className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[9px]">⌘S</kbd> salvar</span>
                <span><kbd className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[9px]">Enter</kbd> salvar</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
