"use client";

import { useSyncExternalStore } from "react";
import DOMPurify from "dompurify";

const subscribe = () => () => {};

/** HTML sanitizado. So renderiza no cliente: o DOMPurify precisa do DOM e quebra no SSR. */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  if (!isClient) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
}
