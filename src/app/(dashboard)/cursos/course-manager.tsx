"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, GripVertical, Pencil, Trash2, ChevronRight,
  Play, Upload, Link2, Clock, Film, ArrowLeft,
  Image as ImageIcon, Eye, EyeOff, Video,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { uploadToStorage, uploadVideoWithProgress } from "@/lib/upload";
import {
  type CourseModule,
  type CourseVideo,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  getVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  reorderVideos,
} from "./course-actions";

// ============================================================
// Main Component
// ============================================================

export function CourseManager({
  modules: initialModules,
  canEdit,
}: {
  modules: CourseModule[];
  canEdit: boolean;
  canView: boolean;
}) {
  const [modules, setModules] = useState(initialModules);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Module sheet
  const [moduleSheet, setModuleSheet] = useState<{ open: boolean; module?: CourseModule }>({ open: false });
  // Video sheet
  const [videoSheet, setVideoSheet] = useState<{ open: boolean; video?: CourseVideo }>({ open: false });
  // Confirm dialog
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: "", message: "", onConfirm: () => {},
  });

  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const activeModule = modules.find((m) => m.id === activeModuleId);

  async function openModule(id: string) {
    setActiveModuleId(id);
    setLoadingVideos(true);
    const vids = await getVideos(id);
    setVideos(vids);
    setLoadingVideos(false);
  }

  // ============================================================
  // Module drag-and-drop (simple swap)
  // ============================================================
  const dragModuleRef = useRef<number | null>(null);

  function handleModuleDragStart(index: number) {
    dragModuleRef.current = index;
  }

  function handleModuleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragModuleRef.current === null || dragModuleRef.current === index) return;
    const newModules = [...modules];
    const [dragged] = newModules.splice(dragModuleRef.current, 1);
    newModules.splice(index, 0, dragged);
    dragModuleRef.current = index;
    setModules(newModules);
  }

  function handleModuleDragEnd() {
    dragModuleRef.current = null;
    startTransition(async () => {
      await reorderModules(modules.map((m) => m.id));
    });
  }

  // ============================================================
  // Video drag-and-drop
  // ============================================================
  const dragVideoRef = useRef<number | null>(null);

  function handleVideoDragStart(index: number) {
    dragVideoRef.current = index;
  }

  function handleVideoDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragVideoRef.current === null || dragVideoRef.current === index) return;
    const newVideos = [...videos];
    const [dragged] = newVideos.splice(dragVideoRef.current, 1);
    newVideos.splice(index, 0, dragged);
    dragVideoRef.current = index;
    setVideos(newVideos);
  }

  function handleVideoDragEnd() {
    dragVideoRef.current = null;
    if (!activeModuleId) return;
    startTransition(async () => {
      await reorderVideos(activeModuleId, videos.map((v) => v.id));
    });
  }

  // ============================================================
  // Modules List View
  // ============================================================
  if (!activeModuleId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink-900">Cursos</h1>
            <p className="text-sm text-ink-500 mt-0.5">{modules.length} modulo{modules.length !== 1 ? "s" : ""}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setModuleSheet({ open: true })}
              className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
            >
              <Plus size={16} />
              Novo modulo
            </button>
          )}
        </div>

        {modules.length === 0 ? (
          <div className="rounded-xl border border-ink-100 bg-white px-6 py-16 text-center">
            <Film size={40} className="mx-auto text-ink-200 mb-3" />
            <p className="text-sm text-ink-500">Nenhum modulo criado ainda</p>
            {canEdit && (
              <button
                onClick={() => setModuleSheet({ open: true })}
                className="mt-3 text-sm font-medium text-brand-olive hover:underline"
              >
                Criar primeiro modulo
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {modules.map((mod, i) => (
              <div
                key={mod.id}
                draggable={canEdit}
                onDragStart={() => handleModuleDragStart(i)}
                onDragOver={(e) => handleModuleDragOver(e, i)}
                onDragEnd={handleModuleDragEnd}
                className="group flex items-center gap-4 rounded-xl border border-ink-100 bg-white p-4 hover:border-ink-200 transition-colors cursor-pointer"
                onClick={() => canEdit ? openModule(mod.id) : router.push(`/cursos/${mod.slug}`)}
              >
                {canEdit && (
                  <div
                    className="cursor-grab text-ink-300 hover:text-ink-500 shrink-0 touch-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical size={18} />
                  </div>
                )}

                {/* Cover */}
                <div className="h-16 w-28 rounded-lg bg-ink-50 overflow-hidden shrink-0 flex items-center justify-center">
                  {mod.cover_url ? (
                    <img src={mod.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Film size={24} className="text-ink-200" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-900 truncate">{mod.title}</h3>
                    {mod.status === "draft" && (
                      <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">Rascunho</span>
                    )}
                  </div>
                  {mod.description && (
                    <p className="text-xs text-ink-500 mt-0.5 truncate">{mod.description}</p>
                  )}
                  <p className="text-xs text-ink-400 mt-1">
                    {mod.video_count || 0} video{(mod.video_count || 0) !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {canEdit && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setModuleSheet({ open: true, module: mod }); }}
                        className="rounded-lg p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
                        title="Editar modulo"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirm({
                            open: true,
                            title: "Remover modulo",
                            message: `Tem certeza que deseja remover "${mod.title}"? Todos os videos serao removidos.`,
                            onConfirm: () => {
                              startTransition(async () => {
                                const res = await deleteModule(mod.id);
                                if (res.error) { toast.error(res.error); return; }
                                setModules((prev) => prev.filter((m) => m.id !== mod.id));
                                toast.success("Modulo removido");
                              });
                              setConfirm((c) => ({ ...c, open: false }));
                            },
                          });
                        }}
                        className="rounded-lg p-2 text-ink-400 hover:text-danger hover:bg-danger/5 transition-colors"
                        title="Remover modulo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                  <ChevronRight size={16} className="text-ink-300" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Module Sheet */}
        <ModuleSheet
          open={moduleSheet.open}
          module={moduleSheet.module}
          onClose={() => setModuleSheet({ open: false })}
          onSaved={(mod) => {
            if (moduleSheet.module) {
              setModules((prev) => prev.map((m) => (m.id === mod.id ? { ...m, ...mod } : m)));
            } else {
              setModules((prev) => [...prev, mod]);
            }
            setModuleSheet({ open: false });
          }}
        />

        <ConfirmDialog
          open={confirm.open}
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Remover"
          destructive
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
        />
      </div>
    );
  }

  // ============================================================
  // Videos List View (inside a module)
  // ============================================================
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveModuleId(null)}
            className="rounded-lg p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-ink-900">{activeModule?.title}</h1>
            <p className="text-sm text-ink-500 mt-0.5">{videos.length} video{videos.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setVideoSheet({ open: true })}
            className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
          >
            <Plus size={16} />
            Novo video
          </button>
        )}
      </div>

      {loadingVideos ? (
        <div className="rounded-xl border border-ink-100 bg-white px-6 py-16 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-olive mx-auto" />
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-ink-100 bg-white px-6 py-16 text-center">
          <Play size={40} className="mx-auto text-ink-200 mb-3" />
          <p className="text-sm text-ink-500">Nenhum video neste modulo</p>
          {canEdit && (
            <button
              onClick={() => setVideoSheet({ open: true })}
              className="mt-3 text-sm font-medium text-brand-olive hover:underline"
            >
              Adicionar primeiro video
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {videos.map((vid, i) => (
            <div
              key={vid.id}
              draggable={canEdit}
              onDragStart={() => handleVideoDragStart(i)}
              onDragOver={(e) => handleVideoDragOver(e, i)}
              onDragEnd={handleVideoDragEnd}
              className="group flex items-center gap-4 rounded-xl border border-ink-100 bg-white p-3.5 hover:border-ink-200 transition-colors"
            >
              {canEdit && (
                <div className="cursor-grab text-ink-300 hover:text-ink-500 shrink-0 touch-none">
                  <GripVertical size={16} />
                </div>
              )}

              {/* Thumbnail / index */}
              <div className="h-12 w-20 rounded-lg bg-ink-50 overflow-hidden shrink-0 flex items-center justify-center relative">
                {vid.thumbnail_url ? (
                  <img src={vid.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-ink-300">{i + 1}</span>
                )}
                {/* Source type badge */}
                <div className="absolute bottom-0.5 right-0.5">
                  {vid.source_type === "youtube" && <Video size={12} className="text-red-500" />}
                  {vid.source_type === "upload" && <Upload size={12} className="text-brand-olive" />}
                  {vid.source_type === "external" && <Link2 size={12} className="text-blue-500" />}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-900 truncate">{vid.title}</span>
                  {vid.status === "draft" && (
                    <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">Rascunho</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {vid.duration_seconds != null && vid.duration_seconds > 0 && (
                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <Clock size={11} />
                      {formatDuration(vid.duration_seconds)}
                    </span>
                  )}
                  {vid.size_bytes != null && vid.size_bytes > 0 && (
                    <span className="text-xs text-ink-400">{formatBytes(vid.size_bytes)}</span>
                  )}
                  <span className="text-xs text-ink-400 capitalize">{vid.source_type}</span>
                </div>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setVideoSheet({ open: true, video: vid })}
                    className="rounded-lg p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors"
                    title="Editar video"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setConfirm({
                        open: true,
                        title: "Remover video",
                        message: `Tem certeza que deseja remover "${vid.title}"?`,
                        onConfirm: () => {
                          startTransition(async () => {
                            const res = await deleteVideo(vid.id);
                            if (res.error) { toast.error(res.error); return; }
                            setVideos((prev) => prev.filter((v) => v.id !== vid.id));
                            toast.success("Video removido");
                          });
                          setConfirm((c) => ({ ...c, open: false }));
                        },
                      });
                    }}
                    className="rounded-lg p-2 text-ink-400 hover:text-danger hover:bg-danger/5 transition-colors"
                    title="Remover video"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video Sheet */}
      <VideoSheet
        open={videoSheet.open}
        video={videoSheet.video}
        moduleId={activeModuleId}
        onClose={() => setVideoSheet({ open: false })}
        onSaved={(vid) => {
          if (videoSheet.video) {
            setVideos((prev) => prev.map((v) => (v.id === vid.id ? { ...v, ...vid } : v)));
          } else {
            setVideos((prev) => [...prev, vid]);
          }
          setVideoSheet({ open: false });
        }}
      />

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel="Remover"
        destructive
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />
    </div>
  );
}

// ============================================================
// Module Sheet
// ============================================================

function ModuleSheet({
  open,
  module,
  onClose,
  onSaved,
}: {
  open: boolean;
  module?: CourseModule;
  onClose: () => void;
  onSaved: (mod: CourseModule) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [coverUrl, setCoverUrl] = useState(module?.cover_url || "");
  const [status, setStatus] = useState(module?.status || "draft");
  const formRef = useRef<HTMLFormElement>(null);

  // Reset state when module changes
  const prevId = useRef(module?.id);
  if (prevId.current !== module?.id) {
    prevId.current = module?.id;
    setCoverUrl(module?.cover_url || "");
    setStatus(module?.status || "draft");
  }

  function handleSubmit() {
    if (!formRef.current || isPending) return;
    const formData = new FormData(formRef.current);
    formData.set("cover_url", coverUrl);
    formData.set("status", status);

    startTransition(async () => {
      if (module) {
        const res = await updateModule(module.id, formData);
        if (res.error) { toast.error(res.error); return; }
        onSaved({ ...module, title: formData.get("title") as string, description: formData.get("description") as string, cover_url: coverUrl || null, status: status as "draft" | "published" });
        toast.success("Modulo atualizado");
      } else {
        const res = await createModule(formData);
        if (res.error) { toast.error(res.error); return; }
        onSaved({
          id: res.id!,
          title: formData.get("title") as string,
          description: (formData.get("description") as string) || null,
          cover_url: coverUrl || null,
          slug: "",
          sort_order: 999,
          status: status as "draft" | "published",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          video_count: 0,
        });
        toast.success("Modulo criado");
      }
    });
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadToStorage(file, { bucket: "assets", folder: "course-covers" });
    if ("url" in res) setCoverUrl(res.url);
    else toast.error(res.error);
  }

  return (
    <Sheet open={open} onClose={onClose} onSubmit={handleSubmit} title={module ? "Editar modulo" : "Novo modulo"}>
      <form ref={formRef} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Titulo <span className="text-danger">*</span></label>
          <input name="title" defaultValue={module?.title || ""} className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-olive focus:ring-1 focus:ring-brand-olive outline-none" autoFocus />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Descricao</label>
          <textarea name="description" rows={3} defaultValue={module?.description || ""} className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-olive focus:ring-1 focus:ring-brand-olive outline-none resize-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Capa</label>
          <div className="flex items-center gap-3">
            <div className="h-20 w-36 rounded-lg border border-ink-200 bg-ink-50 overflow-hidden flex items-center justify-center">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-ink-200" />
              )}
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors cursor-pointer">
              <Upload size={14} />
              Enviar imagem
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Status</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatus("draft")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", status === "draft" ? "border-ink-300 bg-ink-50 text-ink-700" : "border-ink-100 text-ink-400 hover:bg-ink-50")}
            >
              <EyeOff size={13} /> Rascunho
            </button>
            <button
              type="button"
              onClick={() => setStatus("published")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", status === "published" ? "border-brand-olive bg-brand-olive/5 text-brand-olive" : "border-ink-100 text-ink-400 hover:bg-ink-50")}
            >
              <Eye size={13} /> Publicado
            </button>
          </div>
        </div>

        <div className="pt-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors disabled:opacity-50"
          >
            {isPending ? "Salvando..." : module ? "Salvar" : "Criar modulo"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// ============================================================
// Video Sheet
// ============================================================

function VideoSheet({
  open,
  video,
  moduleId,
  onClose,
  onSaved,
}: {
  open: boolean;
  video?: CourseVideo;
  moduleId: string;
  onClose: () => void;
  onSaved: (vid: CourseVideo) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [sourceType, setSourceType] = useState<"youtube" | "upload" | "external">(video?.source_type || "youtube");
  const [storagePath, setStoragePath] = useState(video?.storage_path || "");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [status, setStatus] = useState(video?.status || "draft");
  const [thumbnailUrl, setThumbnailUrl] = useState(video?.thumbnail_url || "");
  const formRef = useRef<HTMLFormElement>(null);

  const prevId = useRef(video?.id);
  if (prevId.current !== video?.id) {
    prevId.current = video?.id;
    setSourceType(video?.source_type || "youtube");
    setStoragePath(video?.storage_path || "");
    setStatus(video?.status || "draft");
    setThumbnailUrl(video?.thumbnail_url || "");
    setUploadProgress(null);
  }

  function handleSubmit() {
    if (!formRef.current || isPending) return;
    const formData = new FormData(formRef.current);
    formData.set("source_type", sourceType);
    formData.set("storage_path", storagePath);
    formData.set("status", status);
    formData.set("thumbnail_url", thumbnailUrl);

    startTransition(async () => {
      if (video) {
        const res = await updateVideo(video.id, formData);
        if (res.error) { toast.error(res.error); return; }
        onSaved({
          ...video,
          title: formData.get("title") as string,
          description: (formData.get("description") as string) || null,
          source_type: sourceType,
          video_url: (formData.get("video_url") as string) || null,
          storage_path: storagePath || null,
          thumbnail_url: thumbnailUrl || null,
          duration_seconds: formData.get("duration_seconds") ? parseInt(formData.get("duration_seconds") as string) : null,
          size_bytes: formData.get("size_bytes") ? parseInt(formData.get("size_bytes") as string) : null,
          status: status as "draft" | "published",
        });
        toast.success("Video atualizado");
      } else {
        const res = await createVideo(moduleId, formData);
        if (res.error) { toast.error(res.error); return; }
        onSaved({
          id: res.id!,
          module_id: moduleId,
          title: formData.get("title") as string,
          description: (formData.get("description") as string) || null,
          source_type: sourceType,
          video_url: (formData.get("video_url") as string) || null,
          storage_path: storagePath || null,
          thumbnail_url: thumbnailUrl || null,
          duration_seconds: formData.get("duration_seconds") ? parseInt(formData.get("duration_seconds") as string) : null,
          size_bytes: formData.get("size_bytes") ? parseInt(formData.get("size_bytes") as string) : null,
          sort_order: 999,
          status: status as "draft" | "published",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        toast.success("Video adicionado");
      }
    });
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    const res = await uploadVideoWithProgress(file, (pct) => setUploadProgress(pct));

    if ("path" in res) {
      setStoragePath(res.path);
      setUploadProgress(null);
      toast.success("Video enviado");

      // Auto-fill size
      if (formRef.current) {
        const sizeInput = formRef.current.querySelector<HTMLInputElement>('[name="size_bytes"]');
        if (sizeInput) sizeInput.value = String(file.size);
      }
    } else {
      setUploadProgress(null);
      toast.error(res.error);
    }
  }

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadToStorage(file, { bucket: "assets", folder: "course-thumbnails" });
    if ("url" in res) setThumbnailUrl(res.url);
    else toast.error(res.error);
  }

  return (
    <Sheet open={open} onClose={onClose} onSubmit={handleSubmit} title={video ? "Editar video" : "Novo video"} wide>
      <form ref={formRef} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Titulo <span className="text-danger">*</span></label>
          <input name="title" defaultValue={video?.title || ""} className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-olive focus:ring-1 focus:ring-brand-olive outline-none" autoFocus />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Descricao</label>
          <textarea name="description" rows={3} defaultValue={video?.description || ""} className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-olive focus:ring-1 focus:ring-brand-olive outline-none resize-none" />
        </div>

        {/* Source Type */}
        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Tipo de video</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSourceType("youtube")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", sourceType === "youtube" ? "border-red-300 bg-red-50 text-red-600" : "border-ink-100 text-ink-400 hover:bg-ink-50")}
            >
              <Video size={14} /> YouTube
            </button>
            <button
              type="button"
              onClick={() => setSourceType("upload")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", sourceType === "upload" ? "border-brand-olive bg-brand-olive/5 text-brand-olive" : "border-ink-100 text-ink-400 hover:bg-ink-50")}
            >
              <Upload size={14} /> Upload
            </button>
            <button
              type="button"
              onClick={() => setSourceType("external")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", sourceType === "external" ? "border-blue-300 bg-blue-50 text-blue-600" : "border-ink-100 text-ink-400 hover:bg-ink-50")}
            >
              <Link2 size={14} /> URL externa
            </button>
          </div>
        </div>

        {/* Video URL (YouTube / External) */}
        {(sourceType === "youtube" || sourceType === "external") && (
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              {sourceType === "youtube" ? "URL do YouTube" : "URL do video"} <span className="text-danger">*</span>
            </label>
            <input
              name="video_url"
              defaultValue={video?.video_url || ""}
              placeholder={sourceType === "youtube" ? "https://youtube.com/watch?v=..." : "https://..."}
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-olive focus:ring-1 focus:ring-brand-olive outline-none"
            />
          </div>
        )}

        {/* Video Upload */}
        {sourceType === "upload" && (
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Arquivo de video <span className="text-danger">*</span></label>
            {storagePath ? (
              <div className="flex items-center gap-3 rounded-lg border border-brand-olive/30 bg-brand-olive/5 p-3">
                <Film size={18} className="text-brand-olive shrink-0" />
                <span className="text-sm text-ink-700 truncate flex-1">{storagePath}</span>
                <label className="text-xs font-medium text-brand-olive hover:underline cursor-pointer">
                  Trocar
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                </label>
              </div>
            ) : uploadProgress !== null ? (
              <div className="rounded-lg border border-ink-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ink-500">Enviando video...</span>
                  <span className="text-xs font-medium text-ink-700">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-olive transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ink-200 p-6 cursor-pointer hover:border-brand-olive/50 hover:bg-ink-50/50 transition-colors">
                <Upload size={24} className="text-ink-300" />
                <span className="text-sm text-ink-500">Clique para enviar um video</span>
                <span className="text-xs text-ink-400">MP4, WebM, MOV (max 500MB)</span>
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
            )}
          </div>
        )}

        {/* Thumbnail */}
        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Thumbnail</label>
          <div className="flex items-center gap-3">
            <div className="h-14 w-24 rounded-lg border border-ink-200 bg-ink-50 overflow-hidden flex items-center justify-center">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={18} className="text-ink-200" />
              )}
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors cursor-pointer">
              <Upload size={13} />
              {thumbnailUrl ? "Trocar" : "Enviar"}
              <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
            </label>
          </div>
        </div>

        {/* Duration & Size */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Duracao (segundos)</label>
            <input name="duration_seconds" type="number" min="0" defaultValue={video?.duration_seconds || ""} placeholder="120" className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-olive focus:ring-1 focus:ring-brand-olive outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Tamanho (bytes)</label>
            <input name="size_bytes" type="number" min="0" defaultValue={video?.size_bytes || ""} className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-olive focus:ring-1 focus:ring-brand-olive outline-none" />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Status</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatus("draft")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", status === "draft" ? "border-ink-300 bg-ink-50 text-ink-700" : "border-ink-100 text-ink-400 hover:bg-ink-50")}
            >
              <EyeOff size={13} /> Rascunho
            </button>
            <button
              type="button"
              onClick={() => setStatus("published")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors", status === "published" ? "border-brand-olive bg-brand-olive/5 text-brand-olive" : "border-ink-100 text-ink-400 hover:bg-ink-50")}
            >
              <Eye size={13} /> Publicado
            </button>
          </div>
        </div>

        <div className="pt-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || uploadProgress !== null}
            className="w-full rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors disabled:opacity-50"
          >
            {isPending ? "Salvando..." : video ? "Salvar" : "Adicionar video"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// ============================================================
// Helpers
// ============================================================

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
