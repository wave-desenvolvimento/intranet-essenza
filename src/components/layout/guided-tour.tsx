"use client";

import { useEffect, useState, useCallback } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { usePermissions } from "@/hooks/use-permissions";

interface TourStep extends DriveStep {
  module?: string;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
  insideDrawer?: boolean; // element only exists when drawer is open — skip DOM check
}

function isMobileView() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

// Steps that work on both mobile and desktop
const UNIVERSAL_STEPS: TourStep[] = [
  {
    popover: {
      title: "Bem-vindo ao Hub Essenza!",
      description: "Este é seu centro de comando. Aqui você encontra materiais, campanhas, pedidos e muito mais. Vamos fazer um tour rápido!",
      side: "over",
      align: "center",
    },
  },
  {
    element: "[data-tour='search']",
    popover: {
      title: "Busca Rápida",
      description: "Toque aqui (ou ⌘K no desktop) para buscar qualquer conteúdo ou página.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: "[data-tour='notifications']",
    popover: {
      title: "Notificações",
      description: "Novos materiais publicados e atualizações aparecem aqui.",
      side: "bottom",
      align: "end",
    },
  },
];

// Desktop: points to sidebar items
const DESKTOP_NAV_STEPS: TourStep[] = [
  {
    element: "[data-tour='sidebar']",
    desktopOnly: true,
    popover: {
      title: "Menu de Navegação",
      description: "Todas as seções do sistema ficam aqui. Você pode recolher o menu clicando no ícone no topo.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='content-section']",
    desktopOnly: true,
    module: "dashboard",
    popover: {
      title: "Conteúdo da Marca",
      description: "Materiais de campanha, identidade visual, fotos, vídeos e treinamentos.",
      side: "right",
      align: "start",
    },
  },
];

// Mobile: pedidos first, then menu opens drawer, then drawer items
const MOBILE_NAV_STEPS: TourStep[] = [
  // 1. Pedidos no bottom nav
  {
    element: "[data-tour='mobile-pedidos-btn']",
    mobileOnly: true,
    module: "pedidos",
    popover: {
      title: "Pedidos",
      description: "Faça pedidos de produtos diretamente por aqui. O catálogo mostra preços do seu segmento.",
      side: "top",
      align: "center",
    },
  },
  // 2. Menu button — opens drawer on next
  {
    element: "[data-tour='mobile-menu-btn']",
    mobileOnly: true,
    popover: {
      title: "Menu Completo",
      description: "Toque aqui para acessar todos os módulos. Vamos abrir pra você ver!",
      side: "top",
      align: "center",
      onNextClick: () => {
        const menuBtn = document.querySelector("[data-tour='mobile-menu-btn']") as HTMLElement;
        if (menuBtn) menuBtn.click();
        setTimeout(() => {
          const d = (window as unknown as { __essenzaTourDriver?: { moveNext: () => void } }).__essenzaTourDriver;
          if (d) d.moveNext();
        }, 400);
      },
    },
  },
  // 3+ Drawer items — each module inside the drawer
  {
    element: "[data-tour='drawer-templates']",
    mobileOnly: true,
    insideDrawer: true,
    module: "templates",
    popover: {
      title: "Templates",
      description: "Baixe materiais personalizados com os dados da sua franquia.",
      side: "right",
      align: "start",
      onPrevClick: () => {
        // Close drawer and go back to menu button
        const backdrop = document.querySelector("[data-tour='mobile-drawer']")?.parentElement?.querySelector(".bg-black\\/30") as HTMLElement;
        if (backdrop) backdrop.click();
        setTimeout(() => {
          const d = (window as unknown as { __essenzaTourDriver?: { movePrevious: () => void } }).__essenzaTourDriver;
          if (d) d.movePrevious();
        }, 350);
      },
    },
  },
  {
    element: "[data-tour='drawer-franquias']",
    mobileOnly: true,
    insideDrawer: true,
    module: "franquias",
    popover: {
      title: "Franquias",
      description: "Gerencie as franquias da rede, dados, usuários e permissões.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='drawer-analytics']",
    mobileOnly: true,
    insideDrawer: true,
    module: "analytics",
    popover: {
      title: "Relatórios",
      description: "Acompanhe métricas de uso, downloads e engajamento por franquia.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='drawer-cms']",
    mobileOnly: true,
    insideDrawer: true,
    module: "cms",
    popover: {
      title: "CMS",
      description: "Gerencie todo o conteúdo: banners, materiais, campanhas e vídeos.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='drawer-configuracoes']",
    mobileOnly: true,
    insideDrawer: true,
    module: "configuracoes",
    popover: {
      title: "Permissões",
      description: "Configure tipos de acesso e defina o que cada perfil pode fazer.",
      side: "right",
      align: "start",
    },
  },
  // Last drawer step — closes drawer on next
  {
    element: "[data-tour='mobile-drawer']",
    mobileOnly: true,
    insideDrawer: true,
    popover: {
      title: "Conteúdo da Marca",
      description: "Aqui também ficam todas as seções de conteúdo: universo da marca, materiais, campanhas, redes sociais e treinamentos.",
      side: "right",
      align: "center",
      onNextClick: () => {
        const backdrop = document.querySelector("[data-tour='mobile-drawer']")?.parentElement?.querySelector(".bg-black\\/30") as HTMLElement;
        if (backdrop) backdrop.click();
        setTimeout(() => {
          const d = (window as unknown as { __essenzaTourDriver?: { moveNext: () => void } }).__essenzaTourDriver;
          if (d) d.moveNext();
        }, 350);
      },
    },
  },
];

// Final step
const FINAL_STEP: TourStep = {
  element: "[data-tour='help']",
  popover: {
    title: "Precisa de ajuda?",
    description: "Clique aqui a qualquer momento para ver o manual ou refazer este tour.",
    side: "bottom",
    align: "end",
  },
};

const TOUR_STORAGE_KEY = "essenza-tour-completed";

export function useGuidedTour() {
  const { can, canModule, loading } = usePermissions();
  const [tourCompleted, setTourCompleted] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTourCompleted(localStorage.getItem(TOUR_STORAGE_KEY) === "true");
  }, []);

  const startTour = useCallback(async () => {
    if (loading) return;
    const mobile = isMobileView();

    // Desktop: ensure sidebar is expanded before tour
    if (!mobile) {
      const sidebar = document.querySelector("[data-tour='sidebar']") as HTMLElement;
      if (sidebar && sidebar.offsetWidth < 100) {
        const expandBtn = sidebar.querySelector("button") as HTMLElement;
        if (expandBtn) expandBtn.click();
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    // Mobile: ensure drawer is closed (tour will point to bottom nav)
    if (mobile) {
      const drawer = document.querySelector("[data-tour='mobile-menu-btn']");
      // Drawer should be closed for the tour to show bottom nav properly
    }

    // Build steps based on device
    const allSteps: TourStep[] = [
      ...UNIVERSAL_STEPS,
      ...(mobile ? MOBILE_NAV_STEPS : DESKTOP_NAV_STEPS),
      FINAL_STEP,
    ];

    // Filter by permission and device
    const steps = allSteps.filter((step) => {
      if (step.desktopOnly && mobile) return false;
      if (step.mobileOnly && !mobile) return false;
      if (step.module && !canModule(step.module)) return false;
      // Skip DOM check for drawer items (they only exist when drawer is open)
      if (step.element && !step.insideDrawer && !document.querySelector(step.element as string)) return false;
      return true;
    });

    if (steps.length === 0) return;

    const d = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayColor: "rgba(0,0,0,0.6)",
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "essenza-tour-popover",
      nextBtnText: "Próximo →",
      prevBtnText: "← Anterior",
      doneBtnText: "Finalizar ✓",
      progressText: "{{current}} de {{total}}",
      onDestroyStarted: () => {
        localStorage.setItem(TOUR_STORAGE_KEY, "true");
        setTourCompleted(true);
        d.destroy();
      },
      steps: steps.map(({ module, desktopOnly, mobileOnly, insideDrawer, ...step }) => step),
    });

    // Store driver reference for step callbacks
    (window as unknown as { __essenzaTourDriver?: typeof d }).__essenzaTourDriver = d;

    d.drive();
  }, [loading, canModule]);

  const shouldAutoStart = !tourCompleted && !loading;

  return { startTour, tourCompleted, shouldAutoStart };
}
