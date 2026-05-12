"use client";

import { useState, useTransition } from "react";
import {
  Plus, Pencil, Trash2, Megaphone, Pin, AlertTriangle, Clock,
  Users, Building2, CheckCheck, Eye, Upload, X, ImageIcon,
} from "lucide-react";
import { createAnnouncement, updateAnnouncement, deleteAnnouncement, markAsRead } from "./actions";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { uploadToStorage } from "@/lib/upload";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Announcement { [key: string]: any; }
interface Franchise { id: string; name: string; segment: string; }

interface Props {
  announcements: Announcement[];
  franchises: Franchise[];
  canManage: boolean;
  currentUserId: string;
}

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgente" },
  { value: "pinned", label: "Fixado" },
];

const TARGET_OPTIONS = [
  { value: "all", label: "Toda a rede" },
  { value: "segment", label: "Por segmento" },
  { value: "franchise", label: "Franquia específica" },
];

const PRIORITY_CONFIG: Record<string, { icon: typeof Megaphone; color: string; bg: string; label: string }> = {
  pinned: { icon: Pin, color: "text-brand-olive", bg: "bg-brand-olive-soft", label: "Fixado" },
  urgent: { icon: AlertTriangle, color: "text-danger", bg: "bg-danger-soft", label: "Urgente" },
  normal: { icon: Megaphone, color: "text-info", bg: "bg-info-soft", label: "Normal" },
};

