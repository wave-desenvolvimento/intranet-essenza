"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "essenza-pwa-install-dismissed";
const DISMISS_DAYS = 7; // Show again after 7 days

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOS() {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isDismissed() {
  if (typeof window === "undefined") return true;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;
  const dismissedAt = Number(dismissed);
  return Date.now() - dismissedAt < DISMISS_DAYS * 86400000;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    // Already installed or dismissed
    if (isStandalone() || isDismissed()) return;

    // iOS Safari — no beforeinstallprompt, show manual instructions
    if (isIOS()) {
      // Only show in Safari (not in-app browsers)
      const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS/.test(navigator.userAgent);
      if (isSafari) {
        setTimeout(() => setShowIOS(true), 3000);
      }
      return;
    }

    // Android/Chrome — capture install prompt
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 2000);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as unknown as { prompt: () => void }).prompt();
    const result = await (deferredPrompt as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice;
    if (result.outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  function handleDismiss() {
    setShow(false);
    setShowIOS(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  // Android/Chrome install banner
  if (show) {
    return (
      <div className="fixed bottom-16 left-3 right-3 z-[80] md:hidden animate-in slide-in-from-bottom duration-300">
        <div className="rounded-2xl bg-white border border-ink-100 shadow-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-olive-soft">
              <Download size={18} className="text-brand-olive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900">Instalar Essenza Hub</p>
              <p className="text-xs text-ink-500 mt-0.5">Adicione à tela inicial para acesso rápido, como um app nativo.</p>
            </div>
            <button onClick={handleDismiss} className="rounded-md p-1 text-ink-400 hover:text-ink-700 shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-olive px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive-dark transition-colors"
            >
              <Download size={14} /> Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari instructions
  if (showIOS) {
    return (
      <div className="fixed bottom-16 left-3 right-3 z-[80] md:hidden animate-in slide-in-from-bottom duration-300">
        <div className="rounded-2xl bg-white border border-ink-100 shadow-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-olive-soft">
              <Download size={18} className="text-brand-olive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900">Instalar Essenza Hub</p>
              <p className="text-xs text-ink-500 mt-0.5">Adicione à tela inicial para acesso rápido.</p>
            </div>
            <button onClick={handleDismiss} className="rounded-md p-1 text-ink-400 hover:text-ink-700 shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 rounded-xl bg-ink-50 px-4 py-3 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-ink-100">
                <span className="text-xs font-bold text-ink-500">1</span>
              </div>
              <p className="text-xs text-ink-700">
                Toque no botão <Share size={12} className="inline text-[#007AFF] mx-0.5" /> <strong>Compartilhar</strong> na barra do Safari
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-ink-100">
                <span className="text-xs font-bold text-ink-500">2</span>
              </div>
              <p className="text-xs text-ink-700">
                Toque em <Plus size={12} className="inline text-ink-700 mx-0.5" /> <strong>Adicionar à Tela de Início</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-ink-100">
                <span className="text-xs font-bold text-ink-500">3</span>
              </div>
              <p className="text-xs text-ink-700">
                Toque em <strong>Adicionar</strong> no canto superior direito
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="w-full mt-3 rounded-xl border border-ink-200 px-4 py-2 text-xs font-medium text-ink-600 hover:bg-ink-50 transition-colors"
          >
            Entendi, fechar
          </button>
        </div>
      </div>
    );
  }

  return null;
}
