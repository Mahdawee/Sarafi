"use client";

import { useEffect } from "react";

/**
 * The global quick-entry palette survives a route change through sessionStorage.
 * A page consumes its own key once, then opens the appropriate multi-row form.
 */
export function useQuickEntry(key: string, open: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("sarafi:quick-entry") !== key) return;
    window.sessionStorage.removeItem("sarafi:quick-entry");
    const frame = window.requestAnimationFrame(open);
    return () => window.cancelAnimationFrame(frame);
  }, [key, open]);
}
