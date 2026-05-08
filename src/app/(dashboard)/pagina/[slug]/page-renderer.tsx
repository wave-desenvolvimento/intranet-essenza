"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import DOMPurify from "dompurify";
import { Download, Eye, ZoomIn, X, FileText, File, Image, Trash2, Search, Plus, Pencil, Check, Upload, Play, Clock, GraduationCap, Lock, FileDown, Copy, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { CustomSelect } from "@/components/ui/custom-select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createItem, updateItem, deleteItem } from "@/app/(dashboard)/cms/actions";
import { uploadToStorage } from "@/lib/upload";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { TagsInput } from "@/components/ui/tags-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { downloadFile, downloadFilesAsZip } from "@/lib/download";
import { getIconComponent as getIconByName } from "@/components/ui/icon-picker";
import { ImageFormatDownload, type ImageVariant } from "@/components/ui/image-format-download";
import { ShareLink } from "@/components/ui/share-link";
import { trackEvent } from "@/app/(dashboard)/analytics-actions";
import { getUserFavoriteIds } from "@/app/(dashboard)/favorites-actions";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { WhatsAppShareImage } from "@/components/ui/whatsapp-share";
import { usePagination } from "@/hooks/use-pagination";

interface Field {
  id: string;
  name: string;
  slug: string;
  field_type: string;
}

interface Item {
  id: string;
  data: Record<string, unknown>;
  status: string;
  sort_order: number;
  created_at: string;
}

interface CollectionData {
  id: string;
  name: string;
  slug: string;
  role: string;
  fields: Field[];
  items: Item[];
}

interface Page {
  id: string;
  title: string;
  slug: string;
  view_type: string;
}

interface Props {
  page: Page;
  collections: CollectionData[];
}

export function PageRenderer({ page, collections }: Props) {
  const mainCollection = collections.find((c) => c.role === "main");
  const filterCollections = collections.filter((c) => c.role === "filter");
  const { can } = usePermissions();
  const [isPending, startTransition] = useTransition();
  const [itemSheet, setItemSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemData, setItemData] = useState<Record<string, unknown>>({});
  const [itemStatus, setItemStatus] = useState("published");
  const [error, setError] = useState("");
  const { confirm, dialogProps } = useConfirm();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Load favorite IDs
  useEffect(() => {
    getUserFavoriteIds().then((ids) => setFavoriteIds(new Set(ids)));
  }, []);

  // Determine module from page slug for permission check
  const moduleSlug = page.slug;
  const canCreate = can(`${moduleSlug}.create`) || can("cms.create");
  const canEdit = can(`${moduleSlug}.edit`) || can("cms.edit");

  function openItemSheet(item?: Item) {
    setEditingItem(item || null);
    setItemData(item?.data || {});
    setItemStatus(item?.status || "published");
    setError("");
    setItemSheet(true);
  }

  function closeItemSheet() { setItemSheet(false); setEditingItem(null); }

  function saveItem() {
    if (!mainCollection) return;
    const fd = new FormData();
    fd.set("data", JSON.stringify(itemData));
    fd.set("status", itemStatus);
    fd.set("publishedAt", "");
    fd.set("expiresAt", "");
    if (editingItem) {
      fd.set("id", editingItem.id);
      startTransition(async () => { const r = await updateItem(fd); if (r?.error) setError(r.error); else { closeItemSheet(); toast.success("Item atualizado"); } });
    } else {
      fd.set("collectionId", mainCollection.id);
      startTransition(async () => { const r = await createItem(fd); if (r?.error) setError(r.error); else { closeItemSheet(); toast.success("Item criado"); } });
    }
  }

  async function removeItem(id: string) {
    const ok = await confirm({ title: "Remover item", message: "Tem certeza que deseja remover este item? Essa ação não pode ser desfeita.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { await deleteItem(id); toast.success("Item removido"); });
  }

  if (!mainCollection) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-ink-900 mb-2">{page.title}</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <p className="text-sm text-ink-400">Nenhuma collection vinculada a esta página</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink-900">{page.title}</h1>
          <span className="text-sm text-ink-400">
            {mainCollection.items.length} {mainCollection.items.length === 1 ? "item" : "itens"}
          </span>
        </div>
        {canCreate && (
          <button onClick={() => openItemSheet()} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
            <Plus size={16} /> Novo
          </button>
        )}
      </div>

      {page.view_type === "gallery" && (
        <GalleryPageView collection={mainCollection} filterCollections={filterCollections} canEdit={canEdit} onEdit={openItemSheet} onDelete={removeItem} isPending={isPending} favoriteIds={favoriteIds} />
      )}
      {page.view_type === "files" && (
        <FilesPageView collection={mainCollection} filterCollections={filterCollections} canEdit={canEdit} onEdit={openItemSheet} onDelete={removeItem} isPending={isPending} favoriteIds={favoriteIds} />
      )}
      {page.view_type === "table" && (
        <TablePageView collection={mainCollection} filterCollections={filterCollections} canEdit={canEdit} onEdit={openItemSheet} onDelete={removeItem} isPending={isPending} />
      )}
      {page.view_type === "course" && (
        <CoursePageView collection={mainCollection} />
      )}

      <ConfirmDialog {...dialogProps} />

      {/* Item edit sheet */}
      <Sheet open={itemSheet} onClose={closeItemSheet} onSubmit={saveItem} title={editingItem ? "Editar" : "Novo Item"} wide>
        <div className="flex flex-col gap-4">
          {mainCollection.fields.map((f) => (
            <div key={f.id}>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">{f.name}</label>
              <PageDynamicField field={f} value={itemData[f.slug]} onChange={(val) => setItemData((prev) => ({ ...prev, [f.slug]: val }))} />
            </div>
          ))}
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={saveItem} disabled={isPending} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
              {isPending ? "Salvando..." : editingItem ? "Salvar" : "Criar"}
            </button>
            <button onClick={closeItemSheet} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">Cancelar</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

// === Dynamic field for page editor ===
function PageDynamicField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const cls = "h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10";
  switch (field.field_type) {
    case "text": case "email": case "url":
      if (field.field_type === "text" && field.slug.includes("tag")) return <TagsInput value={String(value || "")} onChange={(v) => onChange(v)} />;
      return <input type={field.field_type === "url" ? "url" : field.field_type === "email" ? "email" : "text"} value={String(value || "")} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "textarea": return <textarea value={String(value || "")} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10 resize-y" />;
    case "rich_text": return <RichTextEditor value={String(value || "")} onChange={(html) => onChange(html)} />;
    case "number": return <input type="number" value={value !== undefined && value !== null ? String(value) : ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={cls} />;
    case "boolean": { const b = Boolean(value); return (<button type="button" onClick={() => onChange(!b)} className="flex items-center gap-2 h-10"><div className={cn("flex h-5 w-5 items-center justify-center rounded border-[1.5px]", b ? "border-brand-olive bg-brand-olive" : "border-ink-300")}>{b && <Check size={11} className="text-white" strokeWidth={3} />}</div><span className="text-sm text-ink-700">{b ? "Sim" : "Não"}</span></button>); }
    case "date": case "datetime": return <input type={field.field_type === "datetime" ? "datetime-local" : "date"} value={String(value || "")} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "color": return (<div className="flex items-center gap-2"><input type="color" value={String(value || "#ffffff")} onChange={(e) => onChange(e.target.value)} className="h-10 w-10 rounded-lg border border-ink-100 cursor-pointer p-0.5" /><input type="text" value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className={cn(cls, "flex-1")} /></div>);
    case "duration": return <DurationInput value={String(value || "")} onChange={(v) => onChange(v)} className={cls} />;
    case "select": {
      const opts = field as unknown as { options?: { choices?: { value: string; label: string; icon?: string }[] } };
      const choices = opts.options?.choices || [];
      return <PageSelectField choices={choices} value={String(value || "")} onChange={(v) => onChange(v)} />;
    }
    case "multi_select": {
      const opts = field as unknown as { options?: { choices?: { value: string; label: string; icon?: string }[] } };
      const choices = opts.options?.choices || [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((o) => {
            const ChoiceIcon = o.icon ? getIconByName(o.icon) : null;
            const isSel = selected.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => onChange(isSel ? selected.filter((v) => v !== o.value) : [...selected, o.value])} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border", isSel ? "border-brand-olive bg-brand-olive text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-olive")}>
                {ChoiceIcon && <ChoiceIcon size={13} />}
                {o.label}
              </button>
            );
          })}
          {choices.length === 0 && <span className="text-xs text-ink-400">Nenhuma opção configurada</span>}
        </div>
      );
    }
    case "image": case "file": return <PageFileField field={field} value={value} onChange={onChange} />;
    case "image_variants": return <PageImageVariantsField field={field} value={value} onChange={onChange} />;
    case "image_array": return <PageImageArrayField field={field} value={value} onChange={onChange} />;
    case "file_array": return <PageFileArrayField field={field} value={value} onChange={onChange} />;
    case "collection_ref": return <PageCollectionRefField field={field} value={value} onChange={onChange} />;
    case "collection_multi_ref": return <PageCollectionMultiRefField field={field} value={value} onChange={onChange} />;
    default: return <input type="text" value={String(value || "")} onChange={(e) => onChange(e.target.value)} className={cls} />;
  }
}

function PageSelectField({ choices, value, onChange }: { choices: { value: string; label: string; icon?: string }[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = choices.find((c) => c.value === value);
  const SelectedIcon = selected?.icon ? getIconByName(selected.icon) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-left text-ink-900 hover:border-ink-200 transition-colors"
      >
        {SelectedIcon && <SelectedIcon size={14} className="text-ink-500 shrink-0" />}
        <span className="flex-1 truncate">{selected?.label || "Selecione..."}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("text-ink-400 shrink-0 transition-transform", open && "rotate-90")}><path d="m9 18 6-6-6-6" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-ink-100 bg-white shadow-dropdown max-h-48 overflow-y-auto">
          <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-400 hover:bg-ink-50 transition-colors">
            Nenhum
          </button>
          {choices.map((c) => {
            const Icon = c.icon ? getIconByName(c.icon) : null;
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

function DurationInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
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
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder="0:00:00"
        className={className}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">hh:mm:ss</span>
    </div>
  );
}

function PageImageVariantsField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const opts = field as unknown as { options?: { formats?: string[] } };
  const formats = opts.options?.formats || ["Original"];
  const variants = (typeof value === "object" && value !== null ? value : {}) as Record<string, string>;
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleUpload(format: string, file: File) {
    setUploading(format);
    const r = await uploadToStorage(file, { bucket: "assets", folder: field.slug });
    setUploading(null);
    if ("url" in r) onChange({ ...variants, [format]: r.url });
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
                <button type="button" onClick={() => removeVariant(format)} className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"><X size={10} /></button>
              </div>
            ) : (
              <label className={cn("flex items-center justify-center gap-2 rounded-md border-2 border-dashed h-16 cursor-pointer transition-colors", uploading === format ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 hover:border-brand-olive")}>
                <input type="file" accept="image/*" className="sr-only" disabled={uploading !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(format, f); }} />
                {uploading === format ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={13} className="text-ink-400" /><span className="text-xs text-ink-500">Enviar {format}</span></>}
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PageFileField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileUrl = String(value || "");
  const isImage = field.field_type === "image";
  async function handleUpload(file: File) {
    setUploading(true);
    const r = await uploadToStorage(file, { bucket: "assets", folder: field.slug });
    setUploading(false);
    if ("url" in r) onChange(r.url);
  }
  return (
    <div className="flex flex-col gap-2">
      {fileUrl && isImage && <div className="relative w-full h-24 rounded-lg border border-ink-100 overflow-hidden bg-ink-50"><img src={fileUrl} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => onChange("")} className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"><X size={10} /></button></div>}
      <label className={cn("flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors", uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30", fileUrl ? "h-10" : "h-20")}>
        <input type="file" accept={isImage ? "image/*" : "*"} className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        {uploading ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{fileUrl ? "Trocar" : isImage ? "Enviar imagem" : "Enviar arquivo"}</span></>}
      </label>
    </div>
  );
}

interface ArrayFileItem { title: string; url: string; filename?: string }

function PageImageArrayField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const items: ArrayFileItem[] = Array.isArray(value) ? (value as ArrayFileItem[]) : [];
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
                  {i > 0 && <button type="button" onClick={() => moveItem(i, i - 1)} className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"><ChevronRight size={10} className="rotate-180" /></button>}
                  {i < items.length - 1 && <button type="button" onClick={() => moveItem(i, i + 1)} className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"><ChevronRight size={10} /></button>}
                  <button type="button" onClick={() => removeItem(i)} className="rounded-full bg-black/50 p-1 text-white hover:bg-danger"><X size={10} /></button>
                </div>
              </div>
              <input type="text" value={item.title} onChange={(e) => updateTitle(i, e.target.value)} placeholder="Título..." className="w-full border-t border-ink-100 px-2 py-1.5 text-xs text-ink-900 bg-white focus:outline-none focus:bg-brand-olive-soft/20" />
            </div>
          ))}
        </div>
      )}
      <label className={cn("flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors", uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30", items.length > 0 ? "h-10" : "h-20")}>
        <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
        {uploading ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{items.length > 0 ? "Adicionar imagens" : "Enviar imagens"}</span></>}
      </label>
      {items.length > 0 && <p className="text-[10px] text-ink-400">{items.length} {items.length === 1 ? "imagem" : "imagens"}</p>}
    </div>
  );
}

function PageFileArrayField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const items: ArrayFileItem[] = Array.isArray(value) ? (value as ArrayFileItem[]) : [];
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
            <input type="text" value={item.title} onChange={(e) => updateTitle(i, e.target.value)} placeholder="Título do arquivo..." className="flex-1 min-w-0 text-sm text-ink-900 bg-transparent focus:outline-none" />
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {i > 0 && <button type="button" onClick={() => moveItem(i, i - 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700"><ChevronRight size={12} className="-rotate-90" /></button>}
              {i < items.length - 1 && <button type="button" onClick={() => moveItem(i, i + 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700"><ChevronRight size={12} className="rotate-90" /></button>}
              <button type="button" onClick={() => removeItem(i)} className="rounded-md p-1 text-ink-400 hover:text-danger"><X size={12} /></button>
            </div>
          </div>
        );
      })}
      <label className={cn("flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors", uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30", items.length > 0 ? "h-10" : "h-20")}>
        <input type="file" multiple className="sr-only" disabled={uploading} onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
        {uploading ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{items.length > 0 ? "Adicionar arquivos" : "Enviar arquivos"}</span></>}
      </label>
      {items.length > 0 && <p className="text-[10px] text-ink-400">{items.length} {items.length === 1 ? "arquivo" : "arquivos"}</p>}
    </div>
  );
}

function PageCollectionRefField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const opts = field as unknown as { options?: { collection_slug?: string } };
  const refSlug = opts.options?.collection_slug || "";
  useEffect(() => {
    if (!refSlug || loaded) return;
    async function load() {
      const supabase = createBrowserClient();
      const { data: col } = await supabase.from("cms_collections").select("id").eq("slug", refSlug).single();
      if (!col) { setLoaded(true); return; }
      const { data: items } = await supabase.from("cms_items").select("id, data").eq("collection_id", col.id).eq("status", "published").order("sort_order");
      const { data: fields } = await supabase.from("cms_fields").select("slug").eq("collection_id", col.id).eq("field_type", "text").order("sort_order").limit(1);
      const titleSlug = fields?.[0]?.slug || "nome";
      setOptions((items || []).map((i) => ({ value: i.id, label: String((i.data as Record<string, unknown>)[titleSlug] || i.id.slice(0, 6)) })));
      setLoaded(true);
    }
    load();
  }, [refSlug, loaded]);
  return <CustomSelect options={[{ value: "", label: "Selecione..." }, ...options]} value={String(value || "")} onChange={(v) => onChange(v)} />;
}

function PageCollectionMultiRefField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const selectedIds = Array.isArray(value) ? (value as string[]) : [];
  const opts = field as unknown as { options?: { collection_slug?: string } };
  const refSlug = opts.options?.collection_slug || "";
  useEffect(() => {
    if (!refSlug || loaded) return;
    async function load() {
      const supabase = createBrowserClient();
      const { data: col } = await supabase.from("cms_collections").select("id").eq("slug", refSlug).single();
      if (!col) { setLoaded(true); return; }
      const { data: items } = await supabase.from("cms_items").select("id, data").eq("collection_id", col.id).eq("status", "published").order("sort_order");
      const { data: fields } = await supabase.from("cms_fields").select("slug").eq("collection_id", col.id).eq("field_type", "text").order("sort_order").limit(1);
      const titleSlug = fields?.[0]?.slug || "nome";
      setOptions((items || []).map((i) => ({ id: i.id, label: String((i.data as Record<string, unknown>)[titleSlug] || i.id.slice(0, 6)) })));
      setLoaded(true);
    }
    load();
  }, [refSlug, loaded]);
  function toggleId(id: string) { onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]); }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (<button key={o.id} type="button" onClick={() => toggleId(o.id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border", selectedIds.includes(o.id) ? "border-brand-olive bg-brand-olive text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-olive")}>{o.label}</button>))}
      {!loaded && <span className="text-xs text-ink-400">Carregando...</span>}
    </div>
  );
}

// === Gallery View (read-only, pra franqueado) ===
function GalleryPageView({ collection, filterCollections = [], canEdit, onEdit, onDelete, isPending, favoriteIds = new Set() }: { collection: CollectionData; filterCollections?: CollectionData[]; canEdit?: boolean; onEdit?: (item: Item) => void; onDelete?: (id: string) => void; isPending?: boolean; favoriteIds?: Set<string> }) {
  const [lightbox, setLightbox] = useState<{ url: string; variants: ImageVariant[] } | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // Track views: collection on mount, individual on detail open
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    // Track first item as page view (represents the collection being viewed)
    if (collection.items[0]) trackEvent(collection.items[0].id, collection.id, "view");
  }, [collection.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenDetail(item: Item) {
    setDetailItem(item);
    trackEvent(item.id, collection.id, "view");
  }

  const imageField = collection.fields.find((f) => f.field_type === "image");
  const variantsField = collection.fields.find((f) => f.field_type === "image_variants");
  const titleField = collection.fields.find((f) => f.field_type === "text");
  const tagsField = collection.fields.find((f) => f.slug === "tags");
  const refField = collection.fields.find((f) => f.field_type === "collection_ref" || f.field_type === "collection_multi_ref");

  const filterCollection = filterCollections[0];
  const filterTitleField = filterCollection?.fields.find((f) => f.field_type === "text");
  const filterCategories = filterCollection?.items.map((item) => ({
    id: item.id,
    label: filterTitleField ? String(item.data[filterTitleField.slug] || "") : item.id.slice(0, 6),
  })) || [];

  const filtered = collection.items.filter((item) => {
    const matchSearch = !search || (() => {
      const title = titleField ? String(item.data[titleField.slug] || "").toLowerCase() : "";
      const tags = tagsField ? String(item.data[tagsField.slug] || "").toLowerCase() : "";
      return title.includes(search.toLowerCase()) || tags.includes(search.toLowerCase());
    })();
    const matchFilter = !activeFilter || (() => {
      if (!refField) return true;
      const val = item.data[refField.slug];
      if (Array.isArray(val)) return val.includes(activeFilter);
      return String(val || "") === activeFilter;
    })();
    return matchSearch && matchFilter;
  });

  const { paginated: paginatedItems, hasMore, loadMore, showing, total } = usePagination(filtered, { pageSize: 24 });

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  }

  async function handleDownloadSelected() {
    if (!imageField) return;
    const items = filtered.filter((i) => selected.has(i.id));
    const files = items.map((i) => {
      const url = String(i.data[imageField.slug] || "");
      const title = titleField ? String(i.data[titleField.slug] || "") : "";
      const ext = url.split(".").pop()?.split("?")[0] || "jpg";
      return { url, filename: `${title || i.id}.${ext}`, itemId: i.id };
    }).filter((f) => f.url);

    if (files.length === 0) return;

    setDownloading(true);
    try {
      if (files.length === 1) {
        await downloadFile(files[0].url, files[0].filename);
      } else {
        await downloadFilesAsZip(files, "essenza-imagens.zip");
      }
      // Track downloads
      for (const f of files) {
        trackEvent(f.itemId, collection.id, "download");
      }
      toast.success(`${files.length} ${files.length === 1 ? "arquivo baixado" : "arquivos baixados"}`);
    } catch {
      toast.error("Erro ao baixar arquivos");
    }
    setDownloading(false);
  }

  async function handleDownloadSingle(url: string, title: string, itemId?: string) {
    const ext = url.split(".").pop()?.split("?")[0] || "jpg";
    await downloadFile(url, `${title || "imagem"}.${ext}`);
    if (itemId) trackEvent(itemId, collection.id, "download");
  }

  return (
    <>
      {filterCategories.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <button onClick={() => setActiveFilter("")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", !activeFilter ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100")}>Todos</button>
          {filterCategories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveFilter(cat.id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", activeFilter === cat.id ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100")}>{cat.label}</button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white py-1 px-3 h-9 flex-1">
          <Search size={14} className="text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar imagens..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
        </div>
        <button onClick={selectAll} className="rounded-lg border border-ink-100 bg-white px-3 h-9 text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors">
          {selected.size === filtered.length && filtered.length > 0 ? "Desmarcar tudo" : "Selecionar tudo"}
        </button>
        {selected.size > 0 && (
          <button
            onClick={handleDownloadSelected}
            disabled={downloading}
            className="flex items-center gap-2 rounded-lg bg-brand-olive px-3 h-9 text-xs font-medium text-white hover:bg-brand-olive-dark transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            {downloading ? "Baixando..." : `Baixar ${selected.size} ${selected.size === 1 ? "imagem" : "imagens"}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {paginatedItems.map((item) => {
          const title = titleField ? String(item.data[titleField.slug] || "") : "";
          const tags = tagsField ? String(item.data[tagsField.slug] || "") : "";
          const isSelected = selected.has(item.id);

          // Image: try dedicated image field, then first variant
          const variantsData = variantsField ? (item.data[variantsField.slug] as Record<string, string> | undefined) : undefined;
          const itemVariants: ImageVariant[] = variantsData
            ? Object.entries(variantsData).filter(([, url]) => url).map(([label, url]) => ({ label, url }))
            : [];
          const imgUrl = (imageField ? String(item.data[imageField.slug] || "") : "") || itemVariants[0]?.url || "";

          // Description (strip HTML)
          const descField = collection.fields.find((f) => f.field_type === "textarea" || f.field_type === "rich_text");
          const rawDesc = descField ? String(item.data[descField.slug] || "") : "";
          const descText = rawDesc.replace(/<[^>]*>/g, "").trim();

          return (
            <div key={item.id} className={cn("rounded-xl border bg-white overflow-hidden transition-colors", isSelected ? "border-brand-olive ring-2 ring-brand-olive/20" : "border-ink-100 hover:border-ink-200")}>
              {/* Image */}
              <div className="relative aspect-square bg-ink-50 cursor-pointer" onClick={() => handleOpenDetail(item)}>
                {imgUrl ? <img src={imgUrl} alt={title} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-ink-300 text-xs">Sem imagem</div>}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                  className={cn("absolute top-1.5 left-1.5 flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-all", isSelected ? "border-brand-olive bg-brand-olive" : "border-white/80 bg-white/60")}
                >
                  {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                </button>
                {itemVariants.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[8px] font-medium text-white flex items-center gap-0.5">
                    <Image size={8} /> {itemVariants.length}
                  </span>
                )}
              </div>

              {/* Info + Actions */}
              <div className="px-2.5 py-2">
                {title && <p className="text-xs font-medium text-ink-900 truncate leading-snug">{title}</p>}
                {descText && <p className="text-[10px] text-ink-400 truncate mt-0.5 leading-snug">{descText}</p>}
                {tags && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 2).map((t) => (
                      <span key={t} className="rounded-full bg-ink-50 px-1.5 py-0.5 text-[8px] text-ink-500">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-0.5 mt-1.5 -mx-0.5">
                  {imgUrl && (
                    <button onClick={() => handleOpenDetail(item)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Ver detalhe"><Eye size={12} /></button>
                  )}
                  {imgUrl && <ImageFormatDownload imageUrl={imgUrl} variants={itemVariants} />}
                  <FavoriteButton itemId={item.id} collectionId={collection.id} initialFavorited={favoriteIds.has(item.id)} size={12} />
                  <div className="flex-1" />
                  {canEdit && <button onClick={() => onEdit?.(item)} className="rounded-md p-1 text-ink-300 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={11} /></button>}
                  {canEdit && <button onClick={() => onDelete?.(item.id)} disabled={isPending} className="rounded-md p-1 text-ink-300 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={11} /></button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex flex-col items-center gap-1 mt-4">
          <button onClick={loadMore} className="rounded-lg border border-ink-200 px-5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            Carregar mais
          </button>
          <span className="text-[10px] text-ink-400">{showing} de {total}</span>
        </div>
      )}

      {filtered.length === 0 && <p className="text-center text-sm text-ink-400 py-8">Nenhuma imagem encontrada</p>}

      {/* Detail modal */}
      {detailItem && (
        <GalleryDetailModal
          item={detailItem}
          collection={collection}
          onClose={() => setDetailItem(null)}
        />
      )}
    </>
  );
}

// === Files View ===
// === Gallery Detail Modal ===
function GalleryDetailModal({ item, collection, onClose }: { item: Item; collection: CollectionData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const titleField = collection.fields.find((f) => f.field_type === "text");
  const descField = collection.fields.find((f) => f.field_type === "textarea" || f.field_type === "rich_text");
  const imageField = collection.fields.find((f) => f.field_type === "image");
  const variantsField = collection.fields.find((f) => f.field_type === "image_variants");
  const dateField = collection.fields.find((f) => f.field_type === "date");
  const selectField = collection.fields.find((f) => f.field_type === "select");

  const title = titleField ? String(item.data[titleField.slug] || "") : "";
  const rawDesc = descField ? String(item.data[descField.slug] || "") : "";
  const descText = rawDesc.replace(/<[^>]*>/g, "").trim();
  const mainImg = imageField ? String(item.data[imageField.slug] || "") : "";
  const variantsData = variantsField ? (item.data[variantsField.slug] as Record<string, string> | undefined) : undefined;
  const variants = variantsData
    ? Object.entries(variantsData).filter(([, url]) => url).map(([label, url]) => ({ label, url }))
    : [];
  const allImages = [...(mainImg ? [{ label: "Original", url: mainImg }] : []), ...variants];
  const date = dateField ? String(item.data[dateField.slug] || "") : "";
  const selectOpts = (selectField as unknown as { options?: { choices?: { value: string; label: string; icon?: string }[] } })?.options || null;
  const selectValue = selectField ? String(item.data[selectField.slug] || "") : "";
  const selectChoice = selectOpts?.choices?.find((c) => c.value === selectValue);

  async function copyDesc() {
    await navigator.clipboard.writeText(descText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="w-full max-w-2xl max-h-[90vh] rounded-xl bg-white shadow-modal overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-ink-100 bg-white">
            <div>
              <h3 className="text-base font-semibold text-ink-900">{title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {selectChoice && (
                  <span className="text-xs text-ink-500">{selectChoice.label}</span>
                )}
                {date && <span className="text-xs text-ink-400">{new Date(date).toLocaleDateString("pt-BR")}</span>}
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Images grid */}
          {allImages.length > 0 && (
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                  {allImages.length} {allImages.length === 1 ? "imagem" : "imagens"}
                </p>
                {allImages.length > 1 && (
                  <button
                    onClick={async () => {
                      const JSZip = (await import("jszip")).default;
                      const { saveAs } = await import("file-saver");
                      const zip = new JSZip();
                      await Promise.all(allImages.map(async (img) => {
                        const res = await fetch(img.url);
                        const blob = await res.blob();
                        const ext = img.url.split(".").pop()?.split("?")[0] || "jpg";
                        zip.file(`${title}_${img.label}`.replace(/\s+/g, "_") + `.${ext}`, blob);
                      }));
                      if (descText) zip.file("descricao.txt", descText);
                      const content = await zip.generateAsync({ type: "blob" });
                      saveAs(content, `${title || "imagens"}.zip`.replace(/\s+/g, "_"));
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-olive hover:text-brand-olive-dark transition-colors"
                  >
                    <Download size={12} /> Baixar todas
                  </button>
                )}
              </div>
              <div className={cn("grid gap-3", allImages.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                {allImages.map((img) => (
                  <div key={img.label} className="rounded-lg border border-ink-100 overflow-hidden">
                    <div className="aspect-square bg-ink-50 cursor-pointer" onClick={() => setLightbox(img.url)}>
                      <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs font-medium text-ink-700">{img.label}</span>
                      <div className="flex items-center gap-0.5">
                        <ShareLink imageUrl={img.url} />
                        <button
                          onClick={() => { const a = document.createElement("a"); a.href = img.url; a.download = `${title}_${img.label}`.replace(/\s+/g, "_"); a.click(); }}
                          className="rounded-md p-1 text-ink-400 hover:text-brand-olive transition-colors"
                          title="Baixar"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {descText && (
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Descrição</p>
                <button
                  onClick={copyDesc}
                  className="flex items-center gap-1 text-xs text-ink-500 hover:text-brand-olive transition-colors"
                >
                  {copied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                </button>
              </div>
              <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawDesc) }} />
            </div>
          )}

          {/* Other fields */}
          <div className="px-5 pt-4 pb-5">
            {collection.fields
              .filter((f) => !["text", "textarea", "rich_text", "image", "image_variants", "collection_ref", "collection_multi_ref"].includes(f.field_type) && item.data[f.slug])
              .map((f) => {
                const val = item.data[f.slug];
                if (!val) return null;
                let display = String(val);
                if (f.field_type === "date") display = new Date(display).toLocaleDateString("pt-BR");
                if (f.field_type === "select") {
                  const o = ((f as unknown as { options?: { choices?: { value: string; label: string }[] } }).options)?.choices?.find((c) => c.value === String(val));
                  display = o?.label || display;
                }
                return (
                  <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-ink-50 last:border-0">
                    <span className="text-xs text-ink-400">{f.name}</span>
                    <span className="text-xs text-ink-700">{display}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Lightbox from detail */}
      {lightbox && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-8" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={20} /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

function FilesPageView({ collection, filterCollections = [], canEdit, onEdit, onDelete, isPending, favoriteIds = new Set() }: { collection: CollectionData; filterCollections?: CollectionData[]; canEdit?: boolean; onEdit?: (item: Item) => void; onDelete?: (id: string) => void; isPending?: boolean; favoriteIds?: Set<string> }) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const titleField = collection.fields.find((f) => f.field_type === "text");
  const descField = collection.fields.find((f) => f.field_type === "textarea");
  const fileField = collection.fields.find((f) => f.field_type === "file");
  const imageField = collection.fields.find((f) => f.field_type === "image");
  const dateField = collection.fields.find((f) => f.field_type === "date");
  const refField = collection.fields.find((f) => f.field_type === "collection_ref" || f.field_type === "collection_multi_ref");
  const downloadField = fileField || imageField;

  // Build filter tabs from filter collections
  const filterCollection = filterCollections[0];
  const filterTitleField = filterCollection?.fields.find((f) => f.field_type === "text");
  const filterCategories = filterCollection?.items.map((item) => ({
    id: item.id,
    label: filterTitleField ? String(item.data[filterTitleField.slug] || "") : item.id.slice(0, 6),
  })) || [];

  const filtered = collection.items.filter((item) => {
    const matchSearch = !search || (titleField ? String(item.data[titleField.slug] || "").toLowerCase().includes(search.toLowerCase()) : true);
    const matchFilter = !activeFilter || (() => {
      if (!refField) return true;
      const val = item.data[refField.slug];
      if (Array.isArray(val)) return val.includes(activeFilter);
      return String(val || "") === activeFilter;
    })();
    return matchSearch && matchFilter;
  });

  const { paginated: paginatedFiles, hasMore: hasMoreFiles, loadMore: loadMoreFiles, showing: showingFiles, total: totalFiles } = usePagination(filtered, { pageSize: 30 });

  // Track collection view on mount
  const filesTrackedRef = useRef(false);
  useEffect(() => {
    if (filesTrackedRef.current) return;
    filesTrackedRef.current = true;
    if (collection.items[0]) trackEvent(collection.items[0].id, collection.id, "view");
  }, [collection.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Category filter tabs */}
      {filterCategories.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <button
            onClick={() => setActiveFilter("")}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", !activeFilter ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100")}
          >
            Todos
          </button>
          {filterCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", activeFilter === cat.id ? "bg-brand-olive text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100")}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 max-w-xs mb-4">
        <Search size={14} className="text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar arquivos..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
      </div>

      <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
        {paginatedFiles.map((item, i) => {
          const title = titleField ? String(item.data[titleField.slug] || "") : "";
          const desc = descField ? String(item.data[descField.slug] || "") : "";
          const fileUrl = downloadField ? String(item.data[downloadField.slug] || "") : "";
          const date = dateField ? String(item.data[dateField.slug] || "") : "";
          const isImg = imageField && downloadField === imageField && fileUrl;

          return (
            <div key={item.id} className={cn("flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-colors group", i < paginatedFiles.length - 1 && "border-b border-ink-50")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                {isImg ? <img src={fileUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <FileText size={18} className="text-ink-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{title || "Arquivo"}</p>
                {desc && <p className="text-xs text-ink-500 truncate mt-0.5">{desc}</p>}
              </div>
              {date && <span className="text-xs text-ink-400 shrink-0">{new Date(date).toLocaleDateString("pt-BR")}</span>}
              <div className="flex items-center gap-1 shrink-0">
                {fileUrl && <button onClick={() => { downloadFile(fileUrl, title); trackEvent(item.id, collection.id, "download"); }} className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive hover:bg-brand-olive-soft transition-colors" title="Baixar"><Download size={14} /></button>}
                {fileUrl && <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Visualizar"><Eye size={14} /></a>}
                <FavoriteButton itemId={item.id} collectionId={collection.id} initialFavorited={favoriteIds.has(item.id)} size={14} />
                {canEdit && onEdit && <button onClick={() => onEdit(item)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={14} /></button>}
                {canEdit && onDelete && <button onClick={() => onDelete(item.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-sm text-ink-400 py-8">Nenhum arquivo encontrado</p>}
      </div>
      {hasMoreFiles && (
        <div className="flex flex-col items-center gap-1 mt-4">
          <button onClick={loadMoreFiles} className="rounded-lg border border-ink-200 px-5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            Carregar mais
          </button>
          <span className="text-[10px] text-ink-400">{showingFiles} de {totalFiles}</span>
        </div>
      )}
    </>
  );
}

// === Table View ===
function TablePageView({ collection, filterCollections, canEdit, onEdit, onDelete, isPending }: { collection: CollectionData; filterCollections: CollectionData[]; canEdit?: boolean; onEdit?: (item: Item) => void; onDelete?: (id: string) => void; isPending?: boolean }) {
  const [search, setSearch] = useState("");
  const titleField = collection.fields.find((f) => f.field_type === "text");
  const visibleFields = collection.fields.filter((f) => !["boolean", "image", "file"].includes(f.field_type)).slice(0, 4);

  const filtered = collection.items.filter((item) => {
    if (!search) return true;
    const title = titleField ? String(item.data[titleField.slug] || "").toLowerCase() : "";
    return title.includes(search.toLowerCase());
  });

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 max-w-xs mb-4">
        <Search size={14} className="text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
      </div>

      <div className="rounded-xl border border-ink-100 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/30">
              {visibleFields.map((f) => <th key={f.id} className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">{f.name}</th>)}
              <th className="px-4 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                {visibleFields.map((f) => (
                  <td key={f.id} className="px-4 py-3 max-w-[220px] truncate text-ink-900">
                    {f.field_type === "color" ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded border border-ink-100" style={{ backgroundColor: String(item.data[f.slug] || "") }} />
                        <span className="text-xs font-mono text-ink-500">{String(item.data[f.slug] || "")}</span>
                      </span>
                    ) : f.field_type === "rich_text" ? (
                      <span className="prose prose-sm max-w-none truncate block" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(item.data[f.slug] || "—")) }} />
                    ) : String(item.data[f.slug] || "—")}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {collection.fields.some((f) => f.field_type === "file" || f.field_type === "image") && (
                      (() => {
                        const dlField = collection.fields.find((f) => f.field_type === "file" || f.field_type === "image");
                        const url = dlField ? String(item.data[dlField.slug] || "") : "";
                        return url ? <button onClick={() => downloadFile(url)} className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive hover:bg-brand-olive-soft transition-colors" title="Baixar"><Download size={14} /></button> : null;
                      })()
                    )}
                    {canEdit && onEdit && <button onClick={() => onEdit(item)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={14} /></button>}
                    {canEdit && onDelete && <button onClick={() => onDelete(item.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={visibleFields.length + 1} className="text-center text-sm text-ink-400 py-8">Nenhum item encontrado</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// === Course View (Bunny/YouTube/native video + PDF + anti-skip + progress) ===
function CoursePageView({ collection }: { collection: CollectionData }) {
  const titleField = collection.fields.find((f) => f.field_type === "text");
  const descField = collection.fields.find((f) => f.field_type === "textarea" || f.field_type === "rich_text" || f.slug === "descricao");
  const urlField = collection.fields.find((f) => f.field_type === "url");
  const durationField = collection.fields.find((f) => f.field_type === "duration" || f.slug === "duracao");
  const fileField = collection.fields.find((f) => f.field_type === "file" || f.slug === "pdf" || f.slug === "arquivo");

  const [activeIndex, setActiveIndex] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [currentPct, setCurrentPct] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [showPdf, setShowPdf] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxPctRef = useRef(0);
  const ytPlayingRef = useRef(false);

  const lessons = collection.items;
  const activeLesson = lessons[activeIndex];
  const activeTitle = activeLesson && titleField ? String(activeLesson.data[titleField.slug] || "") : "";
  const activeDesc = activeLesson && descField ? String(activeLesson.data[descField.slug] || "") : "";
  const activeUrl = activeLesson && urlField ? String(activeLesson.data[urlField.slug] || "") : "";
  const activePdf = activeLesson && fileField ? String(activeLesson.data[fileField.slug] || "") : "";

  // Detect video source type
  function parseVideoSource(url: string): { type: "youtube" | "bunny" | "native"; embedUrl: string } {
    if (!url) return { type: "native", embedUrl: "" };

    // YouTube: youtube.com/watch?v=, youtu.be/, youtube.com/embed/
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return {
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&disablekb=1&enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`,
      };
    }

    // Bunny: iframe.mediadelivery.net/embed/{lib}/{vid}
    const bunnyMatch = url.match(/mediadelivery\.net\/embed\/(\d+)\/([a-f0-9-]+)/i);
    if (bunnyMatch) {
      return {
        type: "bunny",
        embedUrl: `https://iframe.mediadelivery.net/embed/${bunnyMatch[1]}/${bunnyMatch[2]}?autoplay=false&preload=true&responsive=true&controls=false`,
      };
    }

    // GUID (Bunny without full URL)
    const guidMatch = url.match(/^([a-f0-9-]{36})$/i);
    if (guidMatch) {
      return {
        type: "bunny",
        embedUrl: `https://iframe.mediadelivery.net/embed//${guidMatch[1]}?autoplay=false&preload=true&responsive=true&controls=false`,
      };
    }

    return { type: "native", embedUrl: url };
  }

  const videoSource = parseVideoSource(activeUrl);
  const isIframe = videoSource.type === "youtube" || videoSource.type === "bunny";

  function getDuration(item: Item): string {
    if (!durationField) return "";
    return String(item.data[durationField.slug] || "");
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Load saved progress on mount
  useEffect(() => {
    async function load() {
      const { getLessonProgress } = await import("./course-actions");
      const records = await getLessonProgress(collection.id);
      const map: Record<string, number> = {};
      const completed = new Set<string>();
      for (const r of records) {
        map[r.item_id] = r.watched_pct;
        if (r.completed_at) completed.add(r.item_id);
      }
      setProgressMap(map);
      setCompletedSet(completed);
      setLoadingProgress(false);
    }
    load();
  }, [collection.id]);

  // Reset maxPct when changing lesson
  useEffect(() => {
    maxPctRef.current = progressMap[activeLesson?.id] || 0;
    setCurrentPct(maxPctRef.current);
  }, [activeIndex, activeLesson?.id, progressMap]);

  // Listen to postMessage events for progress (Bunny + YouTube)
  useEffect(() => {
    if (!isIframe || !activeLesson) return;

    function handleMessage(e: MessageEvent) {
      if (!e.data) return;

      // Bunny: { event: "timeupdate", data: { currentTime, duration } }
      if (typeof e.data === "object" && e.data.event === "timeupdate" && e.data.data) {
        const { currentTime: ct, duration: dur } = e.data.data;
        if (dur > 0) {
          const pct = Math.round((ct / dur) * 100);
          if (pct > maxPctRef.current) maxPctRef.current = pct;
          setCurrentPct(maxPctRef.current);
          debouncedSave(activeLesson.id);
        }
      }
      if (typeof e.data === "object" && e.data.event === "ended") {
        completeLesson(activeLesson.id);
      }

      // YouTube: postMessage JSON string with event "onStateChange" or "infoDelivery"
      if (typeof e.data === "string") {
        try {
          const yt = JSON.parse(e.data);
          // YT state: 0=ended, 1=playing, 2=paused
          if (yt.event === "onStateChange") {
            if (yt.info === 0) completeLesson(activeLesson.id);
            if (yt.info === 1) ytPlayingRef.current = true;
            if (yt.info === 2) ytPlayingRef.current = false;
          }
          // YT infoDelivery with currentTime/duration
          if (yt.event === "infoDelivery" && yt.info?.currentTime != null && yt.info?.duration) {
            const pct = Math.round((yt.info.currentTime / yt.info.duration) * 100);
            if (pct > maxPctRef.current) maxPctRef.current = pct;
            setCurrentPct(maxPctRef.current);
            debouncedSave(activeLesson.id);
          }
        } catch { /* not a YT message */ }
      }
    }

    // For YouTube: enable JS API via postMessage
    if (videoSource.type === "youtube") {
      const timer = setTimeout(() => {
        const iframe = document.querySelector<HTMLIFrameElement>("[data-course-iframe]");
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");
        }
      }, 1000);

      window.addEventListener("message", handleMessage);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("message", handleMessage);
        flushSave(activeLesson.id);
      };
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      flushSave(activeLesson.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isIframe, activeLesson?.id, videoSource.type]);

  function debouncedSave(itemId: string) {
    if (!saveTimerRef.current) {
      saveTimerRef.current = setTimeout(() => {
        saveProgress(itemId, maxPctRef.current);
        saveTimerRef.current = null;
      }, 5000);
    }
  }

  function flushSave(itemId: string) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxPctRef.current > 0) {
      saveProgress(itemId, maxPctRef.current);
    }
  }

  function completeLesson(itemId: string) {
    maxPctRef.current = 100;
    setCurrentPct(100);
    saveProgress(itemId, 100);
    markCompleted(itemId);
  }

  // Fallback: native <video> timeupdate for non-Bunny URLs
  function handleNativeTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const video = e.currentTarget;
    if (video.duration > 0) {
      const pct = Math.round((video.currentTime / video.duration) * 100);
      if (pct > maxPctRef.current) maxPctRef.current = pct;
      setCurrentPct(maxPctRef.current);

      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => {
          if (activeLesson) saveProgress(activeLesson.id, maxPctRef.current);
          saveTimerRef.current = null;
        }, 5000);
      }
    }
  }

  function handleNativeEnded() {
    if (!activeLesson) return;
    maxPctRef.current = 100;
    setCurrentPct(100);
    saveProgress(activeLesson.id, 100);
    markCompleted(activeLesson.id);
  }

  async function saveProgress(itemId: string, pct: number) {
    setProgressMap((prev) => ({ ...prev, [itemId]: Math.max(prev[itemId] || 0, pct) }));
    const { updateLessonProgress } = await import("./course-actions");
    await updateLessonProgress(itemId, collection.id, pct);
  }

  function markCompleted(itemId: string) {
    setCompletedSet((prev) => new Set([...prev, itemId]));
    // Auto-advance
    if (activeIndex < lessons.length - 1) {
      setTimeout(() => setActiveIndex(activeIndex + 1), 1500);
    }
  }

  // YouTube = livre pra navegar, Bunny/nativo = sequencial
  const isFreeNavigation = videoSource.type === "youtube";

  function isLessonUnlocked(index: number): boolean {
    if (isFreeNavigation) return true;
    if (index === 0) return true;
    const prevLesson = lessons[index - 1];
    return completedSet.has(prevLesson.id);
  }

  function handleLessonClick(index: number) {
    if (!isLessonUnlocked(index)) {
      toast.error("Conclua a aula anterior para desbloquear esta.");
      return;
    }
    setActiveIndex(index);
  }

  const completedCount = lessons.filter((l) => completedSet.has(l.id)).length;

  if (lessons.length === 0) {
    return <p className="text-center text-sm text-ink-400 py-8">Nenhuma aula disponivel</p>;
  }

  return (
    <div className="flex flex-col gap-5">

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
        {/* Main video area */}
        <div className="w-full lg:flex-1 lg:min-w-0 rounded-xl border border-ink-100 bg-white overflow-hidden">
          {/* Video area */}
          <div className="relative aspect-video bg-black overflow-hidden">
            {activeUrl ? (
              isIframe ? (
                <iframe
                  data-course-iframe
                  key={activeUrl}
                  src={videoSource.embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ border: 0 }}
                />
              ) : (
                <video
                  key={activeUrl}
                  src={videoSource.embedUrl}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  onTimeUpdate={handleNativeTimeUpdate}
                  onEnded={handleNativeEnded}
                  onContextMenu={(e) => e.preventDefault()}
                  controlsList="nodownload noplaybackrate nofullscreen"
                  playsInline
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-ink-400 text-sm">
                Nenhum vídeo disponível
              </div>
            )}
          </div>


          {/* Lesson info */}
          <div className="p-4 space-y-2.5">
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Aula {activeIndex + 1} · {activeTitle}
              </p>
              {getDuration(activeLesson) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock size={12} className="text-ink-500" />
                  <span className="text-xs text-ink-500">{getDuration(activeLesson)}</span>
                </div>
              )}
            </div>
            {activeDesc && (
              <div className="text-sm text-ink-500 leading-relaxed prose prose-sm prose-ink max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeDesc) }} />
            )}

            {/* PDF material */}
            {activePdf && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowPdf(true)}
                  className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  <FileText size={14} className="text-brand-olive" />
                  Ver material em PDF
                </button>
                <a
                  href={activePdf}
                  download
                  className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  <FileDown size={14} className="text-ink-400" />
                  Baixar PDF
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Lesson sidebar */}
        <div className="w-full lg:w-[360px] shrink-0 flex flex-col rounded-xl border border-ink-100 bg-white overflow-hidden">
          <div className="px-[18px] py-3.5 border-b border-ink-50">
            <p className="text-sm font-semibold text-ink-900">Aulas</p>
          </div>
          <div className="flex flex-col">
            {lessons.map((lesson, i) => {
              const title = titleField ? String(lesson.data[titleField.slug] || "") : `Aula ${i + 1}`;
              const dur = getDuration(lesson);
              const isActive = i === activeIndex;
              const isCompleted = completedSet.has(lesson.id);
              const unlocked = isLessonUnlocked(i);
              const savedPct = progressMap[lesson.id] || 0;
              const lessonPct = isActive ? currentPct : isCompleted ? 100 : savedPct;

              return (
                <button
                  key={lesson.id}
                  onClick={() => handleLessonClick(i)}
                  className={cn(
                    "flex items-center gap-4 px-[18px] py-3.5 text-left transition-colors border-b border-ink-50 last:border-0",
                    isActive ? "bg-ink-100" : unlocked ? "hover:bg-ink-50" : "opacity-50 cursor-not-allowed"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    isActive ? "bg-brand-olive" : "bg-white"
                  )}>
                    {isCompleted ? (
                      <Check size={12} className={isActive ? "text-white" : "text-brand-olive"} strokeWidth={3} />
                    ) : unlocked ? (
                      <Play size={12} className={cn("ml-0.5", isActive ? "text-white" : "text-ink-400")} />
                    ) : (
                      <Lock size={12} className="text-ink-300" />
                    )}
                  </div>

                  {/* Lesson info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm truncate", isActive ? "font-semibold text-ink-900" : "text-ink-900")}>
                        {i + 1}. {title}
                      </span>
                      {dur && <span className="text-xs text-ink-500 shrink-0">{dur}</span>}
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-[3px] w-full rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-olive transition-all duration-300"
                        style={{ width: `${lessonPct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PDF Modal */}
      {showPdf && activePdf && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6" onClick={() => setShowPdf(false)}>
          <div className="relative w-full max-w-4xl h-[85vh] rounded-xl bg-white shadow-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
              <p className="text-sm font-semibold text-ink-900">Material — {activeTitle}</p>
              <div className="flex items-center gap-2">
                <a
                  href={activePdf}
                  download
                  className="flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  <FileDown size={13} /> Baixar
                </a>
                <button onClick={() => setShowPdf(false)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={`${activePdf}#toolbar=0`}
              className="w-full h-[calc(85vh-52px)]"
              style={{ border: 0 }}
              title="Material PDF"
            />
          </div>
        </div>
      )}
    </div>
  );
}
