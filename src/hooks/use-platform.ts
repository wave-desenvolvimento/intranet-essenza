"use client";

import { useEffect, useState } from "react";

export function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(
      navigator.platform?.toUpperCase().includes("MAC") ||
        navigator.userAgent?.includes("Mac")
    );
  }, []);
  return isMac;
}

/** Returns "⌘" on Mac, "Ctrl" on Windows/Linux */
export function useModKey() {
  const isMac = useIsMac();
  return isMac ? "⌘" : "Ctrl+";
}
