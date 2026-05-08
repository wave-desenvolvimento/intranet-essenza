"use client";

import { useState, useTransition } from "react";
import {
  Plus, Pencil, Trash2, X, FileText, Layers, Image, Megaphone,
  Folder, Database, ArrowRight, Copy,
} from "lucide-react";
import { createPage, updatePage, deletePage, duplicatePage } from "./pages-actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { IconPicker, getIconComponent } from "@/components/ui/icon-picker";

const ICON_MAP: Record<string, React.ElementType> = {
  folder: Folder, image: Image, megaphone: Megaphone, file: FileText, layers: Layers, database: Database,
};
const VIEW_TYPE_OPTIONS = [
  { value: "table", label: "Tabela" }, { value: "gallery", label: "Galeria" },
  { value: "files", label: "Arquivos" }, { value: "course", label: "Curso" },
];
const ROLE_OPTIONS = [
  { value: "main", label: "Principal" }, { value: "filter", label: "Filtro" }, { value: "secondary", label: "Secundária" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Page { [key: string]: any; }
interface Collection { id: string; name: string; slug: string; is_group: boolean; }

interface Props {
  pages: Page[];
  collections: Collection[];
}

interface LinkedCollection {
  collectionId: string;
  role: string;
}

export function PagesManager({ pages, collections }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("file");
  const [viewType, setViewType] = useState("table");
  const [parentId, setParentId] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [linkedCollections, setLinkedCollections] = useState<LinkedCollection[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const groupPages = pages.filter((p) => p.is_group);
  const groupOptions = [{ value: "", label: "Nenhum (raiz)" }, ...groupPages.map((p) => ({ value: p.id, label: p.title }))];
  const availableCollections = collections.filter((c) => !c.is_group);
  const collectionOptions = availableCollections.map((c) => ({ value: c.id, label: c.name }));

  function slugify(t: string) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-"); }

  function openCreate(asGroup = false) {
    setEditing(null); setTitle(""); setSlug(""); setIcon(asGroup ? "folder" : "file"); setViewType("table");
    setParentId(""); setIsGroup(asGroup); setLinkedCollections([]);
    setError(""); setShowSheet(true);
  }

  function openEdit(p: Page) {
    setEditing(p); setTitle(p.title); setSlug(p.slug); setIcon(p.icon); setViewType(p.view_type);
    setParentId(p.parent_id || ""); setIsGroup(p.is_group);
    setLinkedCollections(
      (p.page_collections || []).map((pc: { collection_id: string; role: string }) => ({
        collectionId: pc.collection_id,
        role: pc.role,
      }))
    );
    setError(""); setShowSheet(true);
  }

  function closeSheet() { setShowSheet(false); setEditing(null); }

  function addLinkedCollection() {
    setLinkedCollections((prev) => [...prev, { collectionId: "", role: "main" }]);
  }

  function removeLinkedCollection(index: number) {
    setLinkedCollections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLinkedCollection(index: number, field: "collectionId" | "role", value: string) {
    setLinkedCollections((prev) => prev.map((lc, i) => i === index ? { ...lc, [field]: value } : lc));
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("title", title); fd.set("slug", slug || slugify(title));
    fd.set("icon", icon); fd.set("viewType", viewType);
    fd.set("parentId", parentId); fd.set("isGroup", String(isGroup));
    linkedCollections.filter((lc) => lc.collectionId).forEach((lc) => {
      fd.append("collectionIds", lc.collectionId);
      fd.append("collectionRoles", lc.role);
    });
    if (editing) {
      fd.set("id", editing.id);
      startTransition(async () => { const r = await updatePage(fd); r?.error ? setError(r.error) : closeSheet(); });
    } else {
      startTransition(async () => { const r = await createPage(fd); r?.error ? setError(r.error) : closeSheet(); });
    }
  }

  function handleDuplicate(id: string) {
    startTransition(async () => { const r = await duplicatePage(id); if (r?.error) setError(r.error); });
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({ title: "Remover página", message: "Tem certeza que deseja remover esta página?", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deletePage(id); if (r?.error) setError(r.error); });
  }

  // Organize by groups
  const rootPages = pages.filter((p) => !p.parent_id && !p.is_group);
  const grouped = groupPages.map((g) => ({
    group: g,
    children: pages.filter((p) => p.parent_id === g.id),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Pages</h1>
          <p className="text-sm text-ink-500">Navegação e layout das páginas do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => openCreate(true)} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            <Plus size={14} /> Nova Seção
          </button>
          <button onClick={() => openCreate(false)} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
            <Plus size={16} /> Nova Página
          </button>
        </div>
      </div>

      {error && !showSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Root pages */}
      {rootPages.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1 mb-2">Sem seção</p>
          <div className="rounded-xl border border-ink-100 bg-white overflow-hidden divide-y divide-ink-50">
            {rootPages.map((p) => renderPageRow(p))}
          </div>
        </div>
      )}

      {/* Grouped */}
      {grouped.map(({ group, children }) => (
        <div key={group.id} className="mb-4">
          <div className="flex items-center gap-2 px-1 mb-2">
            <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{group.title}</p>
            <button onClick={() => openEdit(group)} className="rounded-md p-0.5 text-ink-300 hover:text-ink-500" title="Editar seção"><Pencil size={10} /></button>
            <button onClick={() => handleDelete(group.id)} disabled={isPending} className="rounded-md p-0.5 text-ink-300 hover:text-danger" title="Remover"><Trash2 size={10} /></button>
          </div>
          {children.length > 0 ? (
            <div className="rounded-xl border border-ink-100 bg-white overflow-hidden divide-y divide-ink-50">
              {children.map((p) => renderPageRow(p))}
            </div>
          ) : (
            <p className="text-xs text-ink-400 px-4 py-3">Nenhuma page neste grupo</p>
          )}
        </div>
      ))}

      {pages.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <p className="text-sm text-ink-400">Nenhuma página</p>
          <button onClick={() => openCreate()} className="mt-2 text-sm font-medium text-brand-olive">Criar primeira</button>
        </div>
      )}

      {/* Sheet */}
      <Sheet open={showSheet} onClose={closeSheet} onSubmit={handleSave} title={editing ? (isGroup ? "Editar Seção" : "Editar Página") : (isGroup ? "Nova Seção" : "Nova Página")} wide>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Título</label>
              <input value={title} onChange={(e) => { setTitle(e.target.value); if (!editing) setSlug(slugify(e.target.value)); }} autoFocus className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm font-mono text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" />
            </div>
            {!isGroup && (
              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">Seção</label>
                <CustomSelect options={groupOptions} value={parentId} onChange={setParentId} />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700 mb-2 block">Ícone</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          {!isGroup && (
            <>
              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">Tipo de visualização</label>
                <CustomSelect options={VIEW_TYPE_OPTIONS} value={viewType} onChange={setViewType} />
              </div>

              {/* Linked collections */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ink-700">Coleções vinculadas</label>
                  <button type="button" onClick={addLinkedCollection} className="flex items-center gap-1 text-xs font-medium text-brand-olive hover:text-brand-olive-dark">
                    <Plus size={12} /> Vincular
                  </button>
                </div>
                {linkedCollections.length === 0 ? (
                  <p className="text-xs text-ink-400 bg-ink-50 rounded-lg px-3 py-2">Nenhuma coleção vinculada. Clique em "Vincular" pra adicionar.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {linkedCollections.map((lc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1">
                          <CustomSelect
                            options={[{ value: "", label: "Selecione..." }, ...collectionOptions]}
                            value={lc.collectionId}
                            onChange={(v) => updateLinkedCollection(i, "collectionId", v)}
                          />
                        </div>
                        <div className="w-32">
                          <CustomSelect
                            options={ROLE_OPTIONS}
                            value={lc.role}
                            onChange={(v) => updateLinkedCollection(i, "role", v)}
                          />
                        </div>
                        <button type="button" onClick={() => removeLinkedCollection(i)} className="rounded-md p-1.5 text-ink-400 hover:text-danger transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={handleSave} disabled={isPending || !title} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}</button>
            <button onClick={closeSheet} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
          </div>
        </div>
      </Sheet>
      <ConfirmDialog {...dialogProps} />
    </div>
  );

  function renderPageRow(p: Page) {
    const Icon = getIconComponent(p.icon) || ICON_MAP[p.icon] || Folder;
    const linkedCount = p.page_collections?.length || 0;
    return (
      <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-ink-50/50 transition-colors">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-olive-soft">
          <Icon size={16} className="text-brand-olive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-900">{p.title}</p>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span>/pagina/{p.slug}</span>
            {!p.is_group && <span>· {p.view_type}</span>}
            {linkedCount > 0 && <span>· {linkedCount} coleção{linkedCount > 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={13} /></button>
          <button onClick={() => handleDuplicate(p.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Duplicar"><Copy size={13} /></button>
          <button onClick={() => handleDelete(p.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={13} /></button>
          {!p.is_group && (
            <a href={`/pagina/${p.slug}`} className="ml-1 flex items-center gap-1 rounded-lg bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-100 transition-colors">
              Ver <ArrowRight size={11} />
            </a>
          )}
        </div>
      </div>
    );
  }
}
