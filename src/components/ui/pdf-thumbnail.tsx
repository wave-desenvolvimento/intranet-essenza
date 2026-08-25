"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLoadPromise: Promise<any> | null = null;

function loadPdfjs() {
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error("pdfjsLib not found")); return; }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return pdfjsLoadPromise;
}

export function PdfThumbnail({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Lazy: so renderiza quando visivel no viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    async function render() {
      try {
        const pdfjsLib = await loadPdfjs();
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.max(canvas.offsetWidth, 150) / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        if (!cancelled) setLoaded(true);
      } catch {
        // Falha silenciosa - mostra fallback
      }
    }
    render();
    return () => { cancelled = true; };
  }, [url, visible]);

  return (
    <div ref={containerRef} className={cn("w-full h-full flex items-center justify-center", className)}>
      <canvas ref={canvasRef} className={cn("w-full h-full object-cover", loaded ? "block" : "hidden")} />
      {!loaded && <FileText size={36} className="text-red-400" />}
    </div>
  );
}

export function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}
