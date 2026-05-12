"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, Folder, ArrowRight, Copy, GripVertical, Cog,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  useDroppable, DragOverlay,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPage, updatePage, deletePage, duplicatePage, reorderPages } from "./pages-actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { IconPicker, getIconComponent } from "@/components/ui/icon-picker";

const VIEW_TYPE_OPTIONS = [
  { value: "table", label: "Tabela" }, { value: "gallery", label: "Galeria" },
  { value: "files", label: "Arquivos" }, { value: "course", label: "Curso" },
];
const ROLE_OPTIONS = [
  { value: "main", label: "Principal" }, { value: "filter", label: "Filtro" }, { value: "secondary", label: "Secundária" },
];

const ROOT_CONTAINER = "__root__";

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

// --- Static page row (used in DragOverlay) ---
function PageRowContent({ page, isSystem }: { page: Page; isSystem: boolean }) {
  const Icon = getIconComponent(page.icon) || Folder;
  const linkedCount = page.page_collections?.length || 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-brand-olive shadow-lg">
      <GripVertical size={14} className="text-ink-300 shrink-0" />
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-olive-soft">
        <Icon size={16} className="text-brand-olive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink-900">{page.title}</p>
          {isSystem && (
            <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
              <Cog size={9} /> Sistema
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          {isSystem && page.href ? <span>{page.href}</span> : <span>/pagina/{page.slug}</span>}
          {linkedCount > 0 && <span>· {linkedCount} coleção{linkedCount > 1 ? "s" : ""}</span>}
        </div>
      </div>
    </div>
  );
}

// --- Sortable Item ---
function SortablePageRow({
  page, onEdit, onDuplicate, onDelete, isPending, isSystem,
}: {
  page: Page;
  onEdit: (p: Page) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
  isSystem: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    data: { type: "page", containerId: page.parent_id || ROOT_CONTAINER },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = getIconComponent(page.icon) || Folder;
  const linkedCount = page.page_collections?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-ink-50/50 transition-colors",
        isDragging && "opacity-30"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 shrink-0 touch-none"
        aria-label="Arrastar"
      >
        <GripVertical size={14} />
      </button>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-olive-soft">
        <Icon size={16} className="text-brand-olive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink-900">{page.title}</p>
          {isSystem && (
            <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
              <Cog size={9} /> Sistema
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          {isSystem && page.href ? (
            <span>{page.href}</span>
          ) : (
            <span>/pagina/{page.slug}</span>
          )}
          {!page.is_group && page.view_type && <span>· {page.view_type}</span>}
          {linkedCount > 0 && <span>· {linkedCount} coleção{linkedCount > 1 ? "s" : ""}</span>}
          {page.module && <span>· {page.module}{page.required_action ? `.${page.required_action}` : ""}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onEdit(page)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={13} /></button>
        {!isSystem && (
          <button onClick={() => onDuplicate(page.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Duplicar"><Copy size={13} /></button>
        )}
        <button onClick={() => onDelete(page.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={13} /></button>
        {!page.is_group && (
          <a
            href={isSystem && page.href ? page.href : `/pagina/${page.slug}`}
            className="ml-1 flex items-center gap-1 rounded-lg bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-100 transition-colors"
          >
            Ver <ArrowRight size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

// --- Sortable Section (entire block: header + children) ---
function SortableSection({
  group, children: childrenContent, onEdit, onDelete, isPending,
}: {
  group: Page;
  children: React.ReactNode;
  onEdit: (p: Page) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isSystem = group.page_type === "system";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("mb-4 transition-opacity", isDragging && "opacity-40")}
    >
      <div className="flex items-center gap-2 px-1 mb-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 shrink-0 touch-none"
          aria-label="Arrastar seção"
        >
          <GripVertical size={12} />
        </button>
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{group.title}</p>
        {isSystem && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-ink-100 px-1 py-0.5 text-[9px] font-medium text-ink-400">
            <Cog size={8} /> Sistema
          </span>
        )}
        <button onClick={() => onEdit(group)} className="rounded-md p-0.5 text-ink-300 hover:text-ink-500" title="Editar seção"><Pencil size={10} /></button>
        <button onClick={() => onDelete(group.id)} disabled={isPending} className="rounded-md p-0.5 text-ink-300 hover:text-danger" title="Remover"><Trash2 size={10} /></button>
      </div>
      {childrenContent}
    </div>
  );
}

// --- Section drag overlay (preview when dragging) ---
function SectionOverlay({ group, childCount }: { group: Page; childCount: number }) {
  const isSystem = group.page_type === "system";
  return (
    <div className="rounded-xl border border-brand-olive bg-white shadow-lg px-4 py-3 min-w-[300px]">
      <div className="flex items-center gap-2 mb-1">
        <GripVertical size={12} className="text-ink-300" />
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{group.title}</p>
        {isSystem && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-ink-100 px-1 py-0.5 text-[9px] font-medium text-ink-400">
            <Cog size={8} /> Sistema
          </span>
        )}
      </div>
      <p className="text-xs text-ink-400 pl-5">{childCount} página{childCount !== 1 ? "s" : ""}</p>
    </div>
  );
}

// --- Droppable container for each section ---
function DroppableSection({ id, children, isOver }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver: droppableIsOver } = useDroppable({ id, data: { type: "container" } });
  const highlight = isOver || droppableIsOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border bg-white overflow-hidden divide-y divide-ink-50 transition-colors min-h-[48px]",
        highlight ? "border-brand-olive border-dashed bg-brand-olive-soft/20" : "border-ink-100"
      )}
    >
      {children}
    </div>
  );
}

export function PagesManager({ pages: initialPages, collections }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [pages, setPages] = useState<Page[]>(initialPages);
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<"page" | "section" | null>(null);

  // Sync with server data
  const prevRef = useRef(initialPages);
  if (prevRef.current !== initialPages) {
    prevRef.current = initialPages;
    setPages(initialPages);
  }

  const groupPages = pages.filter((p) => p.is_group);
  const groupOptions = [{ value: "", label: "Nenhum (raiz)" }, ...groupPages.map((p) => ({ value: p.id, label: p.title }))];
  const availableCollections = collections.filter((c) => !c.is_group);
  const collectionOptions = availableCollections.map((c) => ({ value: c.id, label: c.name }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

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

  // --- Drag helpers ---
  const persistOrder = useCallback((items: { id: string; sort_order: number; parent_id: string | null }[]) => {
    startTransition(async () => {
      const r = await reorderPages(items);
      if (r && "error" in r) setError(r.error);
    });
  }, []);

  function getContainerId(pageId: string): string {
    const page = pages.find((p) => p.id === pageId);
    return page?.parent_id || ROOT_CONTAINER;
  }

  function getContainerPages(containerId: string): Page[] {
    if (containerId === ROOT_CONTAINER) {
      return pages.filter((p) => !p.parent_id && !p.is_group);
    }
    return pages.filter((p) => p.parent_id === containerId && !p.is_group);
  }

  // --- Unified drag handlers ---
  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const isSection = pages.some((p) => p.id === id && p.is_group);
    setActiveId(id);
    setActiveDragType(isSection ? "section" : "page");
  }

  function handleDragOver(event: DragOverEvent) {
    // Only cross-container logic for pages, not sections
    if (activeDragType !== "page") return;
    const { active, over } = event;
    if (!over) return;

    const activePageId = active.id as string;
    const overId = over.id as string;

    // Determine which container the "over" item belongs to
    const overPage = pages.find((p) => p.id === overId);
    let targetContainerId: string;

    if (overPage && !overPage.is_group) {
      // Hovering over another page → same container as that page
      targetContainerId = overPage.parent_id || ROOT_CONTAINER;
    } else if (overId === ROOT_CONTAINER || groupPages.some((g) => g.id === overId)) {
      // Hovering over a container droppable directly
      targetContainerId = overId;
    } else {
      return;
    }

    const currentContainerId = getContainerId(activePageId);
    if (currentContainerId === targetContainerId) return;

    // Move page to new container (optimistic)
    const newParentId = targetContainerId === ROOT_CONTAINER ? null : targetContainerId;
    setPages((prev) => prev.map((p) =>
      p.id === activePageId ? { ...p, parent_id: newParentId } : p
    ));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const dragType = activeDragType;
    setActiveId(null);
    setActiveDragType(null);

    if (!over) return;

    // --- Section reorder ---
    if (dragType === "section") {
      if (active.id === over.id) return;
      setPages((prev) => {
        const groups = prev.filter((p) => p.is_group);
        const oldIdx = groups.findIndex((g) => g.id === active.id);
        const newIdx = groups.findIndex((g) => g.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;

        const reordered = arrayMove(groups, oldIdx, newIdx);
        const updated = prev.map((p) => {
          if (!p.is_group) return p;
          const idx = reordered.findIndex((g) => g.id === p.id);
          return { ...p, sort_order: (idx + 1) * 100 };
        });

        persistOrder(updated.filter((p) => p.is_group).map((p) => ({ id: p.id, sort_order: p.sort_order, parent_id: p.parent_id })));
        return updated;
      });
      return;
    }

    // --- Page reorder / cross-section move ---
    const activePageId = active.id as string;
    const overId = over.id as string;

    const overPage = pages.find((p) => p.id === overId && !p.is_group);
    const containerId = overPage
      ? (overPage.parent_id || ROOT_CONTAINER)
      : (overId === ROOT_CONTAINER || groupPages.some((g) => g.id === overId) ? overId : getContainerId(activePageId));

    const containerPages = getContainerPages(containerId);
    const oldIdx = containerPages.findIndex((p) => p.id === activePageId);
    const newIdx = containerPages.findIndex((p) => p.id === overId);

    let reordered = containerPages;
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      reordered = arrayMove(containerPages, oldIdx, newIdx);
    }

    const group = containerId !== ROOT_CONTAINER ? pages.find((p) => p.id === containerId) : null;
    const base = group ? group.sort_order : 0;
    const newParentId = containerId === ROOT_CONTAINER ? null : containerId;

    const updatedItems = reordered.map((p, i) => ({
      id: p.id,
      sort_order: base + i + 1,
      parent_id: newParentId,
    }));

    setPages((prev) => prev.map((p) => {
      const item = updatedItems.find((u) => u.id === p.id);
      if (!item) return p;
      return { ...p, sort_order: item.sort_order, parent_id: item.parent_id };
    }));

    persistOrder(updatedItems);
  }

  // Organize
  const rootPages = pages.filter((p) => !p.parent_id && !p.is_group);
  const grouped = groupPages.map((g) => ({
    group: g,
    children: pages.filter((p) => p.parent_id === g.id && !p.is_group),
  }));

  const activePage = activeId ? pages.find((p) => p.id === activeId) : null;
  const allPageIds = pages.filter((p) => !p.is_group).map((p) => p.id);

  const editingIsSystem = editing?.page_type === "system";

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Pages</h1>
          <p className="text-sm text-ink-500">Arraste páginas entre seções para reorganizar</p>
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

      {/* Single DndContext for pages AND sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Root pages */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-1 mb-2">Sem seção</p>
          <SortableContext items={rootPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <DroppableSection id={ROOT_CONTAINER}>
              {rootPages.length > 0 ? rootPages.map((p) => (
                <SortablePageRow
                  key={p.id}
                  page={p}
                  onEdit={openEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  isPending={isPending}
                  isSystem={p.page_type === "system"}
                />
              )) : (
                <p className="text-xs text-ink-400 px-4 py-3">Arraste páginas aqui para remover da seção</p>
              )}
            </DroppableSection>
          </SortableContext>
        </div>

        {/* Sections — entire block is sortable, pages inside are also sortable */}
        <SortableContext items={groupPages.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          {grouped.map(({ group, children }) => (
            <SortableSection
              key={group.id}
              group={group}
              onEdit={openEdit}
              onDelete={handleDelete}
              isPending={isPending}
            >
              <SortableContext items={children.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <DroppableSection id={group.id}>
                  {children.length > 0 ? children.map((p) => (
                    <SortablePageRow
                      key={p.id}
                      page={p}
                      onEdit={openEdit}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      isPending={isPending}
                      isSystem={p.page_type === "system"}
                    />
                  )) : (
                    <p className="text-xs text-ink-400 px-4 py-3">Arraste páginas para esta seção</p>
                  )}
                </DroppableSection>
              </SortableContext>
            </SortableSection>
          ))}
        </SortableContext>

        {/* Drag overlay */}
        <DragOverlay>
          {activeId && activeDragType === "page" && activePage ? (
            <PageRowContent page={activePage} isSystem={activePage.page_type === "system"} />
          ) : null}
          {activeId && activeDragType === "section" && (() => {
            const group = groupPages.find((g) => g.id === activeId);
            if (!group) return null;
            const childCount = pages.filter((p) => p.parent_id === group.id && !p.is_group).length;
            return <SectionOverlay group={group} childCount={childCount} />;
          })()}
        </DragOverlay>
      </DndContext>

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
              <input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={editingIsSystem} className={cn("h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm font-mono text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10", editingIsSystem && "opacity-50 cursor-not-allowed")} />
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

          {!isGroup && !editingIsSystem && (
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

          {editingIsSystem && (
            <div className="rounded-lg bg-ink-50 px-3 py-2">
              <p className="text-xs text-ink-500">Página de sistema — rota e permissões são fixas. Você pode alterar título, ícone e seção.</p>
            </div>
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
}
