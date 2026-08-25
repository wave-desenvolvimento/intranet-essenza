"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { DndContext, DragOverlay, useDroppable, useDraggable, pointerWithin, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { Download, Eye, ZoomIn, X, FileText, File, Image, Trash2, Search, Plus, Pencil, Check, Upload, Play, Clock, GraduationCap, Lock, FileDown, Copy, ChevronRight, ChevronUp, ChevronDown, ImageIcon, Folder, FolderPlus, FolderOpen, ArrowLeft, MoreVertical, FolderInput, GripVertical, Video } from "lucide-react";
import { cn, isAssetVisible, getAssetScheduleStatus } from "@/lib/utils";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Sheet } from "@/components/ui/sheet";
import { CustomSelect } from "@/components/ui/custom-select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createItem, updateItem, deleteItem } from "@/app/(dashboard)/cms/actions";
import { createFolder, updateFolder, deleteFolder, moveFolder, moveItemsToFolder, type Folder as FolderType } from "@/app/(dashboard)/cms/folder-actions";
import { uploadToStorage, uploadToStorageWithProgress, uploadVideoWithProgress } from "@/lib/upload";
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
import { LibraryPicker } from "@/components/ui/library-picker";

interface Field {
  id: string;
  name: string;
  slug: string;
  field_type: string;
  required?: boolean;
}

interface Item {
  id: string;
  data: Record<string, unknown>;
  status: string;
  sort_order: number;
  created_at: string;
  folder_id?: string | null;
  tags?: string[];
  published_at?: string | null;
  expires_at?: string | null;
}

interface CollectionData {
  id: string;
  name: string;
  slug: string;
  role: string;
  fields: Field[];
  items: Item[];
}

interface CollectionMeta {
  id: string;
  name: string;
  slug: string;
  icon?: string;
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
  folders: FolderType[];
  allCollections: CollectionMeta[];
  initialFolderId?: string;
  initialItemId?: string;
  folderCardStyle?: string;
}

