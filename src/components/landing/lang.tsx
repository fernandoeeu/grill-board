import { useLayoutEffect, type ReactNode } from "react";
import { Button } from "react-aria-components";

import { cn } from "@/lib/utils";

export type LandingLang = "en" | "pt";

/** localStorage key. UI preference only, mirroring `grill-board-theme`. */
export const LANG_STORAGE_KEY = "grill-board-lang";

/**
 * NO-FLASH SNIPPET — the landing route injects this via `head.scripts` so
 * html[data-lang] is set before first paint. Both languages are in the DOM;
 * CSS in styles.css shows exactly one. Default (no attribute) renders EN.
 */
export const LANG_SCRIPT = `(function(){try{var l=localStorage.getItem('grill-board-lang');if(l==='pt'||l==='en'){document.documentElement.dataset.lang=l}}catch(e){}})()`;

function applyLang(lang: LandingLang) {
  document.documentElement.dataset.lang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Private mode: the choice still applies for this visit.
  }
}

/**
 * Re-applies the stored language on client-side navigations, where the inline
 * head script from the initial document load does not re-run.
 */
export function useStoredLang() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === "pt" || stored === "en") {
        document.documentElement.dataset.lang = stored;
      }
    } catch {
      // No storage, no preference: EN stays.
    }
  }, []);
}

interface TProps {
  en: ReactNode;
  pt: ReactNode;
  className?: string;
}

/** Renders both languages; CSS picks one via html[data-lang]. */
export function T({ en, pt, className }: TProps) {
  return (
    <>
      <span data-lang-en className={className}>
        {en}
      </span>
      <span data-lang-pt lang="pt-BR" className={className}>
        {pt}
      </span>
    </>
  );
}

/** EN|PT stamp pair. Active state is pure CSS off html[data-lang]. */
export function LangToggle({ className }: { className?: string }) {
  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className={cn("flex items-center gap-1.5", className)}
    >
      <Button
        className="lang-btn lang-btn-en press text-sm"
        style={{ rotate: "-2deg" }}
        onPress={() => applyLang("en")}
      >
        EN
      </Button>
      <Button
        className="lang-btn lang-btn-pt press text-sm"
        style={{ rotate: "1.5deg" }}
        onPress={() => applyLang("pt")}
      >
        PT
      </Button>
    </div>
  );
}
