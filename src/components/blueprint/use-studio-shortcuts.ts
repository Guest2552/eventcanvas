"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { PlacedElement } from "@/lib/types";

/** Arrow keys move the selection by half a foot; with Shift, by two feet. */
export const NUDGE_FT = 0.5;
export const NUDGE_LARGE_FT = 2;

interface StudioShortcuts {
  /** True when an element or a zone is selected */
  hasSelection: boolean;
  selectedElement?: PlacedElement;
  onEscape: () => void;
  onDelete: () => void;
  onDuplicate: (el: PlacedElement) => void;
  onRotate: (el: PlacedElement) => void;
  onNudge: (el: PlacedElement, dx: number, dy: number) => void;
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * Blueprint Studio keyboard shortcuts: Esc, Delete/Backspace, Ctrl/⌘+D, R, arrow keys (Shift = larger step).
 * Ignored while typing in a form field. Handlers are read fresh on every key press.
 */
export function useStudioShortcuts(shortcuts: StudioShortcuts) {
  const latest = useRef(shortcuts);
  useLayoutEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      const s = latest.current;
      if (e.key === "Escape") return s.onEscape();
      if (!s.hasSelection) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return s.onDelete();
      }
      const el = s.selectedElement;
      if (!el) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        return s.onDuplicate(el);
      }
      if (!mod && e.key.toLowerCase() === "r") return s.onRotate(el);
      const dir = ARROWS[e.key];
      if (dir) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_LARGE_FT : NUDGE_FT;
        s.onNudge(el, dir[0] * step, dir[1] * step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
