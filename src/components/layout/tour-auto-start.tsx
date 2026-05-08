"use client";

import { useEffect } from "react";
import { useGuidedTour } from "./guided-tour";

export function TourAutoStart() {
  const { startTour, shouldAutoStart } = useGuidedTour();

  useEffect(() => {
    if (shouldAutoStart) {
      // Delay to ensure DOM is fully rendered
      const timer = setTimeout(() => startTour(), 1000);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoStart, startTour]);

  return null;
}