export function PageRenderer({ page, collections, folders: initialFolders, allCollections, initialFolderId, initialItemId, folderCardStyle = "default" }: Props) {
  const mainCollection = collections.find((c) => c.role === "main");
  const filterCollections = collections.filter((c) => c.role === "filter");
  const { can } = usePermissions();
  const [isPending, startTransition] = useTransition();
  const [itemSheet, setItemSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemData, setItemData] = useState<Record<string, unknown>>({});
  const [itemStatus, setItemStatus] = useState("published");
  const [itemTags, setItemTags] = useState<string[]>([]);
  const [itemPublishedAt, setItemPublishedAt] = useState("");
  const [itemExpiresAt, setItemExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { confirm, dialogProps } = useConfirm();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  // Folder state - initialize from URL params to survive revalidation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId || null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>(() => {
    if (!initialFolderId) return [];
    const path: { id: string; name: string }[] = [];
    let walkId: string | null = initialFolderId;
    let depth = 0;
    while (walkId && depth < 20) {
      const f = initialFolders.find((fo) => fo.id === walkId);
      if (!f) break;
      path.unshift({ id: f.id, name: f.name });
      walkId = f.parent_id;
      depth++;
    }
    return path;
  });
  const [folderSheet, setFolderSheet] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderCollectionId, setFolderCollectionId] = useState("");
  const [folderIcon, setFolderIcon] = useState("folder");
  const [folderCover, setFolderCover] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [moveSheet, setMoveSheet] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [dndActiveId, setDndActiveId] = useState<string | null>(null);
  const [moveFolderSheet, setMoveFolderSheet] = useState(false);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const folders = initialFolders;

  const handleDndEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDndActiveId(null);
    if (!over || active.id === over.id) return;

    const sourceId = String(active.id);
    const targetId = over.id === "__root__" ? null : String(over.id);

    const draggedFolder = folders.find((f) => f.id === sourceId);
    if (!draggedFolder) return;
    if (draggedFolder.parent_id === targetId) return; // already there

    // Prevent circular move
    if (targetId) {
      const isChild = (parentId: string, checkId: string): boolean => {
        const children = folders.filter((f) => f.parent_id === parentId);
        return children.some((c) => c.id === checkId || isChild(c.id, checkId));
      };
      if (isChild(sourceId, targetId)) {
        toast.error("Nao e possivel mover uma pasta para dentro de si mesma.");
        return;
      }
    }

    startTransition(async () => {
      const res = await moveFolder(sourceId, targetId);
      if (res.error) toast.error(res.error);
      else toast.success("Pasta movida");
    });
  }, [folders, startTransition]);

  // Deep-link: highlight item from search
  useEffect(() => {
    if (initialItemId) {
      setHighlightedItemId(initialItemId);
      setTimeout(() => {
        const el = document.querySelector(`[data-item-id="${initialItemId}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      setTimeout(() => setHighlightedItemId(null), 3500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load favorite IDs
  useEffect(() => {
    getUserFavoriteIds().then((ids) => setFavoriteIds(new Set(ids)));
  }, []);

  // Determine module from page slug for permission check
  const moduleSlug = page.slug;
  const canCreate = can(`${moduleSlug}.create`) || can("cms.create");
  const canEdit = can(`${moduleSlug}.edit`) || can("cms.edit");

  // Sync folder state to URL so it survives revalidation/reload
  useEffect(() => {
    const url = new URL(window.location.href);
    if (currentFolderId) {
      url.searchParams.set("folder", currentFolderId);
    } else {
      url.searchParams.delete("folder");
    }
    url.searchParams.delete("item");
    window.history.replaceState({}, "", url.toString());
  }, [currentFolderId]);

  // Get subfolders for current location
  const currentSubfolders = folders.filter((f) =>
    currentFolderId ? f.parent_id === currentFolderId : !f.parent_id
  );

  // Get the active collection for current folder (may differ from main)
  function getActiveCollection(): CollectionData | undefined {
    if (!currentFolderId) return mainCollection;
    // Walk up folders to find collection_id
    let checkId: string | null = currentFolderId;
    let depth = 0;
    while (checkId && depth < 20) {
      const folder = folders.find((f) => f.id === checkId);
      if (!folder) break;
      if (folder.collection_id) {
        const col = collections.find((c) => c.id === folder.collection_id);
        if (col) return col;
      }
      checkId = folder.parent_id;
      depth++;
    }
    return mainCollection;
  }

  const activeCollection = getActiveCollection();

  // Filter items for current folder
  const folderItems = activeCollection
    ? activeCollection.items.filter((item) => {
        if (currentFolderId) return item.folder_id === currentFolderId;
        // Root: items without folder_id
        return !item.folder_id;
      })
    : [];

  // Build a virtual collection with filtered items
  const currentCollection = activeCollection
    ? { ...activeCollection, items: folderItems }
    : undefined;

  // Navigate into folder
  function enterFolder(folder: FolderType) {
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedItemIds(new Set());
  }

  // Navigate to specific breadcrumb level
  function navigateTo(index: number) {
    if (index < 0) {
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      const target = folderPath[index];
      setCurrentFolderId(target.id);
      setFolderPath((prev) => prev.slice(0, index + 1));
    }
    setSelectedItemIds(new Set());
  }

  function openFolderSheet(folder?: FolderType) {
    setEditingFolder(folder || null);
    setFolderName(folder?.name || "");
    setFolderCollectionId(folder?.collection_id || "");
    setFolderIcon(folder?.icon || "folder");
    setFolderCover(folder?.cover_url || "");
    setFolderSheet(true);
  }

  function closeFolderSheet() { setFolderSheet(false); setEditingFolder(null); setFolderName(""); setFolderCollectionId(""); setFolderIcon("folder"); setFolderCover(""); }

  function saveFolder() {
    if (!folderName.trim()) return;
    const fd = new FormData();
    fd.set("name", folderName.trim());
    fd.set("icon", folderIcon);
    if (folderCollectionId) fd.set("collectionId", folderCollectionId);
    if (folderCover) fd.set("coverUrl", folderCover);

    if (editingFolder) {
      fd.set("id", editingFolder.id);
      startTransition(async () => {
        const r = await updateFolder(fd);
        if (r?.error) toast.error(r.error);
        else { closeFolderSheet(); toast.success("Pasta atualizada"); }
      });
    } else {
      fd.set("pageId", page.id);
      if (currentFolderId) fd.set("parentId", currentFolderId);
      startTransition(async () => {
        const r = await createFolder(fd);
        if (r?.error) toast.error(r.error);
        else { closeFolderSheet(); toast.success("Pasta criada"); }
      });
    }
  }

  async function removeFolder(id: string) {
    const ok = await confirm({ title: "Remover pasta", message: "Todos os itens dentro desta pasta ficarão sem pasta. Deseja continuar?", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteFolder(id);
      if (r?.error) toast.error(r.error);
      else toast.success("Pasta removida");
    });
  }

  function openMoveFolderSheet(folderId: string) {
    setMovingFolderId(folderId);
    setMoveFolderSheet(true);
  }

  async function handleMoveFolderTo(targetId: string | null) {
    if (!movingFolderId) return;
    if (movingFolderId === targetId) return;
    const movingFolder = folders.find((f) => f.id === movingFolderId);
    if (movingFolder?.parent_id === targetId) {
      toast.error("A pasta ja esta neste local.");
      return;
    }
    // Prevent circular: can't move into own child
    if (targetId) {
      const isChild = (parentId: string, checkId: string): boolean => {
        const children = folders.filter((f) => f.parent_id === parentId);
        return children.some((c) => c.id === checkId || isChild(c.id, checkId));
      };
      if (isChild(movingFolderId, targetId)) {
        toast.error("Nao e possivel mover uma pasta para dentro de si mesma.");
        return;
      }
    }
    startTransition(async () => {
      const res = await moveFolder(movingFolderId, targetId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Pasta movida");
        setMoveFolderSheet(false);
        setMovingFolderId(null);
      }
    });
  }

  async function handleMoveItems(targetFolderId: string | null) {
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await moveItemsToFolder(ids, targetFolderId);
      if (r?.error) toast.error(r.error);
      else { setSelectedItemIds(new Set()); setMoveSheet(false); toast.success(`${ids.length} ${ids.length === 1 ? "item movido" : "itens movidos"}`); }
    });
  }

  function openItemSheet(item?: Item) {
    setEditingItem(item || null);
    setItemData(item?.data || {});
    setItemStatus(item?.status || "published");
    setItemTags(item?.tags || []);
    setItemPublishedAt(item?.published_at ? item.published_at.slice(0, 16) : "");
    setItemExpiresAt(item?.expires_at ? item.expires_at.slice(0, 16) : "");
    setError("");
    setFieldErrors({});
    setItemSheet(true);
  }

  function closeItemSheet() { setItemSheet(false); setEditingItem(null); setFieldErrors({}); }

  function saveItem() {
    if (!activeCollection) return;
    // Validar campos required
    const fields = activeCollection.fields || [];
    const errors: Record<string, string> = {};
    for (const f of fields) {
      if (!f.required) continue;
      const val = itemData[f.slug];
      const isEmpty = val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
      if (isEmpty) errors[f.slug] = "Campo obrigatorio";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Preencha os campos obrigatorios marcados com *");
      setTimeout(() => {
        const el = document.querySelector("[data-field-error]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setFieldErrors({});
    if (itemPublishedAt && itemExpiresAt && new Date(itemExpiresAt) <= new Date(itemPublishedAt)) { setError("Data de expiracao deve ser posterior ao inicio."); return; }
    const fd = new FormData();
    fd.set("data", JSON.stringify(itemData));
    fd.set("status", itemStatus);
    fd.set("publishedAt", itemPublishedAt ? new Date(itemPublishedAt).toISOString() : "");
    fd.set("expiresAt", itemExpiresAt ? new Date(itemExpiresAt).toISOString() : "");
    fd.set("tags", JSON.stringify(itemTags));
    if (editingItem) {
      fd.set("id", editingItem.id);
      startTransition(async () => { const r = await updateItem(fd); if (r?.error) setError(r.error); else { closeItemSheet(); toast.success("Item atualizado"); } });
    } else {
      fd.set("collectionId", activeCollection.id);
      if (currentFolderId) fd.set("folderId", currentFolderId);
      startTransition(async () => { const r = await createItem(fd); if (r?.error) setError(r.error); else { closeItemSheet(); toast.success("Item criado"); } });
    }
  }

  async function removeItem(id: string) {
    const ok = await confirm({ title: "Remover item", message: "Tem certeza que deseja remover este item? Essa ação não pode ser desfeita.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { await deleteItem(id); toast.success("Item removido"); });
  }

  const hasFolders = folders.length > 0;

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    const r = await uploadToStorage(file, { bucket: "assets", folder: "folder-covers" });
    setUploadingCover(false);
    if ("url" in r) setFolderCover(r.url);
  }

  // Build folders grid node (passed into views to render below search bar)
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const activeFolder = dndActiveId ? currentSubfolders.find((f) => f.id === dndActiveId) : null;

  const foldersGrid = currentSubfolders.length > 0 ? (
    <DndContext collisionDetection={pointerWithin} onDragStart={(e: DragStartEvent) => { setDndActiveId(String(e.active.id)); setFolderMenuId(null); }} onDragEnd={handleDndEnd}>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
        {currentSubfolders.map((folder) => (
          <DndFolderCard
            key={folder.id}
            folder={folder}
            folders={folders}
            canEdit={canEdit}
            isDndActive={dndActiveId === folder.id}
            isMenuOpen={folderMenuId === folder.id}
            cardStyle={folderCardStyle}
            onEnter={() => enterFolder(folder)}
            onToggleMenu={(e) => { e.stopPropagation(); setFolderMenuId(folderMenuId === folder.id ? null : folder.id); }}
            onCloseMenu={() => setFolderMenuId(null)}
            onMove={(e) => { e.stopPropagation(); setFolderMenuId(null); openMoveFolderSheet(folder.id); }}
            onEdit={(e) => { e.stopPropagation(); setFolderMenuId(null); openFolderSheet(folder); }}
            onDelete={(e) => { e.stopPropagation(); setFolderMenuId(null); removeFolder(folder.id); }}
          />
        ))}
      </div>
      {/* Drop zone for root - visible when dragging inside a subfolder */}
      {folderPath.length > 0 && <DndRootDropZone active={!!dndActiveId} />}
      <DragOverlay dropAnimation={null}>
        {activeFolder ? <DndFolderOverlay folder={activeFolder} folders={folders} /> : null}
      </DragOverlay>
    </DndContext>
  ) : null;

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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink-900">{page.title}</h1>
          <span className="text-sm text-ink-400">
            {currentCollection ? currentCollection.items.length : 0} {(currentCollection?.items.length || 0) === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <button onClick={() => openFolderSheet()} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
              <FolderPlus size={16} /> Pasta
            </button>
          )}
          {selectedItemIds.size > 0 && canEdit && (
            <button onClick={() => setMoveSheet(true)} className="flex items-center gap-2 rounded-lg border border-brand-olive px-3 py-2 text-sm font-medium text-brand-olive hover:bg-brand-olive-soft transition-colors">
              <FolderInput size={16} /> Mover {selectedItemIds.size}
            </button>
          )}
          {canCreate && (
            <button onClick={() => openItemSheet()} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
              <Plus size={16} /> Novo
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      {folderPath.length > 0 && (
        <div className="flex items-center gap-1 mb-4 text-sm">
          <button onClick={() => navigateTo(-1)} className="flex items-center gap-1 text-ink-500 hover:text-ink-900 transition-colors">
            <ArrowLeft size={14} />
            {page.title}
          </button>
          {folderPath.map((crumb, i) => {
            const isLast = i === folderPath.length - 1;
            return (
              <span key={crumb.id} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-ink-300" />
                {isLast ? (
                  <span className="font-medium text-ink-900">{crumb.name}</span>
                ) : (
                  <button onClick={() => navigateTo(i)} className="text-ink-500 hover:text-ink-900 transition-colors">
                    {crumb.name}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Folders grid - rendered as node passed into each view (below search) */}
      {/* Content views - using filtered items for current folder */}
      {currentCollection && (
        <>
          {page.view_type === "gallery" && (
            <GalleryPageView collection={currentCollection} filterCollections={filterCollections} canEdit={canEdit} onEdit={openItemSheet} onDelete={removeItem} isPending={isPending} favoriteIds={favoriteIds} foldersNode={foldersGrid} highlightedItemId={highlightedItemId} />
          )}
          {page.view_type === "files" && (
            <FilesPageView collection={currentCollection} filterCollections={filterCollections} canEdit={canEdit} onEdit={openItemSheet} onDelete={removeItem} isPending={isPending} favoriteIds={favoriteIds} foldersNode={foldersGrid} highlightedItemId={highlightedItemId} />
          )}
          {page.view_type === "table" && (
            <TablePageView collection={currentCollection} filterCollections={filterCollections} canEdit={canEdit} onEdit={openItemSheet} onDelete={removeItem} isPending={isPending} foldersNode={foldersGrid} highlightedItemId={highlightedItemId} />
          )}
          {page.view_type === "course" && (
            <CoursePageView collection={currentCollection} />
          )}
        </>
      )}

      {currentSubfolders.length === 0 && (!currentCollection || currentCollection.items.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-12">
          <FolderOpen size={32} className="text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">Pasta vazia</p>
          {canCreate && (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => openFolderSheet()} className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors">
                <FolderPlus size={13} /> Nova pasta
              </button>
              <button onClick={() => openItemSheet()} className="flex items-center gap-1.5 rounded-lg bg-brand-olive px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-olive-dark transition-colors">
                <Plus size={13} /> Novo item
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />

      {/* Folder sheet */}
      <Sheet open={folderSheet} onClose={closeFolderSheet} onSubmit={saveFolder} title={editingFolder ? "Editar pasta" : "Nova pasta"}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Nome</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Nome da pasta"
              className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">
              Foto de capa
              <span className="text-ink-400 font-normal ml-1">opcional</span>
            </label>
            {folderCover ? (
              <div className="relative rounded-lg border border-ink-100 overflow-hidden">
                <img src={folderCover} alt="Capa" className="w-full h-32 object-cover" />
                <button type="button" onClick={() => setFolderCover("")} className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"><X size={12} /></button>
              </div>
            ) : (
              <label className={cn("flex items-center justify-center gap-2 rounded-lg border-2 border-dashed h-24 cursor-pointer transition-colors", uploadingCover ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30")}>
                <input type="file" accept="image/*" className="sr-only" disabled={uploadingCover} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
                {uploadingCover ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">Enviar imagem de capa</span></>}
              </label>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">
              Estrutura (collection)
              <span className="text-ink-400 font-normal ml-1">opcional</span>
            </label>
            <select
              value={folderCollectionId}
              onChange={(e) => setFolderCollectionId(e.target.value)}
              className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10"
            >
              <option value="">Herdar da pasta pai</option>
              {allCollections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-ink-400 mt-1">Define quais campos os itens nesta pasta terão. Se vazio, herda da pasta pai ou da página.</p>
          </div>
          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={saveFolder} disabled={isPending || !folderName.trim()} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50 transition-colors">
              {isPending ? "Salvando..." : editingFolder ? "Salvar" : "Criar pasta"}
            </button>
            <button onClick={closeFolderSheet} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">Cancelar</button>
          </div>
        </div>
      </Sheet>

      {/* Move items sheet */}
      <Sheet open={moveSheet} onClose={() => setMoveSheet(false)} title={`Mover ${selectedItemIds.size} ${selectedItemIds.size === 1 ? "item" : "itens"}`}>
        <div className="flex flex-col gap-2">
          {(() => {
            const isCurrentFolder = currentFolderId === null;
            const renderItemFolderTree = (parentId: string | null, depth: number): React.ReactNode[] => {
              return folders
                .filter((f) => f.parent_id === parentId)
                .map((f) => {
                  const isCurrent = f.id === currentFolderId;
                  const FIcon = f.icon === "folder" ? Folder : (getIconByName(f.icon) || Folder);
                  return (
                    <div key={f.id}>
                      <button
                        onClick={() => handleMoveItems(f.id)}
                        disabled={isCurrent || isPending}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                          isCurrent
                            ? "border-ink-100 bg-ink-50 opacity-50 cursor-not-allowed"
                            : "border-ink-100 hover:bg-brand-olive-soft/20 hover:border-brand-olive/30",
                        )}
                        style={{ paddingLeft: `${16 + depth * 20}px` }}
                      >
                        <FIcon size={16} className="text-brand-olive shrink-0" />
                        <span className="text-sm text-ink-900 truncate">{f.name}</span>
                        {isCurrent && <span className="text-[10px] text-ink-400 shrink-0">(atual)</span>}
                      </button>
                      {renderItemFolderTree(f.id, depth + 1)}
                    </div>
                  );
                });
            };

            return (
              <>
                <button
                  onClick={() => handleMoveItems(null)}
                  disabled={isCurrentFolder || isPending}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    isCurrentFolder
                      ? "border-ink-100 bg-ink-50 opacity-50 cursor-not-allowed"
                      : "border-ink-100 hover:bg-ink-50",
                  )}
                >
                  <ArrowLeft size={16} className="text-ink-400" />
                  <span className="text-sm text-ink-700">Raiz da pagina</span>
                  {isCurrentFolder && <span className="text-[10px] text-ink-400 shrink-0">(atual)</span>}
                </button>
                {renderItemFolderTree(null, 0)}
                {folders.length === 0 && (
                  <p className="text-sm text-ink-400 text-center py-4">Nenhuma pasta disponivel</p>
                )}
              </>
            );
          })()}
        </div>
      </Sheet>

      {/* Move folder sheet */}
      <Sheet open={moveFolderSheet} onClose={() => { setMoveFolderSheet(false); setMovingFolderId(null); }} title="Mover pasta">
        <div className="flex flex-col gap-2">
          {(() => {
            const movingFolder = folders.find((f) => f.id === movingFolderId);
            if (!movingFolder) return null;

            // Build tree of valid destinations
            const isDescendant = (parentId: string, checkId: string): boolean => {
              const children = folders.filter((f) => f.parent_id === parentId);
              return children.some((c) => c.id === checkId || isDescendant(c.id, checkId));
            };

            const renderFolderTree = (parentId: string | null, depth: number): React.ReactNode[] => {
              return folders
                .filter((f) => f.parent_id === parentId)
                .filter((f) => f.id !== movingFolderId && !(movingFolderId && isDescendant(movingFolderId, f.id)))
                .map((f) => {
                  const isCurrentLocation = movingFolder.parent_id === f.id;
                  const FIcon = f.icon === "folder" ? Folder : (getIconByName(f.icon) || Folder);
                  return (
                    <div key={f.id}>
                      <button
                        onClick={() => handleMoveFolderTo(f.id)}
                        disabled={isCurrentLocation || isPending}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                          isCurrentLocation
                            ? "border-ink-100 bg-ink-50 opacity-50 cursor-not-allowed"
                            : "border-ink-100 hover:bg-brand-olive-soft/20 hover:border-brand-olive/30",
                        )}
                        style={{ paddingLeft: `${16 + depth * 20}px` }}
                      >
                        <FIcon size={16} className="text-brand-olive shrink-0" />
                        <span className="text-sm text-ink-900 truncate">{f.name}</span>
                        {isCurrentLocation && <span className="text-[10px] text-ink-400 shrink-0">(local atual)</span>}
                      </button>
                      {renderFolderTree(f.id, depth + 1)}
                    </div>
                  );
                });
            };

            const isAtRoot = movingFolder.parent_id === null;

            return (
              <>
                <button
                  onClick={() => handleMoveFolderTo(null)}
                  disabled={isAtRoot || isPending}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    isAtRoot
                      ? "border-ink-100 bg-ink-50 opacity-50 cursor-not-allowed"
                      : "border-ink-100 hover:bg-ink-50",
                  )}
                >
                  <ArrowLeft size={16} className="text-ink-400" />
                  <span className="text-sm text-ink-700">Raiz da pagina</span>
                  {isAtRoot && <span className="text-[10px] text-ink-400 shrink-0">(local atual)</span>}
                </button>
                {renderFolderTree(null, 0)}
              </>
            );
          })()}
        </div>
      </Sheet>

      {/* Item edit sheet */}
      <Sheet open={itemSheet} onClose={closeItemSheet} onSubmit={saveItem} title={editingItem ? "Editar" : "Novo Item"} wide>
        <div className="flex flex-col gap-4">
          {/* Campo capa fixo */}
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Capa</label>
            <PageFileField field={{ id: "_cover", name: "Capa", slug: "_cover", field_type: "image" }} value={itemData._cover} onChange={(val) => setItemData((prev) => ({ ...prev, _cover: val }))} />
          </div>
          {(activeCollection || mainCollection)?.fields.map((f) => {
            const hasError = !!fieldErrors[f.slug];
            return (
              <div key={f.id} {...(hasError ? { "data-field-error": true } : {})}>
                <label className={cn("text-sm font-medium mb-1.5 block", hasError ? "text-danger" : "text-ink-700")}>{f.name}{f.required && <span className="text-danger ml-0.5">*</span>}</label>
                <div className={hasError ? "rounded-lg ring-2 ring-danger/30" : ""}>
                  <PageDynamicField field={f} value={itemData[f.slug]} onChange={(val) => { setItemData((prev) => ({ ...prev, [f.slug]: val })); if (hasError) setFieldErrors((prev) => { const next = { ...prev }; delete next[f.slug]; return next; }); }} isCourse={page.view_type === "course"} />
                </div>
                {hasError && <p className="text-xs text-danger mt-1">{fieldErrors[f.slug]}</p>}
              </div>
            );
          })}
          {/* Vigencia + Tags */}
          <div className="border-t border-ink-100 pt-4 mt-2">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Vigencia</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Inicio</label>
                <input type="datetime-local" value={itemPublishedAt} onChange={(e) => setItemPublishedAt(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Expiracao</label>
                <input type="datetime-local" value={itemExpiresAt} onChange={(e) => setItemExpiresAt(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" />
              </div>
            </div>
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Tags</p>
            <TagsInput value={itemTags.join(", ")} onChange={(v) => setItemTags(v ? v.split(",").map((t) => t.trim()).filter(Boolean) : [])} placeholder="Digite e pressione virgula..." />
          </div>
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
// === DnD-kit folder components ===

function DndFolderCard({ folder, folders, canEdit, isDndActive, isMenuOpen, cardStyle = "default", onEnter, onToggleMenu, onCloseMenu, onMove, onEdit, onDelete }: {
  folder: FolderType; folders: FolderType[]; canEdit: boolean; isDndActive: boolean; isMenuOpen: boolean; cardStyle?: string;
  onEnter: () => void; onToggleMenu: (e: React.MouseEvent) => void; onCloseMenu: () => void;
  onMove: (e: React.MouseEvent) => void; onEdit: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: folder.id, disabled: !canEdit });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: folder.id });

  const childCount = folders.filter((f) => f.parent_id === folder.id).length;
  const FolderIconComp = folder.icon === "folder" ? Folder : (getIconByName(folder.icon) || Folder);
  const hasCover = !!folder.cover_url;

  const FOLDER_BG_COLORS = [
    "#5C5441", "#6B6352", "#7A7263", "#4A4535",
    "#8B7E6A", "#635C4B", "#544D3E", "#746D5C",
  ];
  const bgIndex = folder.id.charCodeAt(0) % FOLDER_BG_COLORS.length;
  const folderBgHex = FOLDER_BG_COLORS[bgIndex];

  if (cardStyle === "folder") {
    // Estilo formato pasta - clip-path da o shape, capa preenche tudo
    const clipPath = "polygon(0% 6%, 0% 100%, 100% 100%, 100% 6%, 42% 6%, 38% 0%, 0% 0%)";
    return (
      <div
        ref={setDropRef}
        className={cn(
          "group relative cursor-pointer transition-all duration-200 hover:-translate-y-0.5",
          (isDragging || isDndActive) && "opacity-30 scale-95",
          isOver && "scale-[1.03]",
        )}
        style={{ zIndex: isMenuOpen ? 50 : undefined }}
        onClick={() => { if (!isDragging) onEnter(); }}
      >
        {/* Card com shape de pasta via clip-path */}
        <div
          className={cn(
            "transition-all duration-200",
            isOver ? "shadow-lg" : "shadow-sm group-hover:shadow-md",
          )}
          style={{ clipPath }}
        >
          <div className="aspect-[4/3] relative flex items-center justify-center overflow-hidden bg-ink-100 rounded-tr-xl">
            {hasCover ? (
              <img src={folder.cover_url!} alt={folder.name} className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="w-full h-full bg-brand-olive-soft/40 flex items-center justify-center">
                <BrandLogo size={48} className="opacity-15" />
              </div>
            )}
            {isOver && (
              <div className="absolute inset-0 bg-brand-olive/30 flex items-center justify-center backdrop-blur-[1px]">
                <FolderInput size={28} className="text-white drop-shadow-md" />
              </div>
            )}
            {/* Gradiente para legibilidade do texto */}
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        </div>
        {/* Rodape fora do clip-path pra o menu nao ser cortado */}
        <div className="flex items-center gap-2 px-3 py-2 -mt-10 relative z-10">
          {isOver ? (
            <p className="text-sm font-medium text-white truncate flex-1">Soltar aqui</p>
          ) : (
            <>
              {canEdit && (
                <div ref={setDragRef} {...listeners} {...attributes} className="shrink-0 cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-white/20 transition-colors touch-none" onClick={(e) => e.stopPropagation()}>
                  <GripVertical size={14} className="text-white/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate drop-shadow-md">{folder.name}</p>
                {childCount > 0 && <p className="text-[10px] text-white/70 mt-0.5 drop-shadow-sm">{childCount} {childCount === 1 ? "subpasta" : "subpastas"}</p>}
              </div>
              {canEdit && !isOver && (
                <FolderContextMenu isOpen={isMenuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Estilo padrão
  return (
    <div
      ref={setDropRef}
      className={cn(
        "group relative rounded-xl border-2 bg-white cursor-pointer transition-all duration-200",
        (isDragging || isDndActive) && "opacity-30 scale-95",
        isOver ? "border-brand-olive ring-2 ring-brand-olive/30 shadow-lg scale-[1.03] bg-brand-olive-soft/10" : "border-ink-100 hover:border-brand-olive/30 hover:shadow-sm",
      )}
      onClick={() => { if (!isDragging) onEnter(); }}
    >
      <div className="aspect-[4/3] relative overflow-hidden rounded-t-[10px] flex items-center justify-center" style={{ backgroundColor: hasCover ? undefined : folderBgHex }}>
        {hasCover ? (
          <img src={folder.cover_url!} alt={folder.name} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <BrandLogo size={64} className="brightness-0 invert opacity-30" />
        )}
        {isOver && (
          <div className="absolute inset-0 bg-brand-olive/30 flex items-center justify-center backdrop-blur-[1px]">
            <FolderInput size={28} className="text-white drop-shadow-md" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 px-3 py-3">
        {isOver ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-olive/10 shrink-0">
            <FolderInput size={16} className="text-brand-olive" />
          </div>
        ) : (
          <>
            {canEdit && (
              <div ref={setDragRef} {...listeners} {...attributes} className="shrink-0 cursor-grab active:cursor-grabbing -ml-1 -mr-1 p-1.5 rounded-md hover:bg-ink-100 transition-colors touch-none" onClick={(e) => e.stopPropagation()}>
                <GripVertical size={16} className="text-ink-300" />
              </div>
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-olive-soft/50 shrink-0">
              <FolderIconComp size={16} className="text-brand-olive" />
            </div>
          </>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", isOver ? "text-brand-olive" : "text-ink-900")}>
            {isOver ? "Soltar aqui" : folder.name}
          </p>
          {!isOver && childCount > 0 && (
            <p className="text-[11px] text-ink-400 mt-0.5">{childCount} {childCount === 1 ? "subpasta" : "subpastas"}</p>
          )}
        </div>
        {canEdit && !isOver && (
          <FolderContextMenu isOpen={isMenuOpen} onToggle={onToggleMenu} onClose={onCloseMenu} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>
    </div>
  );
}

function DndRootDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "__root__" });
  if (!active) return null;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-center gap-3 rounded-xl border-2 border-dashed py-5 text-sm font-medium transition-all duration-200 mb-2",
        isOver ? "border-brand-olive bg-brand-olive-soft/20 text-brand-olive scale-[1.01] shadow-sm" : "border-ink-200 text-ink-400 hover:border-ink-300",
      )}
    >
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", isOver ? "bg-brand-olive/10" : "bg-ink-100")}>
        <ArrowLeft size={16} />
      </div>
      Soltar aqui para mover para a raiz
    </div>
  );
}

function DndFolderOverlay({ folder, folders }: { folder: FolderType; folders: FolderType[] }) {
  const childCount = folders.filter((f) => f.parent_id === folder.id).length;
  const FolderIconComp = folder.icon === "folder" ? Folder : (getIconByName(folder.icon) || Folder);
  return (
    <div className="rounded-xl border-2 border-brand-olive bg-white shadow-xl px-4 py-3.5 flex items-center gap-3 w-60 rotate-[1.5deg]">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-olive-soft/50 shrink-0">
        <FolderIconComp size={18} className="text-brand-olive" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900 truncate">{folder.name}</p>
        {childCount > 0 && <p className="text-[11px] text-ink-400 mt-0.5">{childCount} {childCount === 1 ? "subpasta" : "subpastas"}</p>}
      </div>
    </div>
  );
}

// === Folder context menu with auto-positioning ===
function FolderContextMenu({ isOpen, onToggle, onClose, onMove, onEdit, onDelete }: {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
  onMove: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [openUp, setOpenUp] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Calculate if menu should open upward
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 140; // approximate height of the 3-item menu
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < menuHeight);
    }
    // Close on click outside
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  return (
    <div className="relative" draggable={false} onDragStart={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={onToggle}
        draggable={false}
        className={cn(
          "rounded-md p-1.5 transition-colors",
          isOpen ? "bg-ink-100 text-ink-700" : "text-ink-400 hover:text-ink-700 hover:bg-ink-100",
        )}
        title="Opcoes"
      >
        <MoreVertical size={14} />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute right-0 z-50 w-40 rounded-lg border border-ink-100 bg-white py-1 shadow-lg",
            openUp ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <button onClick={onMove} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors">
            <FolderInput size={14} className="text-ink-400" />
            Mover para...
          </button>
          <button onClick={onEdit} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors">
            <Pencil size={14} className="text-ink-400" />
            Editar
          </button>
          <div className="my-1 border-t border-ink-100" />
          <button onClick={onDelete} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger-soft transition-colors">
            <Trash2 size={14} className="text-danger/70" />
            Remover
          </button>
        </div>
      )}
    </div>
  );
}

function PageDynamicField({ field, value, onChange, isCourse }: { field: Field; value: unknown; onChange: (val: unknown) => void; isCourse?: boolean }) {
  const cls = "h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10";
  switch (field.field_type) {
    case "text": case "email": case "url":
      if (field.field_type === "text" && field.slug.includes("tag")) return <TagsInput value={String(value || "")} onChange={(v) => onChange(v)} />;
      if (field.field_type === "url" && isCourse) return <VideoUrlField value={String(value || "")} onChange={(v) => onChange(v)} />;
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
    case "video_array": return <PageVideoArrayField field={field} value={value} onChange={onChange} />;
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
  const [pickerFormat, setPickerFormat] = useState<string | null>(null);

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
              <div className="flex gap-2 h-16">
                <label className={cn("flex flex-1 items-center justify-center gap-2 rounded-md border-2 border-dashed cursor-pointer transition-colors", uploading === format ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 hover:border-brand-olive")}>
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(format, f); }} />
                  {uploading === format ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={13} className="text-ink-400" /><span className="text-xs text-ink-500">Enviar</span></>}
                </label>
                <button type="button" onClick={() => setPickerFormat(format)} className="flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-ink-200 px-3 hover:border-brand-olive hover:bg-brand-olive-soft/30 transition-colors">
                  <Image size={13} className="text-ink-400" /><span className="text-xs text-ink-500">Biblioteca</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
      <LibraryPicker open={!!pickerFormat} onClose={() => setPickerFormat(null)} accept="image" onSelect={(items) => { if (pickerFormat) onChange({ ...variants, [pickerFormat]: items[0].url }); }} />
    </div>
  );
}

function PageFileField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileUrl = String(value || "");
  const isImage = field.field_type === "image";
  async function handleUpload(file: File) {
    setUploading(true);
    const r = await uploadToStorage(file, { bucket: "assets", folder: field.slug });
    setUploading(false);
    if ("url" in r) { onChange(r.url); } else { toast.error(r.error); }
  }
  return (
    <div className="flex flex-col gap-2">
      {fileUrl && isImage && <div className="relative w-full h-24 rounded-lg border border-ink-100 overflow-hidden bg-ink-50"><img src={fileUrl} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => onChange("")} className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"><X size={10} /></button></div>}
      <div className={cn("flex gap-2", fileUrl ? "h-10" : "h-20")}>
        <label className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors", uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30")}>
          <input type="file" accept={isImage ? "image/*" : "*"} className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          {uploading ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{fileUrl ? "Trocar" : "Enviar"}</span></>}
        </label>
        <button type="button" onClick={() => setPickerOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/50 px-3 hover:border-brand-olive hover:bg-brand-olive-soft/30 transition-colors">
          <Image size={14} className="text-ink-400" /><span className="text-xs text-ink-500">Biblioteca</span>
        </button>
      </div>
      <LibraryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} accept={isImage ? "image" : "all"} onSelect={(items) => onChange(items[0].url)} />
    </div>
  );
}

interface ArrayFileItem { title: string; url: string; filename?: string; published_at?: string | null; expires_at?: string | null }

function PageAssetSchedulePanel({ item, index, onChange, items }: { item: ArrayFileItem; index: number; onChange: (val: ArrayFileItem[]) => void; items: ArrayFileItem[] }) {
  function update(field: "published_at" | "expires_at", value: string) {
    onChange(items.map((it, i) => i === index ? { ...it, [field]: value || null } : it));
  }
  function clear() {
    onChange(items.map((it, i) => i === index ? { ...it, published_at: null, expires_at: null } : it));
  }
  const inputCls = "h-9 w-full rounded-md border border-ink-100 bg-white px-2.5 text-xs text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-1 focus:ring-brand-olive/10";
  return (
    <div className="border-t border-ink-100 p-2.5 bg-ink-50/50">
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Agendamento</p>
      <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-xs font-medium text-ink-600 block mb-1">Entra em</label>
        <input type="datetime-local" value={item.published_at?.slice(0, 16) || ""} onChange={(e) => update("published_at", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-600 block mb-1">Sai em</label>
        <input type="datetime-local" value={item.expires_at?.slice(0, 16) || ""} onChange={(e) => update("expires_at", e.target.value)} className={inputCls} />
      </div>
      </div>
      {(item.published_at || item.expires_at) && (
        <button type="button" onClick={clear} className="text-xs text-danger hover:underline mt-1.5">Limpar agendamento</button>
      )}
    </div>
  );
}

function PageImageArrayField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const items: ArrayFileItem[] = Array.isArray(value) ? (value as ArrayFileItem[]) : [];
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [schedulingIdx, setSchedulingIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

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
    if (schedulingIdx === index) setSchedulingIdx(null);
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function handleDragEnd() {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      moveItem(dragIdx, overIdx);
    }
    setDragIdx(null);
    setOverIdx(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {items.map((item, i) => {
            const schedStatus = getAssetScheduleStatus(item);
            const hasSchedule = !!(item.published_at || item.expires_at);
            return (
              <div
                key={i}
                draggable
                onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverIdx(i); }}
                onDragLeave={() => { if (overIdx === i) setOverIdx(null); }}
                className={cn(
                  "rounded-lg border overflow-hidden group transition-all",
                  dragIdx === i && "opacity-40 scale-95",
                  overIdx === i && dragIdx !== null && dragIdx !== i && "ring-2 ring-brand-olive border-brand-olive",
                  schedStatus === "scheduled" ? "border-warning bg-warning-soft/20" : schedStatus === "expired" ? "border-ink-200 opacity-60" : "border-ink-100 bg-ink-50/30",
                )}
              >
                <div className="relative h-24">
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover cursor-grab active:cursor-grabbing" />
                  {schedStatus === "scheduled" && (
                    <span className="absolute top-1 left-1 rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-semibold text-white flex items-center gap-0.5 shadow-sm">
                      <Clock size={8} />{item.published_at ? new Date(item.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Agendado"}
                    </span>
                  )}
                  {schedStatus === "expired" && (
                    <span className="absolute top-1 left-1 rounded-full bg-ink-400 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">Expirado</span>
                  )}
                  <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={14} className="text-white drop-shadow-md" />
                  </div>
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    <button type="button" onClick={() => setSchedulingIdx(schedulingIdx === i ? null : i)} className={cn("rounded-full p-1 text-white", hasSchedule ? "bg-warning hover:bg-warning/80" : "bg-black/50 hover:bg-black/70")} title="Agendar"><Clock size={10} /></button>
                    <button type="button" onClick={() => removeItem(i)} className="rounded-full bg-black/50 p-1 text-white hover:bg-danger"><X size={10} /></button>
                  </div>
                </div>
                <input type="text" value={item.title} onChange={(e) => updateTitle(i, e.target.value)} placeholder="Titulo..." className="w-full border-t border-ink-100 px-2 py-1.5 text-xs text-ink-900 bg-white focus:outline-none focus:bg-brand-olive-soft/20" />
                {schedulingIdx === i && (
                  <PageAssetSchedulePanel item={item} index={i} onChange={(v) => onChange(v)} items={items} />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className={cn("flex gap-2", items.length > 0 ? "h-10" : "h-20")}>
        <label className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors", uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30")}>
          <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
          {uploading ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{items.length > 0 ? "Adicionar" : "Enviar"}</span></>}
        </label>
        <button type="button" onClick={() => setPickerOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/50 px-3 hover:border-brand-olive hover:bg-brand-olive-soft/30 transition-colors">
          <Image size={14} className="text-ink-400" /><span className="text-xs text-ink-500">Biblioteca</span>
        </button>
      </div>
      {items.length > 0 && <p className="text-[10px] text-ink-400">{items.length} {items.length === 1 ? "imagem" : "imagens"}</p>}
      <LibraryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} accept="image" multiple onSelect={(selected) => onChange([...items, ...selected.map((s) => ({ title: s.title, url: s.url }))])} />
    </div>
  );
}

function PageFileArrayField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const items: ArrayFileItem[] = Array.isArray(value) ? (value as ArrayFileItem[]) : [];
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [schedulingIdx, setSchedulingIdx] = useState<number | null>(null);

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
      } else {
        toast.error(`Erro ao enviar "${file.name}": ${r.error}`);
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
    if (schedulingIdx === index) setSchedulingIdx(null);
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
        const schedStatus = getAssetScheduleStatus(item);
        const hasSchedule = !!(item.published_at || item.expires_at);
        return (
          <div key={i} className={cn(
            "rounded-lg border overflow-hidden",
            schedStatus === "scheduled" ? "border-warning bg-warning-soft/20" : schedStatus === "expired" ? "border-ink-200 opacity-60" : "border-ink-100 bg-white",
          )}>
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-50">
                <span className="text-[8px] font-bold text-ink-500">{ext}</span>
              </div>
              <input type="text" value={item.title} onChange={(e) => updateTitle(i, e.target.value)} placeholder="Titulo do arquivo..." className="flex-1 min-w-0 text-sm text-ink-900 bg-transparent focus:outline-none" />
              {schedStatus === "scheduled" && (
                <span className="rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-semibold text-white flex items-center gap-0.5 shrink-0">
                  <Clock size={8} />{item.published_at ? new Date(item.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Agendado"}
                </span>
              )}
              {schedStatus === "expired" && (
                <span className="rounded-full bg-ink-400 px-1.5 py-0.5 text-[9px] font-semibold text-white shrink-0">Expirado</span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                {i > 0 && <button type="button" onClick={() => moveItem(i, i - 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700" title="Mover para cima"><ChevronUp size={12} /></button>}
                {i < items.length - 1 && <button type="button" onClick={() => moveItem(i, i + 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700" title="Mover para baixo"><ChevronDown size={12} /></button>}
                <button type="button" onClick={() => setSchedulingIdx(schedulingIdx === i ? null : i)} className={cn("rounded-md p-1", hasSchedule ? "text-warning hover:text-warning/80" : "text-ink-400 hover:text-ink-700")} title="Agendar exibicao"><Clock size={12} /></button>
                <button type="button" onClick={() => removeItem(i)} className="rounded-md p-1 text-ink-400 hover:text-danger" title="Remover arquivo"><X size={12} /></button>
              </div>
            </div>
            {schedulingIdx === i && (
              <PageAssetSchedulePanel item={item} index={i} onChange={(v) => onChange(v)} items={items} />
            )}
          </div>
        );
      })}
      <div className={cn("flex gap-2", items.length > 0 ? "h-10" : "h-20")}>
        <label className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors", uploading ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30")}>
          <input type="file" multiple className="sr-only" disabled={uploading} onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
          {uploading ? <span className="text-xs text-brand-olive font-medium">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{items.length > 0 ? "Adicionar" : "Enviar"}</span></>}
        </label>
        <button type="button" onClick={() => setPickerOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/50 px-3 hover:border-brand-olive hover:bg-brand-olive-soft/30 transition-colors">
          <Image size={14} className="text-ink-400" /><span className="text-xs text-ink-500">Biblioteca</span>
        </button>
      </div>
      {items.length > 0 && <p className="text-[10px] text-ink-400">{items.length} {items.length === 1 ? "arquivo" : "arquivos"}</p>}
      <LibraryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} accept="all" multiple onSelect={(selected) => onChange([...items, ...selected.map((s) => ({ title: s.title, url: s.url }))])} />
    </div>
  );
}

function PageVideoArrayField({ field, value, onChange }: { field: Field; value: unknown; onChange: (val: unknown) => void }) {
  const items: ArrayFileItem[] = Array.isArray(value) ? (value as ArrayFileItem[]) : [];
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [schedulingIdx, setSchedulingIdx] = useState<number | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const uploading = Object.keys(uploadProgress).length > 0;

  async function handleUpload(files: FileList) {
    const videoFiles = Array.from(files).filter((f) => f.type.startsWith("video/"));
    if (videoFiles.length === 0) return;

    const newItems = [...items];

    for (const file of videoFiles) {
      const key = `${file.name}-${Date.now()}`;
      setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

      const r = await uploadToStorageWithProgress(file, {
        bucket: "assets",
        folder: `${field.slug}/videos`,
        onProgress: (pct) => setUploadProgress((prev) => ({ ...prev, [key]: pct })),
      });

      if ("url" in r) {
        const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        newItems.push({ title: name, url: r.url, filename: file.name });
      } else {
        toast.error(`Erro ao enviar "${file.name}": ${r.error}`);
      }

      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    onChange(newItems);
  }

  function updateTitle(index: number, title: string) {
    onChange(items.map((item, i) => i === index ? { ...item, title } : item));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
    if (schedulingIdx === index) setSchedulingIdx(null);
    if (playingIdx === index) setPlayingIdx(null);
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  const totalProgress = Object.values(uploadProgress);
  const avgProgress = totalProgress.length > 0 ? Math.round(totalProgress.reduce((a, b) => a + b, 0) / totalProgress.length) : 0;

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const schedStatus = getAssetScheduleStatus(item);
        const hasSchedule = !!(item.published_at || item.expires_at);
        const isPlaying = playingIdx === i;
        return (
          <div key={i} className={cn(
            "rounded-lg border overflow-hidden",
            schedStatus === "scheduled" ? "border-warning bg-warning-soft/20" : schedStatus === "expired" ? "border-ink-200 opacity-60" : "border-ink-100 bg-white",
          )}>
            {isPlaying ? (
              <div className="relative aspect-video bg-black rounded-t-lg overflow-hidden">
                <video src={item.url} controls autoPlay className="w-full h-full" />
                <button type="button" onClick={() => setPlayingIdx(null)} className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div
                className="relative aspect-video bg-ink-900 rounded-t-lg overflow-hidden cursor-pointer group"
                onClick={() => setPlayingIdx(i)}
              >
                <video src={item.url} muted preload="metadata" className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md group-hover:scale-110 transition-transform">
                    <Play size={18} className="text-ink-700 ml-0.5" />
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-50">
                <Video size={14} className="text-purple-600" />
              </div>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateTitle(i, e.target.value)}
                placeholder="Titulo do video..."
                className="flex-1 min-w-0 text-sm text-ink-900 bg-transparent focus:outline-none"
              />
              {schedStatus === "scheduled" && (
                <span className="rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-semibold text-white flex items-center gap-0.5 shrink-0">
                  <Clock size={8} />Agendado
                </span>
              )}
              {schedStatus === "expired" && (
                <span className="rounded-full bg-ink-400 px-1.5 py-0.5 text-[9px] font-semibold text-white shrink-0">Expirado</span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                {i > 0 && <button type="button" onClick={() => moveItem(i, i - 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700" title="Mover para cima"><ChevronUp size={12} /></button>}
                {i < items.length - 1 && <button type="button" onClick={() => moveItem(i, i + 1)} className="rounded-md p-1 text-ink-400 hover:text-ink-700" title="Mover para baixo"><ChevronDown size={12} /></button>}
                <button type="button" onClick={() => setSchedulingIdx(schedulingIdx === i ? null : i)} className={cn("rounded-md p-1", hasSchedule ? "text-warning hover:text-warning/80" : "text-ink-400 hover:text-ink-700")} title="Agendar exibicao"><Clock size={12} /></button>
                <button type="button" onClick={() => removeItem(i)} className="rounded-md p-1 text-ink-400 hover:text-danger" title="Remover video"><X size={12} /></button>
              </div>
            </div>
            {schedulingIdx === i && (
              <PageAssetSchedulePanel item={item} index={i} onChange={(v) => onChange(v)} items={items} />
            )}
          </div>
        );
      })}

      {/* Upload progress */}
      {uploading && (
        <div className="rounded-lg border border-brand-olive bg-brand-olive-soft/20 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-brand-olive">Enviando {totalProgress.length} video{totalProgress.length > 1 ? "s" : ""}...</span>
            <span className="text-xs font-semibold text-brand-olive">{avgProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-brand-olive/20 overflow-hidden">
            <div className="h-full rounded-full bg-brand-olive transition-all duration-300" style={{ width: `${avgProgress}%` }} />
          </div>
        </div>
      )}

      <label className={cn(
        "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
        uploading ? "border-brand-olive bg-brand-olive-soft/30 pointer-events-none" : "border-ink-200 bg-ink-50/50 hover:border-brand-olive hover:bg-brand-olive-soft/30",
        items.length > 0 ? "h-10" : "h-20"
      )}>
        <input type="file" accept="video/*" multiple className="sr-only" disabled={uploading} onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
        {uploading ? (
          <span className="text-xs text-brand-olive font-medium">Enviando...</span>
        ) : (
          <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">{items.length > 0 ? "Adicionar videos" : "Enviar videos"}</span></>
        )}
      </label>
      {items.length > 0 && <p className="text-[10px] text-ink-400">{items.length} {items.length === 1 ? "video" : "videos"}</p>}
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

function GalleryPageView({ collection, filterCollections = [], canEdit, onEdit, onDelete, isPending, favoriteIds = new Set(), foldersNode, highlightedItemId }: { collection: CollectionData; filterCollections?: CollectionData[]; canEdit?: boolean; onEdit?: (item: Item) => void; onDelete?: (id: string) => void; isPending?: boolean; favoriteIds?: Set<string>; foldersNode?: React.ReactNode; highlightedItemId?: string | null }) {
  const [lightbox, setLightbox] = useState<{ url: string; variants: ImageVariant[] } | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [fileModal, setFileModal] = useState<{ title: string; files: { title: string; url: string }[] } | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // Track views: collection on mount, individual on detail open
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    if (collection.items[0]) trackEvent(collection.items[0].id, collection.id, "view");
  }, [collection.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenDetail(item: Item) {
    setDetailItem(item);
    trackEvent(item.id, collection.id, "view");
  }

  const imageField = collection.fields.find((f) => f.field_type === "image");
  const variantsField = collection.fields.find((f) => f.field_type === "image_variants");
  const imageArrayField = collection.fields.find((f) => f.field_type === "image_array");
  const titleField = collection.fields.find((f) => f.field_type === "text");
  const tagsField = collection.fields.find((f) => f.slug === "tags");
  const refField = collection.fields.find((f) => f.field_type === "collection_ref" || f.field_type === "collection_multi_ref");
  const fileField = collection.fields.find((f) => f.field_type === "file");
  const fileArrayField = collection.fields.find((f) => f.field_type === "file_array");
  const videoArrayField = collection.fields.find((f) => f.field_type === "video_array");
  const hasImages = imageField || variantsField || imageArrayField;

  function getItemFiles(item: Item): { title: string; url: string }[] {
    if (fileArrayField) {
      const arr = Array.isArray(item.data[fileArrayField.slug]) ? (item.data[fileArrayField.slug] as { title?: string; url: string; published_at?: string | null; expires_at?: string | null }[]) : [];
      return arr.filter((f) => isAssetVisible(f)).map((f) => ({ title: f.title || "Arquivo", url: f.url }));
    }
    if (fileField) {
      const url = String(item.data[fileField.slug] || "");
      if (url) return [{ title: titleField ? String(item.data[titleField.slug] || "Arquivo") : "Arquivo", url }];
    }
    return [];
  }

  function handleFileCardClick(item: Item) {
    const title = titleField ? String(item.data[titleField.slug] || "") : "";
    const files = getItemFiles(item);
    if (files.length === 1) {
      window.open(files[0].url, "_blank");
      trackEvent(item.id, collection.id, "download");
    } else if (files.length > 1) {
      setFileModal({ title, files });
      trackEvent(item.id, collection.id, "view");
    }
  }

  const filterCollection = filterCollections[0];
  const filterTitleField = filterCollection?.fields.find((f) => f.field_type === "text");
  const filterCategories = filterCollection?.items.map((item) => ({
    id: item.id,
    label: filterTitleField ? String(item.data[filterTitleField.slug] || "") : item.id.slice(0, 6),
  })) || [];

  const filtered = collection.items.filter((item) => {
    const matchSearch = !search || (() => {
      const q = search.toLowerCase();
      if (JSON.stringify(item.data).replace(/<[^>]*>/g, "").toLowerCase().includes(q)) return true;
      if (item.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
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
    if (!imageField && !imageArrayField) return;
    const items = filtered.filter((i) => selected.has(i.id));
    const files: { url: string; filename: string; itemId: string }[] = [];
    for (const i of items) {
      const title = titleField ? String(i.data[titleField.slug] || "") : "";
      if (imageField) {
        const url = String(i.data[imageField.slug] || "");
        if (url) {
          const ext = url.split(".").pop()?.split("?")[0] || "jpg";
          files.push({ url, filename: `${title || i.id}.${ext}`, itemId: i.id });
        }
      }
      if (imageArrayField && Array.isArray(i.data[imageArrayField.slug])) {
        const arr = i.data[imageArrayField.slug] as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[];
        arr.filter((img) => img.url && isAssetVisible(img)).forEach((img, idx) => {
          const ext = img.url.split(".").pop()?.split("?")[0] || "jpg";
          files.push({ url: img.url, filename: `${title || i.id}_${img.title || idx + 1}.${ext}`, itemId: i.id });
        });
      }
    }

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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={hasImages ? "Buscar imagens..." : "Buscar..."} className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
        </div>
        {hasImages && (
          <>
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
          </>
        )}
      </div>

      {foldersNode}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {paginatedItems.map((item) => {
          const safeStr = (v: unknown) => (v == null || typeof v === "object" ? "" : String(v));
          const title = titleField ? safeStr(item.data[titleField.slug]) : "";
          const tags = tagsField ? safeStr(item.data[tagsField.slug]) : "";
          const isSelected = selected.has(item.id);

          const variantsData = variantsField ? (item.data[variantsField.slug] as Record<string, string> | undefined) : undefined;
          const itemVariants: ImageVariant[] = variantsData && typeof variantsData === "object" && !Array.isArray(variantsData)
            ? Object.entries(variantsData).filter(([, url]) => url).map(([label, url]) => ({ label, url }))
            : [];
          const imageArrayData = imageArrayField && Array.isArray(item.data[imageArrayField.slug]) ? (item.data[imageArrayField.slug] as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[]).filter((a) => isAssetVisible(a)) : [];
          const coverUrl = safeStr(item.data._cover);
          const imgUrl = coverUrl || (imageField ? safeStr(item.data[imageField.slug]) : "") || itemVariants[0]?.url || imageArrayData[0]?.url || "";

          const descFieldLocal = collection.fields.find((f) => f.field_type === "textarea" || f.field_type === "rich_text");
          const rawDesc = descFieldLocal ? safeStr(item.data[descFieldLocal.slug]) : "";
          const descText = rawDesc.replace(/<[^>]*>/g, "").trim();

          const files = getItemFiles(item);
          const firstFileUrl = files[0]?.url || "";
          const firstExt = firstFileUrl ? firstFileUrl.match(/\.(\w{2,5})(?:\?|$)/)?.[1]?.toUpperCase() || "FILE" : "";
          // Detecta conteudo do item para thumbnail e click
          const videoArrayData = videoArrayField && Array.isArray(item.data[videoArrayField.slug]) ? (item.data[videoArrayField.slug] as { title?: string; url: string; published_at?: string | null; expires_at?: string | null }[]).filter((a) => isAssetVisible(a)) : [];
          const itemHasImage = !!imgUrl;
          const itemHasFiles = files.length > 0;
          const itemHasVideos = videoArrayData.length > 0;
          const EXT_COLORS: Record<string, string> = { PDF: "bg-red-50 text-red-600", DOC: "bg-blue-50 text-blue-600", DOCX: "bg-blue-50 text-blue-600", XLS: "bg-green-50 text-green-600", XLSX: "bg-green-50 text-green-600" };

          function onCardClick() {
            // Sempre abre o modal de detalhe - ele sabe renderizar qualquer tipo de campo
            handleOpenDetail(item);
          }

          return (
            <div key={item.id} data-item-id={item.id} className={cn("rounded-xl border bg-white overflow-hidden transition-all", isSelected ? "border-brand-olive ring-2 ring-brand-olive/20" : highlightedItemId === item.id ? "border-brand-olive ring-2 ring-brand-olive/30 animate-pulse" : "border-ink-100 hover:border-ink-200")}>
              {/* Thumbnail */}
              <div
                className={cn(
                  "relative cursor-pointer overflow-hidden aspect-[4/3]",
                  itemHasImage || itemHasVideos ? "bg-ink-50" : "bg-brand-olive-soft/60 flex flex-col items-center justify-center"
                )}
                onClick={onCardClick}
              >
                {itemHasImage ? (
                  <img src={imgUrl} alt={title} className="w-full h-full object-cover" />
                ) : itemHasVideos ? (
                  <>
                    <video src={`${videoArrayData[0].url}#t=0.5`} preload="metadata" muted className="w-full h-full object-cover pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm">
                        <Play size={18} className="text-brand-olive ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                    {videoArrayData.length > 1 && <span className="absolute top-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white">{videoArrayData.length} videos</span>}
                  </>
                ) : itemHasFiles ? (
                  <>
                    <BrandLogo width={148} height={148} />
                    {files.length > 1 && <span className="absolute top-2 right-2 rounded-md bg-brand-olive/70 px-1.5 py-0.5 text-[9px] font-medium text-white">{files.length} arquivos</span>}
                  </>
                ) : (
                  <FileText size={36} className="text-ink-300" />
                )}
                {hasImages && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                    className={cn("absolute top-1.5 left-1.5 flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-all", isSelected ? "border-brand-olive bg-brand-olive" : "border-white/80 bg-white/60")}
                  >
                    {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                  </button>
                )}
                {(itemVariants.length > 0 || imageArrayData.length > 1) && (
                  <span className="absolute top-1.5 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[8px] font-medium text-white flex items-center gap-0.5">
                    <Image size={8} /> {itemVariants.length || imageArrayData.length}
                  </span>
                )}
              </div>

              {/* Info + Actions */}
              <div className="px-2.5 py-2">
                <p className="text-xs font-medium truncate leading-snug">{title ? <span className="text-ink-900">{title}</span> : <span className="text-ink-400 italic">Sem titulo</span>}</p>
                {descText && <p className="text-[10px] text-ink-400 truncate mt-0.5 leading-snug">{descText}</p>}
                {tags && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 2).map((t) => (
                      <span key={t} className="rounded-full bg-ink-50 px-1.5 py-0.5 text-[8px] text-ink-500">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-0.5 mt-1.5 -mx-0.5">
                  <button onClick={() => handleOpenDetail(item)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Ver detalhe"><Eye size={12} /></button>
                  {itemHasImage && <ImageFormatDownload imageUrl={imgUrl} variants={itemVariants} />}
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

      {filtered.length === 0 && !foldersNode && <p className="text-center text-sm text-ink-400 py-8">{hasImages ? "Nenhuma imagem encontrada" : "Nenhum item encontrado"}</p>}

      {/* Detail modal (images) */}
      {detailItem && (
        <GalleryDetailModal
          item={detailItem}
          collection={collection}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* File modal */}
      {fileModal && (
        <FileListModal
          title={fileModal.title}
          files={fileModal.files}
          onClose={() => setFileModal(null)}
        />
      )}
    </>
  );
}

// === Files View ===
// === Gallery Detail Modal ===
function GalleryDetailModal({ item, collection, onClose }: { item: Item; collection: CollectionData; onClose: () => void }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const titleField = collection.fields.find((f) => f.field_type === "text");
  const safeStr = (v: unknown) => (v == null || typeof v === "object" ? "" : String(v));
  const title = titleField ? safeStr(item.data[titleField.slug]) : "";

  // Build sections in field order (skip title field used in header)
  type Section =
    | { kind: "images"; name: string; images: { label: string; url: string }[] }
    | { kind: "files"; name: string; files: { title: string; url: string }[] }
    | { kind: "videos"; name: string; videos: { title: string; url: string }[] }
    | { kind: "detail"; name: string; raw: unknown; type: string; options?: unknown };

  const sections: Section[] = [];
  for (const f of collection.fields) {
    if (f === titleField) continue;
    const raw = item.data[f.slug];
    if (raw == null || raw === "" || raw === false) continue;
    if (Array.isArray(raw) && raw.length === 0) continue;

    switch (f.field_type) {
      case "image": {
        const url = String(raw);
        if (url) sections.push({ kind: "images", name: f.name, images: [{ label: f.name, url }] });
        break;
      }
      case "image_variants": {
        const data = raw as Record<string, string> | undefined;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          const imgs = Object.entries(data).filter(([, url]) => url).map(([label, url]) => ({ label, url }));
          if (imgs.length) sections.push({ kind: "images", name: f.name, images: imgs });
        }
        break;
      }
      case "image_array": {
        const arr = Array.isArray(raw) ? (raw as { url: string; title?: string; published_at?: string | null; expires_at?: string | null }[]) : [];
        const imgs = arr.filter((a) => a.url && isAssetVisible(a)).map((a, i) => ({ label: a.title || `${f.name} ${i + 1}`, url: a.url }));
        if (imgs.length) sections.push({ kind: "images", name: f.name, images: imgs });
        break;
      }
      case "file": {
        const url = String(raw);
        if (url) sections.push({ kind: "files", name: f.name, files: [{ title: f.name, url }] });
        break;
      }
      case "file_array": {
        const arr = Array.isArray(raw) ? (raw as { title?: string; url: string; filename?: string; published_at?: string | null; expires_at?: string | null }[]) : [];
        const fls = arr.filter((a) => a.url && isAssetVisible(a)).map((a) => ({ title: a.title || a.filename || f.name, url: a.url }));
        if (fls.length) sections.push({ kind: "files", name: f.name, files: fls });
        break;
      }
      case "video_array": {
        const arr = Array.isArray(raw) ? (raw as { title?: string; url: string; published_at?: string | null; expires_at?: string | null }[]) : [];
        const vids = arr.filter((a) => a.url && isAssetVisible(a)).map((a) => ({ title: a.title || f.name, url: a.url }));
        if (vids.length) sections.push({ kind: "videos", name: f.name, videos: vids });
        break;
      }
      default:
        sections.push({ kind: "detail", name: f.name, raw, type: f.field_type, options: (f as unknown as { options?: unknown }).options });
        break;
    }
  }

  // Collect all images for zip download
  const allImages = sections.filter((s): s is Section & { kind: "images" } => s.kind === "images").flatMap((s) => s.images);

  function formatDate(v: unknown, withTime: boolean) {
    try {
      return new Date(String(v)).toLocaleDateString("pt-BR", withTime ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return String(v); }
  }

  function renderDetail(section: Section & { kind: "detail" }) {
    const { raw, type, options } = section;
    switch (type) {
      case "rich_text": {
        const html = String(raw);
        return <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700 leading-relaxed prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
      }
      case "textarea":
        return <p className="text-sm text-ink-700 whitespace-pre-wrap rounded-lg bg-ink-50 px-4 py-3">{String(raw)}</p>;
      case "number":
        return <p className="text-sm text-ink-800 font-mono">{String(raw)}</p>;
      case "boolean":
        return <p className="text-sm text-ink-800">{raw ? "Sim" : "Não"}</p>;
      case "date":
        return <p className="text-sm text-ink-800">{formatDate(raw, false)}</p>;
      case "datetime":
        return <p className="text-sm text-ink-800">{formatDate(raw, true)}</p>;
      case "duration":
        return <div className="flex items-center gap-2"><Clock size={14} className="text-ink-400" /><p className="text-sm text-ink-800 font-mono">{String(raw)}</p></div>;
      case "email": {
        const email = String(raw);
        return <a href={`mailto:${email}`} className="text-sm text-brand-olive hover:underline">{email}</a>;
      }
      case "url": {
        const url = String(raw);
        return <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-olive hover:underline break-all">{url}</a>;
      }
      case "color": {
        const color = String(raw);
        return <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-md border border-ink-100 shrink-0" style={{ background: color }} /><span className="text-sm text-ink-800 font-mono">{color}</span></div>;
      }
      case "select": {
        const val = String(raw);
        const choices = (options as { choices?: { value: string; label: string }[] })?.choices;
        const choice = choices?.find((c) => c.value === val);
        return <span className="inline-block rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink-700">{choice?.label || val}</span>;
      }
      case "multi_select": {
        const items = Array.isArray(raw) ? raw.map(String) : [String(raw)];
        const choices = (options as { choices?: { value: string; label: string }[] })?.choices;
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((v, i) => {
              const choice = choices?.find((c) => c.value === v);
              return <span key={i} className="inline-block rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink-700">{choice?.label || v}</span>;
            })}
          </div>
        );
      }
      case "icon_select": {
        const iconName = String(raw);
        const IconComp = getIconByName(iconName);
        return <div className="flex items-center gap-2">{IconComp ? <IconComp size={18} className="text-ink-600" /> : null}<span className="text-sm text-ink-800">{iconName}</span></div>;
      }
      case "collection_ref":
        return <p className="text-sm text-ink-500 font-mono truncate">{String(raw)}</p>;
      case "collection_multi_ref": {
        const refIds = Array.isArray(raw) ? raw.map(String) : [];
        return <div className="flex flex-wrap gap-1">{refIds.map((id, i) => <span key={i} className="inline-block rounded bg-ink-50 px-2 py-0.5 text-[11px] font-mono text-ink-600">{String(id).slice(0, 8)}</span>)}</div>;
      }
      default: {
        const fallback = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
        return <p className="text-sm text-ink-800 break-all">{fallback}</p>;
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="w-full max-w-2xl max-h-[90vh] rounded-xl bg-white shadow-modal overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-ink-100 bg-white">
            <h3 className="text-base font-semibold text-ink-900">{title || "Conteúdo"}</h3>
            <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Sections in field order */}
          <div className="flex flex-col gap-4 px-5 py-4">
            {/* Zip download for all images */}
            {allImages.length > 1 && (
              <div className="flex justify-end -mb-2">
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
                    const content = await zip.generateAsync({ type: "blob" });
                    saveAs(content, `${title || "imagens"}.zip`.replace(/\s+/g, "_"));
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-olive hover:text-brand-olive-dark transition-colors"
                >
                  <Download size={12} /> Baixar todas ({allImages.length})
                </button>
              </div>
            )}

            {sections.map((section, si) => {
              if (section.kind === "images") return (
                <div key={si}>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">{section.name} ({section.images.length})</p>
                  <div className={cn("grid gap-3", section.images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                    {section.images.map((img, i) => (
                      <div key={i} className="rounded-lg border border-ink-100 overflow-hidden">
                        <div className="aspect-square bg-ink-50 cursor-pointer" onClick={() => setLightbox(img.url)}>
                          <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs font-medium text-ink-700">{img.label}</span>
                          <div className="flex items-center gap-0.5">
                            <ShareLink imageUrl={img.url} />
                            <button onClick={() => window.open(img.url, "_blank")} className="rounded-md p-1 text-ink-400 hover:text-brand-olive transition-colors" title="Abrir em nova aba">
                              <Download size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );

              if (section.kind === "files") return (
                <div key={si}>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">{section.name} ({section.files.length})</p>
                  <div className="flex flex-col gap-1">
                    {section.files.map((file, i) => {
                      const ext = file.url.match(/\.(\w{2,5})(?:\?|$)/)?.[1]?.toUpperCase() || "FILE";
                      return (
                        <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2.5 hover:bg-ink-50 transition-colors group">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white border border-ink-100">
                            <span className="text-[8px] font-bold text-ink-500">{ext}</span>
                          </div>
                          <span className="flex-1 text-sm text-ink-700 truncate">{file.title}</span>
                          <Download size={14} className="text-ink-400 group-hover:text-brand-olive shrink-0 transition-colors" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              );

              if (section.kind === "videos") return (
                <div key={si}>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">{section.name} ({section.videos.length})</p>
                  <div className="flex flex-col gap-2">
                    {section.videos.map((vid, i) => (
                      <div key={i} className="rounded-lg border border-ink-100 overflow-hidden">
                        <video src={vid.url} controls preload="metadata" className="w-full aspect-video bg-black" />
                        <div className="px-3 py-2 flex items-center justify-between bg-ink-50/50">
                          <span className="text-xs font-medium text-ink-700 truncate">{vid.title}</span>
                          <a href={vid.url} download className="rounded-md p-1 text-ink-400 hover:text-brand-olive transition-colors" title="Baixar">
                            <Download size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );

              if (section.kind === "detail") return (
                <div key={si}>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">{section.name}</p>
                  {renderDetail(section)}
                </div>
              );

              return null;
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

function FilesPageView({ collection, filterCollections = [], canEdit, onEdit, onDelete, isPending, favoriteIds = new Set(), foldersNode, highlightedItemId }: { collection: CollectionData; filterCollections?: CollectionData[]; canEdit?: boolean; onEdit?: (item: Item) => void; onDelete?: (id: string) => void; isPending?: boolean; favoriteIds?: Set<string>; foldersNode?: React.ReactNode; highlightedItemId?: string | null }) {
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
    const matchSearch = !search || (() => {
      const q = search.toLowerCase();
      if (JSON.stringify(item.data).replace(/<[^>]*>/g, "").toLowerCase().includes(q)) return true;
      if (item.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    })();
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

      {foldersNode}

      <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
        {paginatedFiles.map((item, i) => {
          const title = titleField ? String(item.data[titleField.slug] || "") : "";
          const desc = descField ? String(item.data[descField.slug] || "") : "";
          const fileUrl = downloadField ? String(item.data[downloadField.slug] || "") : "";
          const date = dateField ? String(item.data[dateField.slug] || "") : "";
          const isImg = imageField && downloadField === imageField && fileUrl;

          return (
            <div key={item.id} data-item-id={item.id} className={cn("flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-all group", i < paginatedFiles.length - 1 && "border-b border-ink-50", highlightedItemId === item.id && "bg-brand-olive-soft/40 ring-2 ring-inset ring-brand-olive/30 animate-pulse")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                {String(item.data._cover || "") ? <img src={String(item.data._cover)} alt="" className="h-10 w-10 rounded-lg object-cover" /> : isImg ? <img src={fileUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <FileText size={18} className="text-ink-400" />}
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
        {filtered.length === 0 && !foldersNode && <p className="text-center text-sm text-ink-400 py-8">Nenhum arquivo encontrado</p>}
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
function TablePageView({ collection, filterCollections, canEdit, onEdit, onDelete, isPending, foldersNode, highlightedItemId }: { collection: CollectionData; filterCollections: CollectionData[]; canEdit?: boolean; onEdit?: (item: Item) => void; onDelete?: (id: string) => void; isPending?: boolean; foldersNode?: React.ReactNode; highlightedItemId?: string | null }) {
  const [search, setSearch] = useState("");
  const titleField = collection.fields.find((f) => f.field_type === "text");
  const visibleFields = collection.fields.filter((f) => !["boolean", "image", "file", "file_array", "image_array", "video_array"].includes(f.field_type)).slice(0, 4);

  const filtered = collection.items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (JSON.stringify(item.data).replace(/<[^>]*>/g, "").toLowerCase().includes(q)) return true;
    if (item.tags?.some((t: string) => t.toLowerCase().includes(q))) return true;
    return false;
  });

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 h-9 max-w-xs mb-4">
        <Search size={14} className="text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none" />
      </div>

      {foldersNode}

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
              <tr key={item.id} data-item-id={item.id} className={cn("border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-all", highlightedItemId === item.id && "bg-brand-olive-soft/40 animate-pulse")}>
                {visibleFields.map((f) => (
                  <td key={f.id} className="px-4 py-3 max-w-[220px] truncate text-ink-900">
                    {f.field_type === "color" ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded border border-ink-100" style={{ backgroundColor: String(item.data[f.slug] || "") }} />
                        <span className="text-xs font-mono text-ink-500">{String(item.data[f.slug] || "")}</span>
                      </span>
                    ) : f.field_type === "rich_text" ? (
                      <span className="prose prose-sm max-w-none truncate block" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(item.data[f.slug] || "-")) }} />
                    ) : String(item.data[f.slug] || "-")}
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
            {filtered.length === 0 && !foldersNode && <tr><td colSpan={visibleFields.length + 1} className="text-center text-sm text-ink-400 py-8">Nenhum item encontrado</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// === Course View (Bunny/YouTube/native video + PDF + anti-skip + progress) ===
// === File List Modal (shared: gallery file mode) ===
function FileListModal({ title, files, onClose }: { title: string; files: { title: string; url: string }[]; onClose: () => void }) {
  const FILE_EXT_COLORS: Record<string, string> = { PDF: "bg-red-50 text-red-600", DOC: "bg-blue-50 text-blue-600", DOCX: "bg-blue-50 text-blue-600", XLS: "bg-green-50 text-green-600", XLSX: "bg-green-50 text-green-600", PPT: "bg-orange-50 text-orange-600", PPTX: "bg-orange-50 text-orange-600", ZIP: "bg-yellow-50 text-yellow-700", MP4: "bg-purple-50 text-purple-600" };

  function getExt(url: string) {
    return url.match(/\.(\w{2,5})(?:\?|$)/)?.[1]?.toUpperCase() || "FILE";
  }

  function isImg(url: string) {
    const ext = url.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(ext);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h3 className="text-base font-semibold text-ink-900">{title || "Arquivos"}</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {files.map((file, i) => {
            const ext = getExt(file.url);
            const extColor = FILE_EXT_COLORS[ext] || "bg-ink-100 text-ink-600";
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-ink-100 px-4 py-3 hover:bg-ink-50 transition-colors group"
              >
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", extColor)}>
                  {isImg(file.url) ? <Image size={18} /> : ext === "PDF" ? <FileText size={18} /> : <File size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{file.title}</p>
                  <p className="text-[10px] text-ink-400">{ext}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Abrir"><Eye size={14} /></a>
                  <a href={file.url} target="_blank" rel="noopener noreferrer" download className="rounded-md p-1.5 text-ink-400 hover:text-brand-olive transition-colors" title="Baixar"><Download size={14} /></a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// === Video URL field with upload support for course pages ===
function VideoUrlField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cls = "h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10";

  const isStoragePath = value && !value.startsWith("http") && !value.startsWith("//") && value !== "__protected__";
  const hasValue = !!value && value !== "__protected__";

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de video");
      return;
    }

    setUploading(true);
    setProgress(0);

    const result = await uploadVideoWithProgress(file, setProgress);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      onChange(result.path);
      toast.success("Video enviado");
    }

    setUploading(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="url"
          value={value === "__protected__" ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Cole a URL (YouTube, Bunny) ou envie um video"
          className={cn(cls, "flex-1")}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-ink-100 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors disabled:opacity-50 shrink-0"
        >
          <Upload size={14} />
          Enviar
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>Enviando video...</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-olive transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {hasValue && !uploading && (
        <div className="flex items-center gap-2 text-xs text-ink-500">
          {isStoragePath ? (
            <>
              <Play size={12} className="text-brand-olive" />
              <span className="truncate">Video hospedado: {value}</span>
            </>
          ) : (
            <>
              <Play size={12} className="text-ink-400" />
              <span className="truncate">URL externa: {value}</span>
            </>
          )}
          <button type="button" onClick={() => onChange("")} className="ml-auto text-ink-400 hover:text-danger transition-colors" title="Remover">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [activeUrl, setActiveUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxPctRef = useRef(0);
  const ytPlayingRef = useRef(false);

  const lessons = collection.items;
  const activeLesson = lessons[activeIndex];
  const activeTitle = activeLesson && titleField ? String(activeLesson.data[titleField.slug] || "") : "";
  const activeDesc = activeLesson && descField ? String(activeLesson.data[descField.slug] || "") : "";
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

  // Fetch video URL from server when lesson changes (server-side unlock validation)
  useEffect(() => {
    if (!activeLesson || loadingProgress) return;
    setActiveUrl("");
    setLoadingUrl(true);
    let cancelled = false;
    async function fetchUrl() {
      const { getVideoUrl } = await import("./course-actions");
      const res = await getVideoUrl(activeLesson.id, collection.id);
      if (cancelled) return;
      if ("url" in res) setActiveUrl(res.url);
      else {
        setActiveUrl("");
        if (res.error && res.error !== "URL nao definida") toast.error(res.error);
      }
      setLoadingUrl(false);
    }
    fetchUrl();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeLesson?.id, loadingProgress, collection.id]);

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

  function isLessonUnlocked(index: number): boolean {
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
            {loadingUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <span className="text-xs text-white/60">Carregando aula...</span>
              </div>
            ) : activeUrl ? (
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
                <div className="flex flex-col items-center gap-2">
                  <Lock size={24} className="text-white/30" />
                  <span className="text-white/50">Nenhum video disponivel</span>
                </div>
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
              <p className="text-sm font-semibold text-ink-900">Material - {activeTitle}</p>
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
