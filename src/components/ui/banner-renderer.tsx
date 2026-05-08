"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import type { BannerOverlay } from "./banner-template-editor";

interface FranchiseData {
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  neighborhood: string | null;
  cep: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
  cnpj: string | null;
  opening_hours: string | null;
  manager_name: string | null;
  logo_url: string | null;
}

const VARIABLE_MAP: Record<string, keyof FranchiseData> = {
  nome: "name",
  cidade: "city",
  estado: "state",
  endereco: "address",
  bairro: "neighborhood",
  cep: "cep",
  telefone: "phone",
  whatsapp: "whatsapp",
  email: "email",
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  website: "website",
  cnpj: "cnpj",
  horario: "opening_hours",
  responsavel: "manager_name",
};

function getQrValue(variable: string, franchise: FranchiseData): string {
  switch (variable) {
    case "qr_whatsapp":
      return franchise.whatsapp ? `https://wa.me/${franchise.whatsapp.replace(/\D/g, "")}` : "";
    case "qr_telefone":
      return franchise.phone ? `tel:${franchise.phone.replace(/\D/g, "")}` : "";
    case "qr_instagram":
      return franchise.instagram ? `https://instagram.com/${franchise.instagram.replace("@", "")}` : "";
    case "qr_website": {
      const site = franchise.website || "";
      return site.startsWith("http") ? site : site ? `https://${site}` : "";
    }
    default:
      return "";
  }
}

function resolveVariable(variable: string, franchise: FranchiseData): string {
  const key = VARIABLE_MAP[variable];
  if (!key) return "";
  return String(franchise[key] || "");
}

interface Props {
  overlays: BannerOverlay[];
  franchise: FranchiseData;
  backgroundImage?: string;
  backgroundGradient?: string;
  className?: string;
  aspectRatio?: string;
  maxHeight?: string;
  forceWidth?: number;
}

export function BannerRenderer({ overlays, franchise, backgroundImage, backgroundGradient, className, aspectRatio = "16/6", maxHeight, forceWidth }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [realAspect, setRealAspect] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(forceWidth || 800);

  // Detect real image aspect ratio
  useEffect(() => {
    if (!backgroundImage) { setRealAspect(null); return; }
    const img = new window.Image();
    img.onload = () => setRealAspect(`${img.naturalWidth}/${img.naturalHeight}`);
    img.src = backgroundImage;
  }, [backgroundImage]);

  // Generate QR codes
  useEffect(() => {
    const qrOverlays = overlays.filter((o) => o.type === "qrcode");
    if (qrOverlays.length === 0) return;

    async function generateQrs() {
      const images: Record<string, string> = {};
      for (const overlay of qrOverlays) {
        const value = getQrValue(overlay.variable, franchise);
        if (value) {
          try {
            images[overlay.id] = await QRCode.toDataURL(value, {
              width: overlay.fontSize * 2,
              margin: 1,
              color: { dark: "#000000", light: "#ffffff" },
            });
          } catch {
            // skip invalid QR
          }
        }
      }
      setQrImages(images);
    }
    generateQrs();
  }, [overlays, franchise]);

  // Track width for proportional sizing (skip if forceWidth provided)
  useEffect(() => {
    if (forceWidth) { setContainerWidth(forceWidth); return; }
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [forceWidth]);

  const finalAspect = realAspect || aspectRatio;

  return (
    <div
      ref={containerRef}
      className={className || ""}
      style={{
        position: "relative",
        overflow: forceWidth ? "visible" : "hidden",
        borderRadius: forceWidth ? 0 : "0.75rem",
        display: forceWidth ? "block" : "inline-block",
        width: forceWidth ? forceWidth : undefined,
        maxWidth: forceWidth ? undefined : "100%",
      }}
    >
      {/* Image as flow element — drives the container size naturally */}
      {backgroundImage ? (
        <img src={backgroundImage} alt="" style={{ display: "block", width: "100%", height: "auto", ...(maxHeight ? { maxHeight } : {}) }} />
      ) : (
        <div style={{ aspectRatio: finalAspect, width: "100%", background: backgroundGradient || "#e5e5e5", ...(maxHeight ? { maxHeight } : {}) }} />
      )}

      {overlays.map((overlay) => {
        const pxFont = containerWidth * overlay.fontSize / 100;
        const hasBox = overlay.width > 0 && overlay.height > 0;
        const boxW = hasBox ? containerWidth * overlay.width / 100 : undefined;
        const boxH = hasBox ? containerWidth * overlay.height / 100 : undefined;

        // Wrapper: zero-size anchor at x%, y% — child offsets from here
        return (
          <div key={overlay.id} style={{ position: "absolute", left: `${overlay.x}%`, top: `${overlay.y}%`, width: 0, height: 0, overflow: "visible" }}>
            {overlay.type === "qrcode" ? (() => {
              const src = qrImages[overlay.id];
              if (!src) return null;
              return (
                <img src={src} alt="QR" style={{
                  position: "absolute",
                  left: -pxFont / 2, top: -pxFont / 2,
                  width: pxFont, height: pxFont,
                  borderRadius: 4,
                }} />
              );
            })() : (() => {
              const text = resolveVariable(overlay.variable, franchise);
              if (!text) return null;
              return (
                <div
                  ref={(el) => {
                    // Auto-center: measure rendered size and offset by half
                    if (el && !hasBox) {
                      el.style.marginLeft = `-${el.offsetWidth / 2}px`;
                      el.style.marginTop = `-${el.offsetHeight / 2}px`;
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: boxW ? -boxW / 2 : 0,
                    top: boxH ? -boxH / 2 : 0,
                    width: boxW || "max-content",
                    height: boxH || "auto",
                    fontSize: pxFont,
                    fontFamily: overlay.fontFamily || "Comfortaa, sans-serif",
                    fontWeight: overlay.fontWeight,
                    fontStyle: overlay.fontStyle,
                    color: overlay.color,
                    textAlign: overlay.textAlign,
                    whiteSpace: hasBox ? "normal" : "nowrap",
                    wordBreak: hasBox ? "break-word" : undefined,
                    textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    backgroundColor: overlay.backgroundColor || "transparent",
                    padding: overlay.backgroundColor ? "0.15em 0.4em" : "0",
                    borderRadius: overlay.backgroundColor ? "0.2em" : "0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: overlay.textAlign === "center" ? "center" : overlay.textAlign === "right" ? "flex-end" : "flex-start",
                    lineHeight: 1.2,
                    overflow: "hidden",
                  }}
                >
                  {text}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
