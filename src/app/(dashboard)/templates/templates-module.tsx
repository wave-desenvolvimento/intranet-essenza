"use client";

import { useState, useTransition, useRef } from "react";
import {
  Plus, Pencil, Trash2, X, Upload, Download, Image as ImageIcon, Eye, Share2, Copy, Check,
} from "lucide-react";
import { createTemplate, updateTemplate, deleteTemplate } from "./actions";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { uploadToStorage } from "@/lib/upload";
import { BannerTemplateEditor, type BannerOverlay } from "@/components/ui/banner-template-editor";
import { BannerRenderer } from "@/components/ui/banner-renderer";
import { toast } from "sonner";

interface Template {
  id: string;
  title: string;
  description: string | null;
  background_image: string | null;
  background_color_start: string | null;
  background_color_end: string | null;
  aspect_ratio: string;
  overlays: BannerOverlay[];
  status: string;
  sort_order: number;
}

interface Props {
  templates: Template[];
  isAdmin: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  franchiseData: any;
}

// Sample data for admin preview when no franchise is assigned
const SAMPLE_FRANCHISE = {
  name: "Essenza Gramado",
  city: "Gramado",
  state: "RS",
  address: "Av. das Hortênsias, 1234",
  neighborhood: "Centro",
  cep: "95670-000",
  phone: "(54) 3286-1234",
  whatsapp: "5554999881234",
  email: "contato@essenzagramado.com",
  instagram: "@essenza.gramado",
  facebook: "/essenzagramado",
  tiktok: "@essenza.gramado",
  website: "essenzagramado.com.br",
  cnpj: "12.345.678/0001-90",
  opening_hours: "Seg-Sáb 9h-19h",
  manager_name: "Maria Silva",
  logo_url: null,
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

const ASPECT_OPTIONS = [
  { value: "16/6", label: "Banner largo (16:6)" },
  { value: "16/9", label: "Widescreen (16:9)" },
  { value: "4/3", label: "Padrão (4:3)" },
  { value: "1/1", label: "Quadrado (1:1)" },
  { value: "9/16", label: "Stories (9:16)" },
];

const inputCls = "h-9 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-olive focus:outline-none focus:ring-2 focus:ring-brand-olive/10";

export function TemplatesModule({ templates, isAdmin, franchiseData }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const { confirm, dialogProps } = useConfirm();

  // Sheet
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bgImage, setBgImage] = useState("");
  const [bgStart, setBgStart] = useState("");
  const [bgEnd, setBgEnd] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16/6");
  const [overlays, setOverlays] = useState<BannerOverlay[]>([]);
  const [status, setStatus] = useState("draft");
  const [uploadingBg, setUploadingBg] = useState(false);

  // Preview
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const published = templates.filter((t) => t.status === "published");
  const visibleTemplates = isAdmin ? templates : published;

  // Use real franchise or sample for admin preview
  const renderData = franchiseData || SAMPLE_FRANCHISE;

  function openCreate() {
    setEditing(null);
    setTitle(""); setDescription(""); setBgImage(""); setBgStart(""); setBgEnd("");
    setAspectRatio("16/6"); setOverlays([]); setStatus("draft");
    setError(""); setShowSheet(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setTitle(t.title); setDescription(t.description || "");
    setBgImage(t.background_image || ""); setBgStart(t.background_color_start || "");
    setBgEnd(t.background_color_end || ""); setAspectRatio(t.aspect_ratio);
    setOverlays(t.overlays || []); setStatus(t.status);
    setError(""); setShowSheet(true);
  }

  function closeSheet() { setShowSheet(false); setEditing(null); }

  function handleSave() {
    const fd = new FormData();
    fd.set("title", title); fd.set("description", description);
    fd.set("backgroundImage", bgImage); fd.set("backgroundColorStart", bgStart);
    fd.set("backgroundColorEnd", bgEnd); fd.set("aspectRatio", aspectRatio);
    fd.set("overlays", JSON.stringify(overlays)); fd.set("status", status);
    if (editing) {
      fd.set("id", editing.id);
      startTransition(async () => { const r = await updateTemplate(fd); r?.error ? setError(r.error) : closeSheet(); });
    } else {
      startTransition(async () => { const r = await createTemplate(fd); r?.error ? setError(r.error) : closeSheet(); });
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: "Remover template", message: "Tem certeza? Essa ação não pode ser desfeita.", confirmLabel: "Remover", destructive: true });
    if (!ok) return;
    startTransition(async () => { const r = await deleteTemplate(id); if (r?.error) setError(r.error); });
  }

  async function handleBgUpload(file: File) {
    setUploadingBg(true);
    const r = await uploadToStorage(file, { bucket: "assets", folder: "templates" });
    setUploadingBg(false);
    if ("url" in r) setBgImage(r.url);
  }

  async function handleDownload(template: Template) {
    setDownloading(true);
    try {
      const bgUrl = template.background_image;
      if (!bgUrl) { toast.error("Template sem imagem de fundo"); setDownloading(false); return; }

      // Load background image
      const bgImg = new Image();
      bgImg.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { bgImg.onload = () => res(); bgImg.onerror = () => rej(); bgImg.src = bgUrl; });

      const W = bgImg.naturalWidth;
      const H = bgImg.naturalHeight;

      // Create canvas at full image resolution
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Draw background
      ctx.drawImage(bgImg, 0, 0, W, H);

      // Resolve franchise variables
      const varMap: Record<string, string> = {
        nome: renderData.name || "",
        cidade: renderData.city || "",
        estado: renderData.state || "",
        endereco: renderData.address || "",
        bairro: renderData.neighborhood || "",
        cep: renderData.cep || "",
        telefone: renderData.phone || "",
        whatsapp: renderData.whatsapp || "",
        email: renderData.email || "",
        instagram: renderData.instagram || "",
        facebook: renderData.facebook || "",
        tiktok: renderData.tiktok || "",
        website: renderData.website || "",
        cnpj: renderData.cnpj || "",
        horario: renderData.opening_hours || "",
        responsavel: renderData.manager_name || "",
      };

      // Draw each overlay
      for (const overlay of template.overlays) {
        const x = (overlay.x / 100) * W;
        const y = (overlay.y / 100) * H;
        const pxFont = (overlay.fontSize / 100) * W;

        if (overlay.type === "qrcode") {
          // Generate QR
          let qrValue = "";
          if (overlay.variable === "qr_whatsapp" && renderData.whatsapp) qrValue = `https://wa.me/${renderData.whatsapp.replace(/\D/g, "")}`;
          else if (overlay.variable === "qr_telefone" && renderData.phone) qrValue = `tel:${renderData.phone.replace(/\D/g, "")}`;
          else if (overlay.variable === "qr_instagram" && renderData.instagram) qrValue = `https://instagram.com/${renderData.instagram.replace("@", "")}`;
          else if (overlay.variable === "qr_website" && renderData.website) { const s = renderData.website; qrValue = s.startsWith("http") ? s : `https://${s}`; }

          if (qrValue) {
            const QRCode = (await import("qrcode")).default;
            const qrDataUrl = await QRCode.toDataURL(qrValue, { width: pxFont * 2, margin: 1 });
            const qrImg = new Image();
            await new Promise<void>((res) => { qrImg.onload = () => res(); qrImg.src = qrDataUrl; });
            ctx.drawImage(qrImg, x - pxFont / 2, y - pxFont / 2, pxFont, pxFont);
          }
          continue;
        }

        // Text overlay
        const text = varMap[overlay.variable] || "";
        if (!text) continue;

        const hasBox = overlay.width > 0 && overlay.height > 0;
        const boxW = hasBox ? (overlay.width / 100) * W : 0;
        const boxH = hasBox ? (overlay.height / 100) * W : 0; // width-based like CSS

        const fontStyle = overlay.fontStyle === "italic" ? "italic " : "";
        const fontWeight = overlay.fontWeight === "bold" ? "bold " : "";
        const fontFamily = overlay.fontFamily || "Comfortaa, sans-serif";
        ctx.font = `${fontStyle}${fontWeight}${pxFont}px ${fontFamily}`;

        // Compute text position and box
        const padX = overlay.backgroundColor ? pxFont * 0.4 : 0;
        const padY = overlay.backgroundColor ? pxFont * 0.15 : 0;

        let textX = x;
        let textY = y;
        let bgX: number, bgY: number, bgW: number, bgH: number;

        if (hasBox) {
          // Box mode: use defined width/height, centered on x,y
          bgW = boxW;
          bgH = boxH;
          bgX = x - bgW / 2;
          bgY = y - bgH / 2;
          // Text inside the box
          if (overlay.textAlign === "left") textX = bgX + padX;
          else if (overlay.textAlign === "right") textX = bgX + bgW - padX;
          else textX = bgX + bgW / 2;
          textY = bgY + bgH / 2;
        } else {
          // Auto mode: size from text measurement
          const metrics = ctx.measureText(text);
          const tw = metrics.width;
          bgW = tw + padX * 2;
          bgH = pxFont * 1.2 + padY * 2;
          if (overlay.textAlign === "center") bgX = x - bgW / 2;
          else if (overlay.textAlign === "right") bgX = x - bgW;
          else bgX = x;
          bgY = y - bgH / 2;
        }

        // Draw background box
        if (overlay.backgroundColor) {
          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.fillStyle = overlay.backgroundColor;
          ctx.beginPath();
          ctx.roundRect(bgX, bgY, bgW, bgH, pxFont * 0.15);
          ctx.fill();
          ctx.restore();
        }

        // Draw text
        ctx.save();
        ctx.fillStyle = overlay.color;
        ctx.textAlign = (hasBox ? overlay.textAlign : overlay.textAlign) as CanvasTextAlign;
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;

        if (hasBox) {
          // Clip to box bounds
          ctx.rect(bgX, bgY, bgW, bgH);
          ctx.clip();
        }

        ctx.fillText(text, textX, textY);
        ctx.restore();
      }

      // Download
      const link = document.createElement("a");
      link.download = `${template.title.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagem baixada");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar imagem");
    }
    setDownloading(false);
  }

  function handleCopyLink(template: Template) {
    const url = `${window.location.origin}/templates?preview=${template.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareImage(template: Template) {
    try {
      // Generate PNG (same logic as download)
      const bgUrl = template.background_image;
      if (!bgUrl) { toast.error("Template sem imagem"); return; }

      toast.loading("Gerando imagem...", { id: "share" });

      const bgImg = new Image();
      bgImg.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { bgImg.onload = () => res(); bgImg.onerror = () => rej(); bgImg.src = bgUrl; });

      const W = bgImg.naturalWidth;
      const H = bgImg.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bgImg, 0, 0, W, H);

      // Draw overlays (simplified — text only, same as download)
      const varMap: Record<string, string> = {
        nome: renderData.name || "", cidade: renderData.city || "", estado: renderData.state || "",
        endereco: renderData.address || "", bairro: renderData.neighborhood || "", cep: renderData.cep || "",
        telefone: renderData.phone || "", whatsapp: renderData.whatsapp || "", email: renderData.email || "",
        instagram: renderData.instagram || "", facebook: renderData.facebook || "", tiktok: renderData.tiktok || "",
        website: renderData.website || "", cnpj: renderData.cnpj || "", horario: renderData.opening_hours || "",
        responsavel: renderData.manager_name || "",
      };

      for (const overlay of template.overlays) {
        if (overlay.type === "qrcode") continue; // skip QR for share speed
        const text = varMap[overlay.variable] || "";
        if (!text) continue;
        const pxFont = (overlay.fontSize / 100) * W;
        const x = (overlay.x / 100) * W;
        const y = (overlay.y / 100) * H;
        const fontStyle = overlay.fontStyle === "italic" ? "italic " : "";
        const fontWeight = overlay.fontWeight === "bold" ? "bold " : "";
        ctx.font = `${fontStyle}${fontWeight}${pxFont}px ${overlay.fontFamily || "sans-serif"}`;
        ctx.fillStyle = overlay.color;
        ctx.textAlign = overlay.textAlign as CanvasTextAlign;
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
        if (overlay.backgroundColor) {
          const hasBox = overlay.width > 0 && overlay.height > 0;
          const metrics = ctx.measureText(text);
          const padX = pxFont * 0.4; const padY = pxFont * 0.15;
          const boxW = hasBox ? (overlay.width / 100) * W : metrics.width + padX * 2;
          const boxH = hasBox ? (overlay.height / 100) * W : pxFont * 1.2 + padY * 2;
          const bgX = overlay.textAlign === "center" ? x - boxW / 2 : overlay.textAlign === "right" ? x - boxW : x;
          ctx.save(); ctx.shadowColor = "transparent"; ctx.fillStyle = overlay.backgroundColor;
          ctx.beginPath(); ctx.roundRect(bgX, y - boxH / 2, boxW, boxH, pxFont * 0.15); ctx.fill(); ctx.restore();
          ctx.fillStyle = overlay.color; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4;
        }
        ctx.fillText(text, x, y);
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
      }

      // Convert to blob
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const file = new File([blob], `${template.title.replace(/\s+/g, "-").toLowerCase()}.png`, { type: "image/png" });

      toast.dismiss("share");

      // Try native share (works on mobile + desktop with WhatsApp)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: template.title });
      } else {
        // Fallback: download + open whatsapp with text
        const link = document.createElement("a");
        link.download = file.name;
        link.href = URL.createObjectURL(blob);
        link.click();
        toast.success("Imagem salva — envie manualmente pelo WhatsApp");
      }
    } catch (err) {
      toast.dismiss("share");
      if ((err as Error).name !== "AbortError") {
        toast.error("Erro ao compartilhar");
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Templates</h1>
          <p className="text-sm text-ink-500">
            {isAdmin
              ? `${templates.length} templates · ${published.length} publicados`
              : `${published.length} templates disponíveis`
            }
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-olive px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors">
            <Plus size={16} /> Novo Template
          </button>
        )}
      </div>

      {error && !showSheet && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Templates grid */}
      {visibleTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
          <ImageIcon size={32} className="text-ink-300 mb-3" />
          <p className="text-sm text-ink-400">{isAdmin ? "Nenhum template criado" : "Nenhum template disponível"}</p>
          {isAdmin && <button onClick={openCreate} className="mt-2 text-sm font-medium text-brand-olive">Criar primeiro</button>}
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleTemplates.map((t) => {
            const gradient = t.background_color_start && t.background_color_end
              ? `linear-gradient(135deg, ${t.background_color_start}, ${t.background_color_end})`
              : undefined;

            return (
              <div key={t.id} className="rounded-xl border border-ink-100 bg-white overflow-hidden group">
                {/* Thumbnail — clipped to max height */}
                <div
                  id={`template-render-${t.id}`}
                  className="cursor-pointer max-h-64 overflow-hidden"
                  onClick={() => setPreviewTemplate(t)}
                >
                  <BannerRenderer
                    overlays={t.overlays}
                    franchise={renderData}
                    backgroundImage={t.background_image || undefined}
                    backgroundGradient={gradient}
                    aspectRatio={t.aspect_ratio}
                  />
                </div>

                {/* Info */}
                <div className="px-3 pt-2.5 pb-2">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-medium text-ink-900 truncate">{t.title}</p>
                    {isAdmin && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[8px] font-medium shrink-0",
                        t.status === "published" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                      )}>
                        {t.status === "published" ? "Pub" : "Rasc"}
                      </span>
                    )}
                  </div>
                  {t.description && <p className="text-[10px] text-ink-400 truncate mt-0.5">{t.description}</p>}
                </div>

                {/* Actions */}
                <div className="px-3 pb-2.5 flex items-center gap-1">
                  <button onClick={() => setPreviewTemplate(t)} className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-600 hover:bg-ink-100 transition-colors">
                    <Eye size={10} /> Ver
                  </button>
                  <button onClick={() => handleDownload(t)} className="flex items-center gap-1 rounded-lg bg-brand-olive px-2 py-1 text-[10px] font-medium text-white hover:bg-brand-olive-dark transition-colors">
                    <Download size={10} /> Baixar
                  </button>
                  <div className="flex-1" />
                  {isAdmin && (
                    <>
                      <button onClick={() => openEdit(t)} className="rounded-md p-1 text-ink-300 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => handleDelete(t.id)} disabled={isPending} className="rounded-md p-1 text-ink-300 hover:text-danger hover:bg-danger-soft transition-colors" title="Remover"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (() => {
        const t = previewTemplate;
        const gradient = t.background_color_start && t.background_color_end
          ? `linear-gradient(135deg, ${t.background_color_start}, ${t.background_color_end})`
          : undefined;
        return (
          <div className="fixed inset-0 z-[100]">
            {/* Backdrop — full coverage */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewTemplate(null)} />

            {/* Close button — top right */}
            <button
              onClick={() => setPreviewTemplate(null)}
              className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Content — centered */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 pointer-events-none">
              {/* Image */}
              <div id="template-preview-render" className="pointer-events-auto rounded-xl overflow-hidden shadow-2xl" style={{ maxHeight: "calc(100vh - 140px)", maxWidth: "min(90vw, 800px)" }}>
                <BannerRenderer
                  overlays={t.overlays}
                  franchise={renderData}
                  backgroundImage={t.background_image || undefined}
                  backgroundGradient={gradient}
                  aspectRatio={t.aspect_ratio}
                  maxHeight="calc(100vh - 140px)"
                />
              </div>

              {/* Actions — fixed bottom bar */}
              <div className="pointer-events-auto mt-5 flex items-center gap-2 rounded-2xl bg-white/95 backdrop-blur px-3 py-2.5 shadow-xl">
                <button onClick={() => handleDownload(t)} disabled={downloading} className="flex items-center gap-1.5 rounded-xl bg-brand-olive px-4 py-2 text-xs font-medium text-white hover:bg-brand-olive-dark transition-colors">
                  <Download size={13} /> {downloading ? "Gerando..." : "Baixar PNG"}
                </button>
                <button onClick={() => handleCopyLink(t)} className="flex items-center gap-1.5 rounded-xl bg-ink-50 px-4 py-2 text-xs font-medium text-ink-700 hover:bg-ink-100 transition-colors">
                  {copied ? <Check size={13} className="text-success" /> : <Share2 size={13} />}
                  {copied ? "Copiado!" : "Link"}
                </button>
                <button onClick={() => handleShareImage(t)} className="flex items-center gap-1.5 rounded-xl bg-ink-50 px-4 py-2 text-xs font-medium text-ink-700 hover:bg-ink-100 transition-colors">
                  <Share2 size={13} /> Compartilhar
                </button>
              </div>

              {!franchiseData && isAdmin && (
                <p className="text-[10px] text-white/30 mt-2">Dados de exemplo (Essenza Gramado)</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Admin editor sheet */}
      <Sheet open={showSheet} onClose={closeSheet} onSubmit={handleSave} title={editing ? "Editar Template" : "Novo Template"} wide>
        <div className="flex flex-col gap-5">
          {/* Basic info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">Título *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className={inputCls} placeholder="Banner Campanha Verão" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-700 mb-1 block">Status</label>
              <CustomSelect options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-700 mb-1 block">Descrição</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="Breve descrição do template..." />
          </div>

          {/* Background */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Fundo</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-ink-700 mb-1 block">Imagem de fundo</label>
                {bgImage ? (
                  <div className="relative rounded-lg overflow-hidden h-24">
                    <img src={bgImage} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setBgImage("")} className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"><X size={10} /></button>
                  </div>
                ) : (
                  <label className={cn("flex items-center justify-center gap-2 rounded-lg border-2 border-dashed h-20 cursor-pointer transition-colors", uploadingBg ? "border-brand-olive bg-brand-olive-soft/30" : "border-ink-200 hover:border-brand-olive")}>
                    <input type="file" accept="image/*" className="sr-only" disabled={uploadingBg} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgUpload(f); }} />
                    {uploadingBg ? <span className="text-xs text-brand-olive">Enviando...</span> : <><Upload size={14} className="text-ink-400" /><span className="text-xs text-ink-500">Enviar imagem</span></>}
                  </label>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Cor início (gradiente)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={bgStart || "#878a62"} onChange={(e) => setBgStart(e.target.value)} className="h-9 w-9 rounded border border-ink-100 cursor-pointer p-0.5" />
                  <input type="text" value={bgStart} onChange={(e) => setBgStart(e.target.value)} className={cn(inputCls, "flex-1")} placeholder="#878a62" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Cor fim (gradiente)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={bgEnd || "#5a5735"} onChange={(e) => setBgEnd(e.target.value)} className="h-9 w-9 rounded border border-ink-100 cursor-pointer p-0.5" />
                  <input type="text" value={bgEnd} onChange={(e) => setBgEnd(e.target.value)} className={cn(inputCls, "flex-1")} placeholder="#5a5735" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-700 mb-1 block">Proporção</label>
                <CustomSelect options={ASPECT_OPTIONS} value={aspectRatio} onChange={setAspectRatio} />
              </div>
            </div>
          </fieldset>

          {/* Overlays editor */}
          <fieldset>
            <legend className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3">Variáveis e QR Codes</legend>
            <BannerTemplateEditor
              overlays={overlays}
              onChange={setOverlays}
              backgroundImage={bgImage || undefined}
              backgroundGradient={bgStart && bgEnd ? `linear-gradient(135deg, ${bgStart}, ${bgEnd})` : undefined}
            />
          </fieldset>

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
