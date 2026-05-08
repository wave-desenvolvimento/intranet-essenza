"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import DOMPurify from "dompurify";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft, Plus, Pencil, Trash2, X, Settings, Check, Upload, GripVertical, ChevronRight, Copy, History, RotateCcw,
} from "lucide-react";
import { createField, updateField, deleteField, createItem, updateItem, deleteItem, reorderItems, reorderFields, updateCollection, bulkUpdateStatus, bulkDeleteItems, duplicateItem } from "../actions";
import { getItemHistory, revertToVersion } from "@/app/(dashboard)/history-actions";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { uploadToStorage } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { IconPicker, getIconComponent, ICONS as MINI_ICONS } from "@/components/ui/icon-picker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagsInput } from "@/components/ui/tags-input";
import { GalleryView } from "./gallery-view";
import { FilesView } from "./files-view";

// === Types ===
interface Field { id: string; name: string; slug: string; field_type: string; required: boolean; placeholder: string | null; options: unknown; sort_order: number; }
interface Item { id: string; data: Record<string, unknown>; status: string; sort_order: number; created_at: string; published_at: string | null; expires_at: string | null; }
interface Collection { id: string; name: string; slug: string; description: string | null; view_type: string; }
interface Props { collection: Collection; fields: Field[]; items: Item[]; }

// === Constants ===
const FIELD_TYPES = [
  { value: "text", label: "Texto" }, { value: "textarea", label: "Texto longo" }, { value: "rich_text", label: "Rich Text" },
  { value: "number", label: "Número" }, { value: "boolean", label: "Sim/Não" }, { value: "date", label: "Data" },
  { value: "datetime", label: "Data e Hora" }, { value: "select", label: "Seleção" }, { value: "multi_select", label: "Seleção Múltipla" },
  { value: "image", label: "Imagem" }, { value: "image_variants", label: "Imagem (multi-formato)" }, { value: "file", label: "Arquivo" }, { value: "url", label: "URL" },
  { value: "color", label: "Cor" }, { value: "email", label: "E-mail" }, { value: "icon_select", label: "Seletor de Ícone" },
  { value: "duration", label: "Duração (mm:ss)" },
  { value: "image_array", label: "Galeria de Imagens" },
  { value: "file_array", label: "Lista de Arquivos" },
  { value: "collection_ref", label: "Referência (single)" },
  { value: "collection_multi_ref", label: "Referência (multi)" },
];
const STATUS_OPTIONS = [{ value: "draft", label: "Rascunho" }, { value: "published", label: "Publicado" }, { value: "archived", label: "Arquivado" }];
const STATUS_COLORS: Record<string, string> = { published: "bg-success-soft text-success", draft: "bg-warning-soft text-warning", archived: "bg-ink-100 text-ink-500" };
const IMAGE_HINTS: Record<string, string> = { imagem_desktop: "Recomendado: 1920 x 480px", imagem_mobile: "Recomendado: 768 x 600px" };
function slugify(t: string) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "_"); }

