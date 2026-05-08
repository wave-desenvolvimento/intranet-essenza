"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus, Trash2, Bold, Italic, Type, QrCode,
  AlignLeft, AlignCenter, AlignRight, X, Grid3x3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

export interface BannerOverlay {
  id: string;
  type: "variable" | "qrcode";
  variable: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage of container width (0 = auto)
  height: number; // percentage of container height (0 = auto)
  fontSize: number; // percentage of container width (e.g. 3 = 3%)
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  color: string;
  backgroundColor: string; // "" = transparent
  textAlign: "left" | "center" | "right";
}

const FONT_OPTIONS = [
  { value: "Comfortaa, sans-serif", label: "Comfortaa" },
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Montserrat, sans-serif", label: "Montserrat" },
  { value: "Playfair Display, serif", label: "Playfair Display" },
  { value: "Poppins, sans-serif", label: "Poppins" },
  { value: "Roboto, sans-serif", label: "Roboto" },
  { value: "Lato, sans-serif", label: "Lato" },
  { value: "Oswald, sans-serif", label: "Oswald" },
  { value: "Bebas Neue, sans-serif", label: "Bebas Neue" },
  { value: "Dancing Script, cursive", label: "Dancing Script" },
  { value: "Pacifico, cursive", label: "Pacifico" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Arial, sans-serif", label: "Arial" },
];

export const FRANCHISE_VARIABLES = [
  { value: "nome", label: "Nome da franquia" },
  { value: "cidade", label: "Cidade" },
  { value: "estado", label: "Estado" },
  { value: "endereco", label: "Endereço" },
  { value: "bairro", label: "Bairro" },
  { value: "cep", label: "CEP" },
  { value: "telefone", label: "Telefone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "website", label: "Website" },
  { value: "cnpj", label: "CNPJ" },
  { value: "horario", label: "Horário" },
  { value: "responsavel", label: "Responsável" },
];

export const QR_VARIABLES = [
  { value: "qr_whatsapp", label: "QR WhatsApp" },
  { value: "qr_telefone", label: "QR Telefone" },
  { value: "qr_instagram", label: "QR Instagram" },
  { value: "qr_website", label: "QR Website" },
];

// Sizes as % of container width — scales proportionally
const SIZE_OPTIONS = [
  { value: "1.5", label: "XS" },
  { value: "2", label: "S" },
  { value: "2.5", label: "M" },
  { value: "3", label: "L" },
  { value: "3.5", label: "XL" },
  { value: "4", label: "2XL" },
  { value: "5", label: "3XL" },
  { value: "6", label: "4XL" },
  { value: "8", label: "5XL" },
];

const QR_SIZE_OPTIONS = [
  { value: "5", label: "S" },
  { value: "8", label: "M" },
  { value: "10", label: "L" },
  { value: "12", label: "XL" },
  { value: "15", label: "2XL" },
];

interface Props {
  overlays: BannerOverlay[];
  onChange: (overlays: BannerOverlay[]) => void;
  backgroundImage?: string;
  backgroundGradient?: string;
}

export function BannerTemplateEditor({ overlays, onChange, backgroundImage, backgroundGradient }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; edge: string } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0, x: 0, y: 0 });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    if (!backgroundImage) { setImgSize(null); return; }
    const img = new window.Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = backgroundImage;
  }, [backgroundImage]);

  // Track canvas width for proportional font sizing
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setCanvasWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selectedOverlay = overlays.find((o) => o.id === selected);

  function addOverlay(type: "variable" | "qrcode") {
    const o: BannerOverlay = {
      id: crypto.randomUUID(), type,
      variable: type === "qrcode" ? "qr_whatsapp" : "nome",
      x: 50, y: 50, width: 0, height: 0,
      fontSize: type === "qrcode" ? 8 : 3,
      fontFamily: "Comfortaa, sans-serif",
      fontWeight: "normal", fontStyle: "normal",
      color: "#ffffff", backgroundColor: "",
      textAlign: "center",
    };
    onChange([...overlays, o]);
    setSelected(o.id);
  }

  function updateOverlay(id: string, u: Partial<BannerOverlay>) {
    onChange(overlays.map((o) => o.id === id ? { ...o, ...u } : o));
  }

  function removeOverlay(id: string) {
    onChange(overlays.filter((o) => o.id !== id));
    if (selected === id) setSelected(null);
  }

  function duplicateOverlay(id: string) {
    const src = overlays.find((o) => o.id === id);
    if (!src) return;
    const dup = { ...src, id: crypto.randomUUID(), x: Math.min(src.x + 3, 95), y: Math.min(src.y + 3, 95) };
    onChange([...overlays, dup]);
    setSelected(dup.id);
  }

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(id); setDragging(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const overlay = overlays.find((o) => o.id === id);
    if (!rect || !overlay) return;
    dragOffset.current = {
      x: e.clientX - rect.left - (overlay.x / 100) * rect.width,
      y: e.clientY - rect.top - (overlay.y / 100) * rect.height,
    };
  }, [overlays]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (resizing) {
      const s = resizeStart.current;
      const dxPct = ((e.clientX - s.mouseX) / rect.width) * 100;
      const dyPct = ((e.clientY - s.mouseY) / rect.height) * 100;
      const edge = resizing.edge;
      const updates: Partial<BannerOverlay> = {};

      // Right edges: grow width, shift x
      if (edge.includes("r")) {
        updates.width = Math.max(5, s.w + dxPct);
        updates.x = Math.round((s.x + dxPct / 2) * 10) / 10;
      }
      // Left edges: grow width opposite
      if (edge.includes("l")) {
        updates.width = Math.max(5, s.w - dxPct);
        updates.x = Math.round((s.x + dxPct / 2) * 10) / 10;
      }
      // Bottom edges
      if (edge.includes("b")) {
        updates.height = Math.max(3, s.h + dyPct);
        updates.y = Math.round((s.y + dyPct / 2) * 10) / 10;
      }
      // Top edges
      if (edge.includes("t")) {
        updates.height = Math.max(3, s.h - dyPct);
        updates.y = Math.round((s.y + dyPct / 2) * 10) / 10;
      }

      if (updates.width) updates.width = Math.round(updates.width * 10) / 10;
      if (updates.height) updates.height = Math.round(updates.height * 10) / 10;

      updateOverlay(resizing.id, updates);
      return;
    }

    if (!dragging) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.current.x) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.current.y) / rect.height) * 100));
    updateOverlay(dragging, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }, [dragging, resizing]);

  const handleMouseUp = useCallback(() => { setDragging(null); setResizing(null); }, []);

  function handleResizeStart(e: React.MouseEvent, id: string, edge: string) {
    e.preventDefault(); e.stopPropagation();
    setResizing({ id, edge }); setSelected(id);
    const o = overlays.find((o) => o.id === id);
    if (!o) return;
    resizeStart.current = { mouseX: e.clientX, mouseY: e.clientY, w: o.width || 20, h: o.height || 5, x: o.x, y: o.y };
  }

  const canvasAspect = imgSize ? `${imgSize.w}/${imgSize.h}` : "16/6";

  function getDisplayText(o: BannerOverlay) {
    if (o.type === "qrcode") return "[QR]";
    const v = FRANCHISE_VARIABLES.find((v) => v.value === o.variable);
    return `{{${v?.label || o.variable}}}`;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full rounded-lg overflow-hidden cursor-crosshair select-none border border-ink-100"
        style={{ aspectRatio: canvasAspect }}
        onClick={() => setSelected(null)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {backgroundImage ? (
          <img src={backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : backgroundGradient ? (
          <div className="absolute inset-0" style={{ background: backgroundGradient }} />
        ) : (
          <div className="absolute inset-0 bg-ink-100 flex items-center justify-center">
            <p className="text-xs text-ink-400">Envie uma imagem de fundo</p>
          </div>
        )}

        {/* Grid overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
            {/* Vertical lines — every 5% */}
            {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((p) => (
              <div key={`v${p}`} className="absolute top-0 bottom-0" style={{ left: `${p}%`, width: 1, background: p === 50 ? "rgba(135,138,98,0.5)" : p % 10 === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }} />
            ))}
            {/* Horizontal lines — every 5% */}
            {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((p) => (
              <div key={`h${p}`} className="absolute left-0 right-0" style={{ top: `${p}%`, height: 1, background: p === 50 ? "rgba(135,138,98,0.5)" : p % 10 === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }} />
            ))}
          </div>
        )}

        {overlays.map((o) => {
          const hasBox = o.width > 0 && o.height > 0;
          const isSelected = selected === o.id;
          const boxW = hasBox ? `${o.width}%` : "auto";
          const boxH = hasBox ? `${o.height}%` : "auto";

          return (
            <div
              key={o.id}
              className={cn(
                "absolute cursor-grab active:cursor-grabbing group/overlay",
                isSelected && "z-40",
                dragging === o.id && "z-50"
              )}
              style={{
                left: `${o.x}%`, top: `${o.y}%`,
                transform: "translate(-50%, -50%)",
                width: boxW, height: boxH,
              }}
              onMouseDown={(e) => handleMouseDown(e, o.id)}
              onClick={(e) => { e.stopPropagation(); setSelected(o.id); }}
            >
              {/* Selection border */}
              {isSelected && <div className="absolute inset-0 border-2 border-brand-olive rounded pointer-events-none" style={{ margin: -2 }} />}

              {o.type === "qrcode" ? (
                <div
                  className="flex items-center justify-center bg-white rounded-md mx-auto"
                  style={{ width: canvasWidth * o.fontSize / 100, height: canvasWidth * o.fontSize / 100 }}
                >
                  <QrCode className="text-ink-900" style={{ width: "70%", height: "70%" }} />
                </div>
              ) : (
                <span
                  className={cn("rounded block", hasBox ? "w-full h-full overflow-hidden" : "")}
                  style={{
                    fontSize: canvasWidth * o.fontSize / 100,
                    fontFamily: o.fontFamily,
                    fontWeight: o.fontWeight,
                    fontStyle: o.fontStyle,
                    color: o.color,
                    textAlign: o.textAlign,
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    backgroundColor: o.backgroundColor || "transparent",
                    padding: o.backgroundColor ? "0.15em 0.4em" : "0 0.1em",
                    whiteSpace: hasBox ? "normal" : "nowrap",
                    wordBreak: hasBox ? "break-word" : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: o.textAlign === "center" ? "center" : o.textAlign === "right" ? "flex-end" : "flex-start",
                    lineHeight: 1.2,
                  }}
                >
                  {getDisplayText(o)}
                </span>
              )}

              {/* Resize handles — 4 corners + 4 edges */}
              {isSelected && o.type === "variable" && hasBox && (() => {
                const h = "absolute z-50 bg-brand-olive border-2 border-white rounded-full";
                const dot = "h-3 w-3";
                const bar = "";
                return <>
                  {/* Corners */}
                  <div className={`${h} ${dot} -top-1.5 -left-1.5 cursor-nw-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "tl")} />
                  <div className={`${h} ${dot} -top-1.5 -right-1.5 cursor-ne-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "tr")} />
                  <div className={`${h} ${dot} -bottom-1.5 -left-1.5 cursor-sw-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "bl")} />
                  <div className={`${h} ${dot} -bottom-1.5 -right-1.5 cursor-se-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "br")} />
                  {/* Edges */}
                  <div className={`${h} h-2 w-2 top-1/2 -left-1 -translate-y-1/2 cursor-w-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "l")} />
                  <div className={`${h} h-2 w-2 top-1/2 -right-1 -translate-y-1/2 cursor-e-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "r")} />
                  <div className={`${h} h-2 w-2 -top-1 left-1/2 -translate-x-1/2 cursor-n-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "t")} />
                  <div className={`${h} h-2 w-2 -bottom-1 left-1/2 -translate-x-1/2 cursor-s-resize`} onMouseDown={(e) => handleResizeStart(e, o.id, "b")} />
                </>;
              })()}
              {/* Single resize handle when box mode not yet active */}
              {isSelected && o.type === "variable" && !hasBox && (
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full bg-brand-olive border-2 border-white cursor-se-resize z-50"
                  onMouseDown={(e) => {
                    // Activate box mode on first resize drag
                    updateOverlay(o.id, { width: 20, height: 6 });
                    handleResizeStart(e, o.id, "br");
                  }}
                />
              )}
            </div>
          );
        })}

        {overlays.length === 0 && !backgroundImage && !backgroundGradient && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-ink-400">Adicione uma imagem e posicione variáveis</p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => addOverlay("variable")} className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-olive hover:text-brand-olive transition-colors">
          <Type size={12} /> Texto
        </button>
        <button type="button" onClick={() => addOverlay("qrcode")} className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-olive hover:text-brand-olive transition-colors">
          <QrCode size={12} /> QR Code
        </button>
        <button
          type="button"
          onClick={() => setShowGrid(!showGrid)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            showGrid ? "border-brand-olive bg-brand-olive-soft text-brand-olive" : "border-ink-200 text-ink-500 hover:border-ink-300"
          )}
        >
          <Grid3x3 size={12} /> Grid
        </button>
        {imgSize && <span className="text-[10px] text-ink-400 ml-auto">{imgSize.w} × {imgSize.h}px</span>}
      </div>

      {/* Properties panel */}
      {selectedOverlay && (
        <div className="rounded-lg border border-brand-olive/20 bg-brand-olive-soft/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-700">
              {selectedOverlay.type === "qrcode" ? "QR Code" : "Variável de texto"}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => duplicateOverlay(selectedOverlay.id)} className="rounded-md p-1 text-ink-400 hover:text-ink-700 transition-colors text-[10px]" title="Duplicar elemento">
                Duplicar
              </button>
              <button type="button" onClick={() => removeOverlay(selectedOverlay.id)} className="rounded-md p-1 text-ink-400 hover:text-danger transition-colors" title="Remover">
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Variable */}
          <div>
            <label className="text-[10px] font-medium text-ink-500 mb-1 block">
              {selectedOverlay.type === "qrcode" ? "Tipo" : "Variável"}
            </label>
            <CustomSelect
              options={selectedOverlay.type === "qrcode" ? QR_VARIABLES : FRANCHISE_VARIABLES}
              value={selectedOverlay.variable}
              onChange={(v) => updateOverlay(selectedOverlay.id, { variable: v })}
            />
          </div>

          {/* Font + Size */}
          <div className="grid gap-2 grid-cols-2">
            {selectedOverlay.type === "variable" && (
              <div>
                <label className="text-[10px] font-medium text-ink-500 mb-1 block">Fonte</label>
                <CustomSelect options={FONT_OPTIONS} value={selectedOverlay.fontFamily} onChange={(v) => updateOverlay(selectedOverlay.id, { fontFamily: v })} />
              </div>
            )}
            <div className={selectedOverlay.type === "qrcode" ? "col-span-2" : ""}>
              <label className="text-[10px] font-medium text-ink-500 mb-1 block">Tamanho</label>
              <CustomSelect
                options={selectedOverlay.type === "qrcode" ? QR_SIZE_OPTIONS : SIZE_OPTIONS}
                value={String(selectedOverlay.fontSize)}
                onChange={(v) => updateOverlay(selectedOverlay.id, { fontSize: Number(v) })}
              />
            </div>
          </div>

          {selectedOverlay.type === "variable" && (
            <>
              {/* Style row */}
              <div className="flex items-center gap-1">
                {([
                  { key: "fontWeight", value: "bold", icon: Bold, label: "Negrito" },
                  { key: "fontStyle", value: "italic", icon: Italic, label: "Itálico" },
                ] as const).map(({ key, value, icon: Icon, label }) => (
                  <button key={key} type="button" onClick={() => updateOverlay(selectedOverlay.id, { [key]: selectedOverlay[key] === value ? "normal" : value } as Partial<BannerOverlay>)} className={cn("flex h-7 w-7 items-center justify-center rounded-md border transition-colors", selectedOverlay[key] === value ? "border-brand-olive bg-brand-olive-soft text-brand-olive" : "border-ink-200 text-ink-500 hover:border-ink-300")} title={label}>
                    <Icon size={13} />
                  </button>
                ))}
                <div className="w-px h-5 bg-ink-200 mx-1" />
                {(["left", "center", "right"] as const).map((align) => {
                  const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
                  return (
                    <button key={align} type="button" onClick={() => updateOverlay(selectedOverlay.id, { textAlign: align })} className={cn("flex h-7 w-7 items-center justify-center rounded-md border transition-colors", selectedOverlay.textAlign === align ? "border-brand-olive bg-brand-olive-soft text-brand-olive" : "border-ink-200 text-ink-500 hover:border-ink-300")}>
                      <Icon size={13} />
                    </button>
                  );
                })}
              </div>

              {/* Colors row */}
              <div className="grid gap-2 grid-cols-2">
                <div>
                  <label className="text-[10px] font-medium text-ink-500 mb-1 block">Cor do texto</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={selectedOverlay.color} onChange={(e) => updateOverlay(selectedOverlay.id, { color: e.target.value })} className="h-7 w-7 rounded border border-ink-100 cursor-pointer p-0.5 shrink-0" />
                    <input type="text" value={selectedOverlay.color} onChange={(e) => updateOverlay(selectedOverlay.id, { color: e.target.value })} className="h-7 flex-1 min-w-0 rounded-md border border-ink-100 bg-white px-2 text-[10px] font-mono text-ink-900 focus:border-brand-olive focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-ink-500 mb-1 block">Fundo do texto</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={selectedOverlay.backgroundColor || "#000000"} onChange={(e) => updateOverlay(selectedOverlay.id, { backgroundColor: e.target.value })} className="h-7 w-7 rounded border border-ink-100 cursor-pointer p-0.5 shrink-0" />
                    <input type="text" value={selectedOverlay.backgroundColor} onChange={(e) => updateOverlay(selectedOverlay.id, { backgroundColor: e.target.value })} className="h-7 flex-1 min-w-0 rounded-md border border-ink-100 bg-white px-2 text-[10px] font-mono text-ink-900 focus:border-brand-olive focus:outline-none" placeholder="Transparente" />
                    {selectedOverlay.backgroundColor && (
                      <button type="button" onClick={() => updateOverlay(selectedOverlay.id, { backgroundColor: "" })} className="shrink-0 rounded-md p-0.5 text-ink-400 hover:text-ink-700" title="Remover fundo">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick colors */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-ink-400 mr-1">Rápido:</span>
                {["#ffffff", "#000000", "#878a62", "#f0e8d6", "#18160f"].map((c) => (
                  <button key={c} type="button" onClick={() => updateOverlay(selectedOverlay.id, { color: c })} className={cn("h-5 w-5 rounded-full border shrink-0 transition-transform hover:scale-110", selectedOverlay.color === c ? "border-brand-olive ring-1 ring-brand-olive" : "border-ink-200")} style={{ backgroundColor: c }} />
                ))}
              </div>
            </>
          )}

          {/* Text box mode */}
          {selectedOverlay.type === "variable" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-ink-500">Caixa de texto</label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedOverlay.width > 0) {
                      updateOverlay(selectedOverlay.id, { width: 0, height: 0 });
                    } else {
                      updateOverlay(selectedOverlay.id, { width: 25, height: 8 });
                    }
                  }}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    selectedOverlay.width > 0 ? "bg-brand-olive" : "bg-ink-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    selectedOverlay.width > 0 ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </button>
              </div>
              <p className="text-[9px] text-ink-400 mt-1">
                {selectedOverlay.width > 0
                  ? "Arraste o ponto verde pra redimensionar. O texto quebra linha dentro da caixa."
                  : "Ative pra definir uma área fixa e sobrescrever o texto original."
                }
              </p>
            </div>
          )}

          {/* Position */}
          <div className="flex items-center gap-3 text-[10px] text-ink-400 pt-1 border-t border-ink-100">
            <span>X: {selectedOverlay.x.toFixed(1)}%</span>
            <span>Y: {selectedOverlay.y.toFixed(1)}%</span>
            {selectedOverlay.width > 0 && <span>W: {selectedOverlay.width.toFixed(1)}%</span>}
            {selectedOverlay.height > 0 && <span>H: {selectedOverlay.height.toFixed(1)}%</span>}
          </div>
        </div>
      )}

      {/* Elements list */}
      {overlays.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wider">Elementos ({overlays.length})</p>
          {overlays.map((o) => {
            const label = o.type === "qrcode"
              ? QR_VARIABLES.find((v) => v.value === o.variable)?.label || o.variable
              : FRANCHISE_VARIABLES.find((v) => v.value === o.variable)?.label || o.variable;
            return (
              <button
                key={o.id} type="button"
                onClick={() => setSelected(o.id)}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs text-left transition-colors",
                  selected === o.id ? "bg-brand-olive-soft text-brand-olive" : "hover:bg-ink-50 text-ink-700"
                )}
              >
                {o.type === "qrcode" ? <QrCode size={11} /> : <Type size={11} />}
                <span className="flex-1 truncate" style={{ fontFamily: o.fontFamily }}>{label}</span>
                <span className="text-[9px] text-ink-400">{SIZE_OPTIONS.find((s) => s.value === String(o.fontSize))?.label || `${o.fontSize}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