export function AnnouncementsManager({ announcements, franchises, canManage, currentUserId }: Props) {
  const { confirm: confirmAction, dialogProps } = useConfirm();
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const franchiseOptions = franchises.map((f) => ({ value: f.id, label: f.name }));
  const segmentOptions = [
    { value: "franquia", label: "Franquias" },
    { value: "multimarca_pdv", label: "Multimarca / PDV" },
  ];

  function openCreate() {
    setEditing(null); setTitle(""); setBody(""); setPriority("normal");
    setTargetType("all"); setTargetValue(""); setExpiresAt(""); setBannerUrl("");
    setError(""); setShowSheet(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a); setTitle(a.title); setBody(a.body); setPriority(a.priority);
    setTargetType(a.target_type); setTargetValue(a.target_value || "");
    setExpiresAt(a.expires_at ? a.expires_at.split("T")[0] : "");
    setBannerUrl(a.banner_url || "");
    setError(""); setShowSheet(true);
  }

  function closeSheet() { setShowSheet(false); setEditing(null); }

  async function handleBannerUpload(file: File) {
    setUploadingBanner(true);
    const r = await uploadToStorage(file, { bucket: "assets", folder: "announcements" });
    setUploadingBanner(false);
    if ("url" in r) setBannerUrl(r.url);
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("title", title); fd.set("body", body); fd.set("priority", priority);
    fd.set("targetType", targetType); fd.set("targetValue", targetValue);
    fd.set("expiresAt", expiresAt ? new Date(expiresAt).toISOString() : "");
    fd.set("bannerUrl", bannerUrl);
    if (editing) {
      fd.set("id", editing.id);
      startTransition(async () => { const r = await updateAnnouncement(fd); r?.error ? setError(r.error) : closeSheet(); });
    } else {
      startTransition(async () => { const r = await createAnnouncement(fd); r?.error ? setError(r.error) : closeSheet(); });
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirmAction({ title: "Remover comunicado", message: "Tem certeza?", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteAnnouncement(id); if (r?.error) setError(r.error); });
  }

  function handleMarkRead(id: string) {
    startTransition(async () => { await markAsRead(id); });
  }

  function isRead(a: Announcement): boolean {
    return (a.reads || []).some((r: { user_id: string }) => r.user_id === currentUserId);
  }

  function isExpired(a: Announcement): boolean {
    return a.expires_at && new Date(a.expires_at) < new Date();
  }

  const active = announcements.filter((a) => !isExpired(a));
  const expired = announcements.filter((a) => isExpired(a));
  const filtered = filter === "unread" ? active.filter((a) => !isRead(a)) : active;
  const unreadCount = active.filter((a) => !isRead(a)).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Comunicados</h1>
          <p className="text-sm text-ink-500">
            {active.length} comunicado{active.length !== 1 ? "s" : ""} ativo{active.length !== 1 ? "s" : ""}
            {unreadCount > 0 && <span className="text-brand-olive font-medium"> · {unreadCount} não lido{unreadCount > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-ink-50 p-1">
            <button onClick={() => setFilter("all")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", filter === "all" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>Todos</button>
            <button onClick={() => setFilter("unread")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", filter === "unread" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
              Não lidos {unreadCount > 0 && <span className="ml-1 rounded-full bg-brand-olive text-white text-[10px] px-1.5">{unreadCount}</span>}
            </button>
          </div>
          {canManage && (
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
              <Plus size={16} /> Novo Comunicado
            </button>
          )}
        </div>
      </div>

      {error && !showSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <Megaphone size={32} className="text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">{filter === "unread" ? "Tudo lido!" : "Nenhum comunicado"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((a) => {
            const cfg = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal;
            const Icon = cfg.icon;
            const read = isRead(a);
            const readCount = (a.reads || []).length;
            const authorName = (a.author as { full_name: string })?.full_name || "—";

            return (
              <div
                key={a.id}
                className={cn(
                  "rounded-xl border bg-white overflow-hidden transition-colors",
                  !read ? "border-l-4 border-l-brand-olive border-ink-100" : "border-ink-100"
                )}
              >
                {/* Banner */}
                {a.banner_url && (
                  <div className="w-full h-40 sm:h-52 overflow-hidden">
                    <img src={a.banner_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5", cfg.bg)}>
                      <Icon size={16} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={cn("text-sm font-semibold", read ? "text-ink-700" : "text-ink-900")}>{a.title}</h3>
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.bg, cfg.color)}>{cfg.label}</span>
                        {a.target_type !== "all" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                            {a.target_type === "segment" ? <Users size={9} /> : <Building2 size={9} />}
                            {a.target_type === "segment" ? (a.target_value === "multimarca_pdv" ? "Multimarca" : "Franquias") : franchises.find((f) => f.id === a.target_value)?.name || "Franquia"}
                          </span>
                        )}
                      </div>
                      <div
                        className={cn("text-sm prose prose-sm max-w-none mb-2", read ? "[&_*]:text-ink-500" : "[&_*]:text-ink-700")}
                        dangerouslySetInnerHTML={{ __html: a.body }}
                      />
                      <div className="flex items-center gap-4 text-[11px] text-ink-400">
                        <span>{authorName}</span>
                        <span>{new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        {a.expires_at && (
                          <span className="flex items-center gap-1"><Clock size={10} /> Expira {new Date(a.expires_at).toLocaleDateString("pt-BR")}</span>
                        )}
                        <span className="flex items-center gap-1"><Eye size={10} /> {readCount} leitura{readCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!read && (
                        <button onClick={() => handleMarkRead(a.id)} className="rounded-md p-1.5 text-ink-400 hover:text-success hover:bg-success-soft transition-colors" title="Marcar como lido">
                          <CheckCheck size={14} />
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(a)} className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(a.id)} disabled={isPending} className="rounded-md p-1.5 text-ink-400 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expired.length > 0 && canManage && (
        <details className="mt-6">
          <summary className="text-xs font-medium text-ink-400 cursor-pointer hover:text-ink-600">{expired.length} comunicado{expired.length > 1 ? "s" : ""} expirado{expired.length > 1 ? "s" : ""}</summary>
          <div className="flex flex-col gap-2 mt-2 opacity-60">
            {expired.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-ink-100 bg-white px-4 py-2.5">
                <p className="text-sm text-ink-500 flex-1">{a.title}</p>
                <span className="text-[10px] text-ink-400">Expirou {new Date(a.expires_at).toLocaleDateString("pt-BR")}</span>
                <button onClick={() => handleDelete(a.id)} disabled={isPending} className="text-ink-400 hover:text-danger"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Sheet */}
      <Sheet open={showSheet} onClose={closeSheet} onSubmit={handleSave} title={editing ? "Editar Comunicado" : "Novo Comunicado"} wide>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" placeholder="Título do comunicado" />
          </div>

          {/* Banner upload */}
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Banner / Imagem (opcional)</label>
            {bannerUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-ink-100">
                <img src={bannerUrl} alt="Banner" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => setBannerUrl("")}
                  className="absolute top-2 right-2 rounded-full bg-ink-900/70 p-1 text-white hover:bg-danger transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className={cn(
                "flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                uploadingBanner ? "border-brand-olive bg-brand-olive-soft/20" : "border-ink-200 hover:border-brand-olive hover:bg-ink-50"
              )}>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingBanner}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); }}
                />
                {uploadingBanner ? (
                  <span className="text-sm text-brand-olive">Enviando...</span>
                ) : (
                  <>
                    <ImageIcon size={24} className="text-ink-300 mb-1.5" />
                    <span className="text-xs text-ink-400">Clique para enviar uma imagem</span>
                    <span className="text-[10px] text-ink-300 mt-0.5">Recomendado: 1200x400px</span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* Rich text body */}
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Conteúdo</label>
            <RichTextEditor value={body} onChange={setBody} placeholder="Escreva o comunicado..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Prioridade</label>
              <CustomSelect options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700 mb-1.5 block">Público-alvo</label>
              <CustomSelect options={TARGET_OPTIONS} value={targetType} onChange={(v) => { setTargetType(v); setTargetValue(""); }} />
            </div>
            {targetType === "segment" && (
              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">Segmento</label>
                <CustomSelect options={segmentOptions} value={targetValue} onChange={setTargetValue} />
              </div>
            )}
            {targetType === "franchise" && (
              <div>
                <label className="text-sm font-medium text-ink-700 mb-1.5 block">Franquia</label>
                <CustomSelect options={[{ value: "", label: "Selecione..." }, ...franchiseOptions]} value={targetValue} onChange={setTargetValue} />
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700 mb-1.5 block">Expira em (opcional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-10 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10" />
          </div>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-2 border-t border-ink-100 mt-2">
            <button onClick={handleSave} disabled={isPending || !title || !body} className="flex-1 rounded-lg bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark disabled:opacity-50">{isPending ? "Salvando..." : editing ? "Salvar" : "Publicar"}</button>
            <button onClick={closeSheet} className="rounded-lg border border-ink-100 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">Cancelar</button>
          </div>
        </div>
      </Sheet>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
