"use client";

import { useEffect, useState } from "react";

export function useIsMac() {
  const [isMac, setIsMac] = useState<boolean | null>(null);
  useEffect(() => {
    setIsMac(
      navigator.platform?.toUpperCase().includes("MAC") ||
        navigator.userAgent?.includes("Mac")
    );
  }, []);
  return isMac;
}

/** Returns "⌘" on Mac, "Ctrl+" on Windows/Linux, "" until hydrated */
export function useModKey() {
  const isMac = useIsMac();
  if (isMac === null) return "";
  return isMac ? "⌘" : "Ctrl+";
}