export function CollectionDetail({ collection, fields, items }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const isBanner = collection.slug === "banners";
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }
  async function bulkStatus(status: string) {
    const ids = [...selected];
    startTransition(async () => {
      const r = await bulkUpdateStatus(ids, status);
      if (r?.error) setError(r.error);
      else setSelected(new Set());
    });
  }
  async function bulkDelete() {
    const ids = [...selected];
    const ok = await confirmAction({ title: "Remover itens", message: `Tem certeza que deseja remover ${ids.length} ${ids.length === 1 ? "item" : "itens"}? Essa ação não pode ser desfeita.`, confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => {
      const r = await bulkDeleteItems(ids);
      if (r?.error) setError(r.error);
      else setSelected(new Set());
    });
  }

  // Drag reorder
  const itemDrag = useDragReorder(items, (ids) => {
    startTransition(async () => { await reorderItems(ids); });
  });
  const fieldDrag = useDragReorder(fields, (ids) => {
    startTransition(async () => { await reorderFields(ids); });
  });

  // Sheets
  const [itemSheet, setItemSheet] = useState(false);
  const [schemaSheet, setSchemaSheet] = useState(false);
  const [fieldSheet, setFieldSheet] = useState(false);

  // Item editing
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemData, setItemData] = useState<Record<string, unknown>>({});
  const [itemStatus, setItemStatus] = useState("draft");
  const [publishedAt, setPublishedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // History
  const [historySheet, setHistorySheet] = useState(false);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<{ id: string; data: Record<string, unknown>; status: string; changed_by_name: string | null; action: string; created_at: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function openHistory(itemId: string) {
    setHistoryItemId(itemId);
    setHistoryLoading(true);
    setHistorySheet(true);
    const entries = await getItemHistory(itemId);
    setHistoryEntries(entries as typeof historyEntries);
    setHistoryLoading(false);
  }

  function handleRevert(historyId: string) {
    if (!historyItemId) return;
    startTransition(async () => {
      const r = await revertToVersion(historyItemId, historyId);
      if (r?.error) setError(r.error);
      else { setHistorySheet(false); }
    });
  }

  // Collection editing
  const [editCollectionSheet, setEditCollectionSheet] = useState(false);
  const [colName, setColName] = useState(collection.name);
  const [colDesc, setColDesc] = useState(collection.description || "");

  function saveCollection() {
    const fd = new FormData();
    fd.set("id", collection.id);
    fd.set("name", colName);
    fd.set("description", colDesc);
    fd.set("icon", "folder");
    fd.set("parentId", "");
    fd.set("isGroup", "false");
    fd.set("viewType", collection.view_type || "table");
    startTransition(async () => {
      const r = await updateCollection(fd);
      if (r?.error) setError(r.error);
      else setEditCollectionSheet(false);
    });
  }

  // Field editing
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [fName, setFName] = useState(""); const [fSlug, setFSlug] = useState(""); const [fType, setFType] = useState("text");
  const [fRequired, setFRequired] = useState(false); const [fPlaceholder, setFPlaceholder] = useState("");
  const [fRefSlug, setFRefSlug] = useState("");
  const [fSelectOptions, setFSelectOptions] = useState<{ value: string; label: string }[]>([]);

  // Visible columns (first 4 text-ish fields)
  const visibleFields = fields.filter((f) => !["boolean", "image", "file"].includes(f.field_type)).slice(0, 4);

  // === Item handlers ===
  function openItem(item?: Item) {
    setEditingItem(item || null);
    setItemData(item?.data || {});
    setItemStatus(item?.status || "draft");
    setPublishedAt(item?.published_at ? item.published_at.slice(0, 16) : "");
    setExpiresAt(item?.expires_at ? item.expires_at.slice(0, 16) : "");
    setError("");
    setItemSheet(true);
  }
  function closeItem() { setItemSheet(false); setEditingItem(null); }
  function saveItem() {
    const fd = new FormData(); fd.set("data", JSON.stringify(itemData)); fd.set("status", itemStatus);
    fd.set("publishedAt", publishedAt); fd.set("expiresAt", expiresAt);
    if (editingItem) {
      fd.set("id", editingItem.id);
      startTransition(async () => { const r = await updateItem(fd); r?.error ? setError(r.error) : closeItem(); });
    } else {
      fd.set("collectionId", collection.id);
      startTransition(async () => { const r = await createItem(fd); r?.error ? setError(r.error) : closeItem(); });
    }
  }
  async function removeItem(id: string) {
    const ok = await confirmAction({ title: "Remover item", message: "Tem certeza que deseja remover este item? Essa ação não pode ser desfeita.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteItem(id); if (r?.error) setError(r.error); });
  }
  function handleDuplicateItem(id: string) {
    startTransition(async () => { const r = await duplicateItem(id); if (r?.error) setError(r.error); });
  }

  // === Field handlers ===
  function openField(f?: Field) {
    setEditingField(f || null);
    setFName(f?.name || ""); setFSlug(f?.slug || ""); setFType(f?.field_type || "text");
    setFRequired(f?.required || false); setFPlaceholder(f?.placeholder || "");
    const opts = f?.options as { collection_slug?: string; choices?: { value: string; label: string; icon?: string }[]; formats?: string[] } | null;
    setFRefSlug(opts?.collection_slug || "");
    // Para select/multi_select usa choices, para image_variants converte formats em choices
    if (f?.field_type === "image_variants" && opts?.formats) {
      setFSelectOptions(opts.formats.map((label) => ({ value: slugify(label), label })));
    } else {
      setFSelectOptions(opts?.choices || []);
    }
    setError("");
    setFieldSheet(true);
  }
  function closeField() { setFieldSheet(false); setEditingField(null); }
  function saveField() {
    const fd = new FormData();
    fd.set("name", fName); fd.set("slug", fSlug || slugify(fName)); fd.set("fieldType", fType);
    fd.set("required", String(fRequired)); fd.set("placeholder", fPlaceholder);
    if ((fType === "collection_ref" || fType === "collection_multi_ref") && fRefSlug) fd.set("options", JSON.stringify({ collection_slug: fRefSlug }));
    if ((fType === "select" || fType === "multi_select") && fSelectOptions.length > 0) fd.set("options", JSON.stringify({ choices: fSelectOptions }));
    if (fType === "image_variants" && fSelectOptions.length > 0) fd.set("options", JSON.stringify({ formats: fSelectOptions.map((o) => o.label) }));
    if (editingField) {
      fd.set("id", editingField.id);
      startTransition(async () => { const r = await updateField(fd); r?.error ? setError(r.error) : closeField(); });
    } else {
      fd.set("collectionId", collection.id);
      startTransition(async () => { const r = await createField(fd); r?.error ? setError(r.error) : closeField(); });
    }
  }
  async function removeField(id: string) {
    const ok = await confirmAction({ title: "Remover campo", message: "Tem certeza que deseja remover este campo? Os dados associados serão perdidos.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteField(id); if (r?.error) setError(r.error); });
  }

  return (
    <div>
      {/* Header */}
      <Link href="/cms" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 transition-colors mb-4">
        <ArrowLeft size={14} /> Collections
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{collection.name}</h1>
          <p className="text-xs md:text-sm text-ink-500">
            {items.length} {items.length === 1 ? "item" : "itens"} · {fields.length} campos
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => { setColName(collection.name); setColDesc(collection.description || ""); setEditCollectionSheet(true); }}
            className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
            title="Editar collection"
          >
            <Pencil size={14} />
            <span className="hidden sm:inline">Editar</span>
          </button>
          <button
            onClick={() => setSchemaSheet(true)}
            className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
            title="Configurar campos"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">Campos</span>
          </button>
          {fields.length > 0 && (
            <button
              onClick={() => openItem()}
              className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
            >
              <Plus size={16} /> Novo Item
            </button>
          )}
        </div>
      </div>

      {error && !itemSheet && !fieldSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Items — spreadsheet-style table */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <p className="text-sm text-ink-400 mb-3">Defina os campos primeiro</p>
          <button onClick={() => { setSchemaSheet(true); }} className="rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
            Configurar Campos
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <p className="text-sm text-ink-400 mb-3">Nenhum item</p>
          <button onClick={() => openItem()} className="rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
            Criar primeiro item
          </button>
        </div>
      ) : collection.view_type === "gallery" ? (
        <GalleryView items={items} fields={fields} onEdit={(item) => openItem(item)} onDelete={removeItem} onDuplicate={handleDuplicateItem} isPending={isPending} />
      ) : collection.view_type === "files" ? (
        <FilesView items={items} fields={fields} onEdit={(item) => openItem(item)} onDelete={removeItem} onDuplicate={handleDuplicateItem} isPending={isPending} />
      ) : (
        /* Table view (default) */
        <>
        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 mb-3 rounded-lg bg-ink-50 px-4 py-2.5">
            <span className="text-sm font-medium text-ink-700">{selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}</span>
            <div className="flex-1" />
            <button onClick={() => bulkStatus("published")} disabled={isPending} className="flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-medium text-success hover:bg-success/10 transition-colors">
              Publicar
            </button>
            <button onClick={() => bulkStatus("archived")} disabled={isPending} className="flex items-center gap-1.5 rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-200 transition-colors">
              Arquivar
            </button>
            <button onClick={() => bulkStatus("draft")} disabled={isPending} className="flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/10 transition-colors">
              Rascunho
            </button>
            <button onClick={bulkDelete} disabled={isPending} className="flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors">
              <Trash2 size={12} /> Remover
            </button>
            <button onClick={() => setSelected(new Set())} className="rounded-md p-1 text-ink-400 hover:text-ink-700 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="rounded-xl border border-ink-100 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/30">
                <th className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={toggleAll} className={cn("flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors", selected.size === items.length && items.length > 0 ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>
                    {selected.size === items.length && items.length > 0 && <Check size={9} className="text-white" strokeWidth={3} />}
                  </button>
                </th>
                <th className="w-8 px-2 py-2.5" />
                {isBanner && <th className="w-20 px-4 py-2.5" />}
                {visibleFields.map((f) => (
                  <th key={f.id} className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    {f.name}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider w-24">Status</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isChecked = selected.has(item.id);
                return (
                <tr
                  key={item.id}
                  {...itemDrag.getDragProps(idx)}
                  className={cn(
                    "border-b border-ink-50 last:border-0 hover:bg-brand-olive-soft/20 transition-colors cursor-pointer group",
                    isChecked && "bg-brand-olive-soft/10",
                    itemDrag.dragIndex === idx && "opacity-40",
                    itemDrag.overIndex === idx && itemDrag.dragIndex !== null && "border-t-2 border-t-brand-olive"
                  )}
                  onClick={() => openItem(item)}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => toggleSelect(item.id)} className={cn("flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors", isChecked ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>
                      {isChecked && <Check size={9} className="text-white" strokeWidth={3} />}
                    </button>
                  </td>
                  <td className="px-2 py-2.5 cursor-grab" onClick={(e) => e.stopPropagation()}>
                    <GripVertical size={14} className="text-ink-300" />
                  </td>
                  {isBanner && (
                    <td className="px-4 py-2.5">
                      <BannerMini data={item.data} />
                    </td>
                  )}
                  {visibleFields.map((f) => (
                    <td key={f.id} className="px-4 py-3 max-w-[220px]">
                      <CellValue value={item.data[f.slug]} field={f} />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_COLORS[item.status])}>
                      {STATUS_OPTIONS.find((s) => s.value === item.status)?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5 transition-opacity">
                      <button onClick={() => openItem(item)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={13} /></button>
                      <button onClick={() => handleDuplicateItem(item.id)} disabled={isPending} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Duplicar"><Copy size={13} /></button>
                      <button onClick={() => openHistory(item.id)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Histórico"><History size={13} /></button>
                      <button onClick={() => removeItem(item.id)} disabled={isPending} className="rounded-md p-1 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* === ITEM SHEET === */}
      <Sheet open={itemSheet} onClose={closeItem} onSubmit={saveItem} title={editingItem ? "Editar Item" : "Novo Item"} wide>
        <div className={cn(isBanner ? "flex gap-6" : "")}>
          <div className="flex-1 flex flex-col gap-4">
            {fields.map((f) => (
              <div key={f.id}>
                <label className="text-sm font-medium text-ink-700 mb-1.5 flex items-center gap-1">
                  {f.name}
                  {f.required && <span className="text-danger text-xs">*</span>}
                </label>
                <DynamicField field={f} value={itemData[f.slug]} onChange={(val) => setItemData((prev) => ({ ...prev, [f.slug]: val }))} />
                {IMAGE_HINTS[f.slug] && <p className="text-[10px] text-ink-400 mt-1">{IMAGE_HINTS[f.slug]}</p>}
              </div>
            ))}
            {/* Publicação */}
            <div className="border-t border-ink-100 pt-4 mt-2">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Publicação</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-ink-700 mb-1.5 block">Status</label>
                  <CustomSelect options={STATUS_OPTIONS} value={itemStatus} onChange={setItemStatus} />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-700 mb-1.5 block">Entra em</label>
                  <input
                    type="datetime-local"
                    value={publishedAt}
                    onChange={(e) => setPublishedAt(e.target.value)}
                    className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-700 mb-1.5 block">Sai em</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
                  />
                </div>
              </div>
            </div>

            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

            <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
              <button onClick={saveItem} disabled={isPending} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
                {isPending ? "Salvando..." : editingItem ? "Salvar" : "Criar Item"}
              </button>
              <button onClick={closeItem} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>

          {/* Banner live preview */}
          {isBanner && (
            <div className="hidden lg:flex flex-col gap-3 w-72 shrink-0">
              <div>
                <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wider mb-1.5">Desktop</p>
                <BannerPreview data={itemData} />
              </div>
              <div>
                <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wider mb-1.5">Mobile</p>
                <BannerPreview data={itemData} mobile />
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* === EDIT COLLECTION SHEET === */}
      <Sheet open={editCollectionSheet} onClose={() => setEditCollectionSheet(false)} onSubmit={saveCollection} title="Editar Collection">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Nome</label>
            <input value={colName} onChange={(e) => setColName(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Descrição</label>
            <textarea value={colDesc} onChange={(e) => setColDesc(e.target.value)} rows={3} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 resize-y" />
          </div>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={saveCollection} disabled={isPending || !colName} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
              {isPending ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setEditCollectionSheet(false)} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">Cancelar</button>
          </div>
        </div>
      </Sheet>

      {/* === SCHEMA SHEET === */}
      <Sheet open={schemaSheet} onClose={() => setSchemaSheet(false)} title="Campos">
        <div className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <div
              key={f.id}
              {...fieldDrag.getDragProps(i)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-ink-50 transition-colors group",
                i < fields.length - 1 && "border-b border-ink-50",
                fieldDrag.dragIndex === i && "opacity-40",
                fieldDrag.overIndex === i && fieldDrag.dragIndex !== null && "border-t-2 border-t-brand-olive"
              )}
            >
              <GripVertical size={13} className="text-ink-300 shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900">{f.name}</p>
                <p className="text-[10px] text-ink-400 font-mono">{f.slug} · {FIELD_TYPES.find((t) => t.value === f.field_type)?.label}{f.required ? " · obrigatório" : ""}</p>
              </div>
              <div className="flex items-center gap-0.5 transition-opacity">
                <button onClick={() => openField(f)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar campo"><Pencil size={13} /></button>
                <button onClick={() => removeField(f.id)} disabled={isPending} className="rounded-md p-1 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover campo"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          <button onClick={() => openField()} className="flex items-center gap-2 rounded-lg border border-dashed border-ink-200 px-3 py-2.5 text-sm text-ink-400 hover:border-brand-olive hover:text-brand-olive transition-colors">
            <Plus size={14} /> Adicionar campo
          </button>
        </div>
      </Sheet>

      {/* === FIELD SHEET (nested) === */}
      <Sheet open={fieldSheet} onClose={closeField} onSubmit={saveField} title={editingField ? "Editar Campo" : "Novo Campo"}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Nome</label>
            <input value={fName} onChange={(e) => { setFName(e.target.value); if (!editingField) setFSlug(slugify(e.target.value)); }} autoFocus className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Ex: Título" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Slug</label>
            <input value={fSlug} onChange={(e) => setFSlug(e.target.value)} disabled={!!editingField} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm font-mono text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 disabled:bg-ink-50 disabled:text-ink-400" />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Tipo</label>
            <CustomSelect options={FIELD_TYPES} value={fType} onChange={setFType} />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Placeholder</label>
            <input value={fPlaceholder} onChange={(e) => setFPlaceholder(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Texto de ajuda" />
          </div>
          {(fType === "collection_ref" || fType === "collection_multi_ref") && (
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Slug da collection referenciada</label>
              <input value={fRefSlug} onChange={(e) => setFRefSlug(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm font-mono text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Ex: categorias-materiais" />
              <p className="text-[10px] text-ink-400 mt-1">Os itens publicados dessa collection serão as opções do select</p>
            </div>
          )}
          {(fType === "select" || fType === "multi_select") && (
            <SelectOptionsEditor options={fSelectOptions} onChange={setFSelectOptions} />
          )}
          {fType === "image_variants" && (
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Formatos disponíveis</label>
              <p className="text-[10px] text-ink-400 mb-2">Defina os formatos que o usuário poderá enviar (ex: Post Instagram, Stories, Feed Facebook)</p>
              <SelectOptionsEditor options={fSelectOptions} onChange={setFSelectOptions} />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={fRequired} onChange={(e) => setFRequired(e.target.checked)} className="sr-only" />
            <div className={cn("flex h-4 w-4 items-center justify-center rounded border-[1.5px]", fRequired ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>
              {fRequired && <Check size={9} className="text-white" strokeWidth={3} />}
            </div>
            <span className="text-sm text-ink-700">Obrigatório</span>
          </label>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={saveField} disabled={isPending || !fName} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Salvando..." : "Salvar"}</button>
            <button onClick={closeField} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
          </div>
        </div>
      </Sheet>

      {/* === HISTORY SHEET === */}
      <Sheet open={historySheet} onClose={() => setHistorySheet(false)} title="Histórico de versões">
        <div className="flex flex-col gap-1">
          {historyLoading ? (
            <p className="text-xs text-ink-400 text-center py-8">Carregando...</p>
          ) : historyEntries.length === 0 ? (
            <p className="text-xs text-ink-400 text-center py-8">Nenhuma versão anterior</p>
          ) : (
            historyEntries.map((entry) => {
              const actionLabel = entry.action === "create" ? "Criado" : entry.action === "status_change" ? "Status alterado" : "Editado";
              const firstTextValue = Object.values(entry.data).find((v) => typeof v === "string" && (v as string).length > 0 && (v as string).length < 100) as string | undefined;
              return (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-ink-100 px-3 py-3 hover:bg-ink-50/50 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 mt-0.5">
                    <History size={13} className="text-ink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-medium",
                        entry.action === "create" ? "bg-success-soft text-success" : entry.action === "status_change" ? "bg-info-soft text-info" : "bg-warning-soft text-warning"
                      )}>
                        {actionLabel}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", entry.status === "published" ? "bg-success-soft text-success" : "bg-ink-100 text-ink-500")}>
                        {entry.status}
                      </span>
                    </div>
                    {firstTextValue && <p className="text-xs text-ink-600 truncate mt-1">{firstTextValue as string}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-ink-400">
                      <span>{entry.changed_by_name || "Sistema"}</span>
                      <span>·</span>
                      <span>{new Date(entry.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  {entry.action !== "create" && (
                    <button
                      onClick={() => handleRevert(entry.id)}
                      disabled={isPending}
                      className="flex items-center gap-1 shrink-0 rounded-lg border border-ink-200 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-50 hover:border-ink-300 disabled:opacity-50 transition-colors mt-1"
                      title="Reverter para esta versão"
                    >
                      <RotateCcw size={10} /> Reverter
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Sheet>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

// === Sub-components ===

function CellValue({ value, field }: { value: unknown; field: Field }) {
  const type = field.field_type;
  const opts = field.options as { choices?: { value: string; label: string; icon?: string }[] } | null;
  const choices = opts?.choices || [];

  if (type === "select") {
    const str = String(value || "");
    if (!str) return <span className="text-ink-300">—</span>;
    const choice = choices.find((c) => c.value === str);
    if (!choice) return <span className="text-ink-900 truncate block">{str}</span>;
    const Icon = choice.icon ? getIconComponent(choice.icon) : null;
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-900">
        {Icon && <Icon size={13} className="text-ink-500 shrink-0" />}
        <span className="truncate">{choice.label}</span>
      </span>
    );
  }

  if (type === "multi_select") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    if (selected.length === 0) return <span className="text-ink-300">—</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {selected.map((v) => {
          const choice = choices.find((c) => c.value === v);
          const Icon = choice?.icon ? getIconComponent(choice.icon) : null;
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded bg-ink-50 px-1.5 py-0.5 text-[10px] text-ink-700">
              {Icon && <Icon size={11} className="shrink-0" />}
              {choice?.label || v}
            </span>
          );
        })}
      </span>
    );
  }

  if (type === "image_variants") {
    const variants = (typeof value === "object" && value !== null ? value : {}) as Record<string, string>;
    const keys = Object.keys(variants).filter((k) => variants[k]);
    if (keys.length === 0) return <span className="text-ink-300">—</span>;
    return <span className="text-xs text-ink-500">{keys.length} {keys.length === 1 ? "formato" : "formatos"}</span>;
  }

  if (type === "image_array") {
    const items = Array.isArray(value) ? (value as { title?: string; url: string }[]) : [];
    if (items.length === 0) return <span className="text-ink-300">—</span>;
    return (
      <span className="flex items-center gap-1">
        {items.slice(0, 3).map((item, i) => (
          <img key={i} src={item.url} alt={item.title || ""} className="h-7 w-7 rounded border border-ink-100 object-cover" />
        ))}
        {items.length > 3 && <span className="text-[10px] text-ink-400">+{items.length - 3}</span>}
      </span>
    );
  }

  if (type === "file_array") {
    const items = Array.isArray(value) ? (value as { title?: string; url: string }[]) : [];
    if (items.length === 0) return <span className="text-ink-300">—</span>;
    return <span className="text-xs text-ink-500">{items.length} {items.length === 1 ? "arquivo" : "arquivos"}</span>;
  }

  const str = String(value || "");
  if (!str || str === "undefined") return <span className="text-ink-300">—</span>;

  if (type === "color") {
    return (
      <span className="flex items-center gap-2">
        <span className="h-4 w-4 rounded border border-ink-100 shrink-0" style={{ backgroundColor: str }} />
        <span className="text-xs font-mono text-ink-500">{str}</span>
      </span>
    );
  }

  if (type === "rich_text") {
    return <span className="text-ink-900 truncate block prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(str) }} />;
  }

  return <span className="text-ink-900 truncate block">{str}</span>;
}

function BannerMini({ data }: { data: Record<string, unknown> }) {
  const img = String(data.imagem_desktop || "");
  const corI = String(data.cor_inicio || ""); const corF = String(data.cor_fim || "");
  const style: React.CSSProperties = img
    ? { backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }
    : corI && corF ? { background: `linear-gradient(135deg, ${corI}, ${corF})` } : {};
  return <div className={cn("w-16 h-10 rounded-md shrink-0 overflow-hidden", !img && !(corI && corF) && "bg-ink-100 border border-ink-200")} style={style} />;
}

function BannerPreview({ data, mobile }: { data: Record<string, unknown>; mobile?: boolean }) {
  const corI = String(data.cor_inicio || ""); const corF = String(data.cor_fim || "");
  const img = mobile ? String(data.imagem_mobile || data.imagem_desktop || "") : String(data.imagem_desktop || "");
  const hasGradient = corI && corF; const isEmpty = !img && !hasGradient;
  const style: React.CSSProperties = img
    ? { backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }
    : hasGradient ? { background: `linear-gradient(135deg, ${corI}, ${corF})` } : {};
  const badge = String(data.badge || ""); const titulo = String(data.titulo || ""); const descricao = String(data.descricao || "");
  return (
    <div className={cn("relative rounded-lg overflow-hidden", mobile ? "h-[120px]" : "h-[90px]", isEmpty && "bg-ink-100 border border-ink-200")} style={style}>
      {!isEmpty && <div className={cn("absolute inset-0", mobile ? "bg-gradient-to-t from-black/60 to-transparent" : "bg-gradient-to-r from-black/50 via-black/20 to-transparent")} />}
      {(badge || titulo) && (
        <div className={cn("relative z-10 flex flex-col h-full", mobile ? "justify-end p-2.5" : "justify-center px-3")}>
          {badge && <span className="inline-flex self-start rounded-full border border-white/60 px-1.5 py-0.5 text-[6px] text-white mb-0.5">{badge}</span>}
          {titulo && <p className={cn("font-semibold text-[10px] leading-tight", isEmpty ? "text-ink-700" : "text-white")}>{titulo}</p>}
          {descricao && !mobile && <p className={cn("text-[8px] mt-0.5 line-clamp-1", isEmpty ? "text-ink-500" : "text-white/70")}>{descricao}</p>}
        </div>
      )}
    </div>
  );
}

function DynamicField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const cls = "h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 transition-colors";
  switch (field.field_type) {
    case "text": case "email": case "url":
      if (field.field_type === "text" && field.slug.includes("tag")) return <TagsInput value={String(value || "")} onChange={(v) => onChange(v)} placeholder={field.placeholder || "Digite e pressione vírgula..."} />;
      return <input type={field.field_type === "url" ? "url" : field.field_type === "email" ? "email" : "text"} value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ""} className={cls} />;
    case "textarea": return <textarea value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ""} rows={3} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 resize-y" />;
    case "rich_text": return <RichTextEditor value={String(value || "")} onChange={(html) => onChange(html)} placeholder={field.placeholder || ""} />;
    case "number": return <input type="number" value={value !== undefined && value !== null ? String(value) : ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={cls} />;
    case "boolean": { const b = Boolean(value); return (<button type="button" onClick={() => onChange(!b)} className="flex items-center gap-2 h-10"><div className={cn("flex h-5 w-5 items-center justify-center rounded border-[1.5px]", b ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>{b && <Check size={11} className="text-white" strokeWidth={3} />}</div><span className="text-sm text-ink-700">{b ? "Sim" : "Não"}</span></button>); }
    case "date": case "datetime": return <input type={field.field_type === "datetime" ? "datetime-local" : "date"} value={String(value || "")} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "color": return (<div className="flex items-center gap-2"><input type="color" value={String(value || "#ffffff")} onChange={(e) => onChange(e.target.value)} className="h-10 w-10 rounded-lg border border-ink-100 cursor-pointer p-0.5" /><input type="text" value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className={cn(cls, "flex-1")} /></div>);
    case "image": case "file": return <FileUploadField field={field} value={value} onChange={onChange} />;
    case "image_variants": return <ImageVariantsField field={field} value={value} onChange={onChange} />;
    case "image_array": return <ImageArrayField field={field} value={value} onChange={onChange} />;
    case "file_array": return <FileArrayField field={field} value={value} onChange={onChange} />;
    case "select": {
      const opts = field.options as { choices?: { value: string; label: string; icon?: string }[] } | null;
      const choices = opts?.choices || [];
      return <SelectField choices={choices} value={String(value || "")} onChange={(v) => onChange(v)} />;
    }
    case "multi_select": {
      const opts = field.options as { choices?: { value: string; label: string; icon?: string }[] } | null;
      const choices = opts?.choices || [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((o) => {
            const Icon = o.icon ? getIconComponent(o.icon) : null;
            const isSelected = selected.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => onChange(isSelected ? selected.filter((v) => v !== o.value) : [...selected, o.value])} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border", isSelected ? "border-brand-olive bg-brand-olive text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-olive")}>
                {Icon && <Icon size={13} />}
                {o.label}
              </button>
            );
          })}
          {choices.length === 0 && <span className="text-xs text-ink-400">Nenhuma opção configurada neste campo</span>}
        </div>
      );
    }
    case "icon_select": return <IconPicker value={String(value || "")} onChange={(v) => onChange(v)} />;
    case "duration": return <DurationField value={String(value || "")} onChange={(v) => onChange(v)} className={cls} />;
    case "collection_ref": return <CollectionRefField field={field} value={value} onChange={onChange} />;
    case "collection_multi_ref": return <CollectionMultiRefField field={field} value={value} onChange={onChange} />;
    default: return <input type="text" value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ""} className={cls} />;
  }
}

function SelectOptionsEditor({ options, onChange }: { options: { value: string; label: string; icon?: string }[]; onChange: (opts: { value: string; label: string; icon?: string }[]) => void }) {
  const [newLabel, setNewLabel] = useState("");
  const [editingIcon, setEditingIcon] = useState<string | null>(null);

  function addOption() {
    const label = newLabel.trim();
    if (!label) return;
    const value = slugify(label);
    if (options.some((o) => o.value === value)) return;
    onChange([...options, { value, label }]);
    setNewLabel("");
  }

  function removeOption(value: string) {
    onChange(options.filter((o) => o.value !== value));
  }

  function setIcon(value: string, iconName: string) {
    onChange(options.map((o) => o.value === value ? { ...o, icon: iconName || undefined } : o));
    setEditingIcon(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); addOption(); }
  }

  return (
    <div>
      <label className="text-sm font-medium text-ink-700 mb-1.5 block">Opções</label>
      {options.length > 0 && (
        <div className="flex flex-col gap-1 mb-2 rounded-lg border border-ink-100 divide-y divide-ink-50 overflow-hidden">
          {options.map((o) => {
            const Icon = o.icon ? getIconComponent(o.icon) : null;
            return (
              <div key={o.value} className="flex items-center gap-2 px-3 py-2 bg-white">
                <button
                  type="button"
                  onClick={() => setEditingIcon(editingIcon === o.value ? null : o.value)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                    Icon ? "border-brand-olive bg-brand-olive-soft text-brand-olive" : "border-dashed border-ink-200 text-ink-300 hover:border-ink-400"
                  )}
                  title="Escolher ícone"
                >
                  {Icon ? <Icon size={14} /> : <Plus size={12} />}
                </button>
                <span className="flex-1 text-sm text-ink-700">{o.label}</span>
                <span className="text-[10px] font-mono text-ink-400">{o.value}</span>
                <button type="button" onClick={() => removeOption(o.value)} className="rounded-md p-1 text-ink-400 hover:text-danger transition-colors">
                  <X size={12} />
                </button>
                {editingIcon === o.value && (
                  <div className="absolute right-0 mt-1">
                    {/* rendered below */}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {options.length === 0 && <p className="text-xs text-ink-400 mb-2">Nenhuma opção adicionada</p>}

      {/* Inline icon picker for selected option */}
      {editingIcon && (
        <div className="mb-3">
          <MiniIconPicker
            value={options.find((o) => o.value === editingIcon)?.icon || ""}
            onChange={(iconName) => setIcon(editingIcon, iconName)}
          />
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nome da opção"
          className="h-9 flex-1 rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
        />
        <button type="button" onClick={addOption} disabled={!newLabel.trim()} className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 h-9 text-xs font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-40 transition-colors">
          <Plus size={12} /> Adicionar
        </button>
      </div>
    </div>
  );
}

function MiniIconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = MINI_ICONS.filter((i) => !search || i.name.includes(search.toLowerCase()));
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/30 p-2 space-y-1.5">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ícone..." className="h-8 w-full rounded-md border border-ink-100 bg-white px-2.5 text-xs text-ink-900 focus:border-brand-olive focus:outline-none" />
      <div className="grid grid-cols-10 gap-0.5 max-h-[120px] overflow-y-auto">
        {value && (
          <button type="button" onClick={() => onChange("")} className="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100" title="Remover ícone"><X size={13} /></button>
        )}
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.name} type="button" onClick={() => onChange(item.name)} className={cn("flex h-7 w-7 items-center justify-center rounded transition-colors", value === item.name ? "bg-brand-olive text-white" : "text-ink-500 hover:bg-ink-100")} title={item.name}>
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectField({ choices, value, onChange }: { choices: { value: string; label: string; icon?: string }[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = choices.find((c) => c.value === value);
  const SelectedIcon = selected?.icon ? getIconComponent(selected.icon) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-left text-ink-900 hover:border-ink-200 transition-colors"
      >
        {SelectedIcon && <SelectedIcon size={14} className="text-ink-500 shrink-0" />}
        <span className="flex-1 truncate">{selected?.label || "Selecione..."}</span>
        <ChevronRight size={13} className={cn("text-ink-400 transition-transform shrink-0", open && "rotate-90")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-ink-100 bg-white shadow-dropdown max-h-48 overflow-y-auto">
          <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-400 hover:bg-ink-50 transition-colors">
            Nenhum
          </button>
          {choices.map((c) => {
            const Icon = c.icon ? getIconComponent(c.icon) : null;
            return (
              <button key={c.value} type="button" onClick={() => { onChange(c.value); setOpen(false); }} className={cn("flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors", value === c.value ? "bg-brand-olive-soft text-brand-olive font-medium" : "text-ink-700 hover:bg-ink-50")}>
                {Icon && <Icon size={14} className="shrink-0" />}
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DurationField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    if (raw.length <= 2) {
      onChange(raw);
    } else if (raw.length <= 4) {
      onChange(`${raw.slice(0, -2)}:${raw.slice(-2)}`);
    } else {
      onChange(`${raw.slice(0, -4)}:${raw.slice(-4, -2)}:${raw.slice(-2)}`);
    }
  }
  return (
    <div className="relative">
      <input type="text" inputMode="numeric" value={value} onChange={handleChange} placeholder="0:00:00" className={className} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">hh:mm:ss</span>
    </div>
  );
}

function ImageVariantsField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const opts = field.options as { formats?: string[] } | null;
  const formats = opts?.formats || ["Original"];
  const variants = (typeof value === "object" && value !== null ? value : {}) as Record<string, string>;
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleUpload(format: string, file: File) {
    setUploading(format);
    const r = await uploadToStorage(file, { bucket: "assets", folder: field.slug });
    setUploading(null);
    if ("url" in r) {
      onChange({ ...variants, [format]: r.url });
    }
  }

  function removeVariant(format: string) {
    const next = { ...variants };
    delete next[format];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {formats.map((format) => {
        const url = variants[format] || "";
        return (
          <div key={format} className="rounded-lg border border-ink-100 bg-ink-50/30 p-3">
            <p className="text-xs font-medium text-ink-700 mb-2">{format}</p>
            {url ? (
              <div className="relative">
                <img src={url} alt={format} className="w-full h-24 rounded-md object-cover" />
                <button type="button" onClick={() => removeVariant(format)} className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors">
                  <X size={10} />
                </button>
              </div>
            ) : (
              <label className={cn(
                "flex items-center justify-center gap-2 rounded-md border-2 border-dashed h-16 cursor-pointer transition-colors",
                uploading === format ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 hover:border-brand-olive"
              )}>
                <input type="file" accept="image/*" className="sr-only" disabled={uploading !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(format, f); }} />
                {uploading === format ? (
                  <span className="text-xs text-brand-olive font-medium">Enviando...</span>
                ) : (
                  <><Upload size={13} className="text-ink-400" /><span className="text-xs text-ink-500">Enviar {format}</span></>
                )}
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileUploadField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileUrl = String(value || ""); const isImage = field.field_type === "image";
  const bucket = field.slug.includes("banner") || field.slug.includes("imagem") ? "banners" : "assets";
  async function handleUpload(file: File) {
    setUploading(true);
    const r = await uploadToStorage(file, { bucket, folder: field.slug });
    setUploading(false);
    if ("url" in r) onChange(r.url);
  }
  return (
    <div className="flex flex-col gap-2">
      {fileUrl && isImage && <div className="relative w-full h-28 rounded-lg border border-ink-100 overflow-hidden bg-ink-50"><img src={fileUrl} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => onChange("")} className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70" title="Remover"><X size={10} /></button></div>}
      <label className={cn("flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors", uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30", fileUrl ? "h-10" : "h-20")}>
        <input type="file" accept={isImage ? "image/*" : "*"} className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        {uploading ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{fileUrl ? "Trocar" : isImage ? "Enviar imagem" : "Enviar arquivo"}</span></>}
      </label>
    </div>
  );
}

interface ArrayItem { title: string; url: string; filename?: string }

function ImageArrayField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const items: ArrayItem[] = Array.isArray(value) ? (value as ArrayItem[]) : [];
  const [uploading, setUploading] = useState(false);

  async function handleUpload(files: FileList) {
    setUploading(true);
    const newItems = [...items];
    for (const file of Array.from(files)) {
      const r = await uploadToStorage(file, { bucket: "assets", folder: field.slug });
      if ("url" in r) {
        const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        newItems.push({ title: name, url: r.url });
      }
    }
    setUploading(false);
    onChange(newItems);
  }

  function updateTitle(index: number, title: string) {
    onChange(items.map((item, i) => i === index ? { ...item, title } : item));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-ink-100 bg-ink-50/30 overflow-hidden group">
              <div className="relative h-24">
                <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {i > 0 && <button type="button" onClick={() => moveItem(i, i - 1)} className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70" title="Mover para esquerda"><ChevronRight size={10} className="rotate-180" /></button>}
                  {i < items.length - 1 && <button type="button" onClick={() => moveItem(i, i + 1)} className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70" title="Mover para direita"><ChevronRight size={10} /></button>}
                  <button type="button" onClick={() => removeItem(i)} className="rounded-full bg-black/50 p-1 text-white hover:bg-danger" title="Remover"><X size={10} /></button>
                </div>
              </div>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateTitle(i, e.target.value)}
                placeholder="Título..."
                className="w-full border-t border-ink-100 px-2 py-1.5 text-xs text-ink-900 bg-white focus:outline-none focus:bg-brand-olive-soft/20"
              />
            </div>
          ))}
        </div>
      )}
      <label className={cn(
        "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
        uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30",
        items.length > 0 ? "h-10" : "h-20"
      )}>
        <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
        {uploading ? (
          <span className="text-xs text-brand-olive font-medium">Enviando...</span>
        ) : (
          <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{items.length > 0 ? "Adicionar imagens" : "Enviar imagens"}</span></>
        )}
      </label>
      {items.length > 0 && <p className="text-[10px] text-ink-400">{items.length} {items.length === 1 ? "imagem" : "imagens"}</p>}
    </div>
  );
}

function FileArrayField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const items: ArrayItem[] = Array.isArray(value) ? (value as ArrayItem[]) : [];
  const [uploading, setUploading] = useState(false);

  function getFileExt(url: string) {
    const match = url.match(/\.(\w{2,5})(?:\?|$)/);
    return match ? match[1].toUpperCase() : "FILE";
  }

  async function handleUpload(files: FileList) {
    setUploading(true);
    const newItems = [...items];
    for (const file of Array.from(files)) {
      const r = await uploadToStorage(file, { bucket: "assets", folder: field.slug });
      if ("url" in r) {
        const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        newItems.push({ title: name, url: r.url, filename: file.name });
      }
    }
    setUploading(false);
    onChange(newItems);
  }

  function updateTitle(index: number, title: string) {
    onChange(items.map((item, i) => i === index ? { ...item, title } : item));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => {
        const ext = getFileExt(item.url);
        return (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-50">
              <span className="text-[8px] font-bold text-ink-500">{ext}</span>
            </div>
            <input
              type="text"
              value={item.title}
              onChange={(e) => updateTitle(i, e.target.value)}
              placeholder="Título do arquivo..."
              className="flex-1 min-w-0 text-sm text-ink-900 bg-transparent focus:outline-none"
            />
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {i > 0 && <button type="button" onClick={() => moveItem(i, i - 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700" title="Subir"><ChevronRight size={12} className="-rotate-90" /></button>}
              {i < items.length - 1 && <button type="button" onClick={() => moveItem(i, i + 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700" title="Descer"><ChevronRight size={12} className="rotate-90" /></button>}
              <button type="button" onClick={() => removeItem(i)} className="rounded-md p-1 text-ink-400 hover:text-danger" title="Remover"><X size={12} /></button>
            </div>
          </div>
        );
      })}
      <label className={cn(
        "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
        uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30",
        items.length > 0 ? "h-10" : "h-20"
      )}>
        <input type="file" multiple className="sr-only" disabled={uploading} onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
        {uploading ? (
          <span className="text-xs text-brand-olive font-medium">Enviando...</span>
        ) : (
          <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{items.length > 0 ? "Adicionar arquivos" : "Enviar arquivos"}</span></>
        )}
      </label>
      {items.length > 0 && <p className="text-[10px] text-ink-400">{items.length} {items.length === 1 ? "arquivo" : "arquivos"}</p>}
    </div>
  );
}

function CollectionRefField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Parse collection_slug from field options
  const optionsData = field.options as { collection_slug?: string } | null;
  const refSlug = optionsData?.collection_slug || "";

  useEffect(() => {
    if (!refSlug || loaded) return;
    async function load() {
      const supabase = createBrowserClient();
      // Get collection by slug
      const { data: col } = await supabase
        .from("cms_collections")
        .select("id")
        .eq("slug", refSlug)
        .single();

      if (!col) { setLoaded(true); return; }

      // Get published items
      const { data: items } = await supabase
        .from("cms_items")
        .select("id, data")
        .eq("collection_id", col.id)
        .eq("status", "published")
        .order("sort_order");

      // Find first text field for label
      const { data: fields } = await supabase
        .from("cms_fields")
        .select("slug, field_type")
        .eq("collection_id", col.id)
        .eq("field_type", "text")
        .order("sort_order")
        .limit(1);

      const titleSlug = fields?.[0]?.slug || "nome";

      setOptions(
        (items || []).map((item) => ({
          value: item.id,
          label: String((item.data as Record<string, unknown>)[titleSlug] || `Item ${item.id.slice(0, 6)}`),
        }))
      );
      setLoaded(true);
    }
    load();
  }, [refSlug, loaded]);

  if (!refSlug) {
    return <p className="text-xs text-ink-400">Configure o campo com a collection de referência</p>;
  }

  return (
    <CustomSelect
      options={[{ value: "", label: "Selecione..." }, ...options]}
      value={String(value || "")}
      onChange={(v) => onChange(v)}
      placeholder={loaded ? "Selecione..." : "Carregando..."}
    />
  );
}

function CollectionMultiRefField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  const optionsData = field.options as { collection_slug?: string } | null;
  const refSlug = optionsData?.collection_slug || "";
  const selectedIds = Array.isArray(value) ? (value as string[]) : [];

  useEffect(() => {
    if (!refSlug || loaded) return;
    async function load() {
      const supabase = createBrowserClient();
      const { data: col } = await supabase.from("cms_collections").select("id").eq("slug", refSlug).single();
      if (!col) { setLoaded(true); return; }

      const { data: items } = await supabase.from("cms_items").select("id, data").eq("collection_id", col.id).eq("status", "published").order("sort_order");
      const { data: fields } = await supabase.from("cms_fields").select("slug").eq("collection_id", col.id).eq("field_type", "text").order("sort_order").limit(1);

      const titleSlug = fields?.[0]?.slug || "nome";
      setOptions((items || []).map((item) => ({ id: item.id, label: String((item.data as Record<string, unknown>)[titleSlug] || item.id.slice(0, 6)) })));
      setLoaded(true);
    }
    load();
  }, [refSlug, loaded]);

  function toggleId(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id];
    onChange(next);
  }

  if (!refSlug) return <p className="text-xs text-ink-400">Configure o campo com a collection de referência</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = selectedIds.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggleId(opt.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
              isSelected
                ? "border-brand-olive bg-brand-olive text-white"
                : "border-ink-200 bg-white text-ink-600 hover:border-brand-olive hover:text-brand-olive"
            )}
          >
            {opt.label}
          </button>
        );
      })}
      {!loaded && <span className="text-xs text-ink-400">Carregando...</span>}
      {loaded && options.length === 0 && <span className="text-xs text-ink-400">Nenhuma opção disponível</span>}
    </div>
  );
}
