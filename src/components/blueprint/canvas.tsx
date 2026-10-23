"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/** Konva needs the browser, so the canvas is loaded client-side only. */
export const BlueprintCanvas = dynamic(() => import("./blueprint-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading blueprint…
    </div>
  ),
});

export { PX } from "./types";
export type { BlueprintCanvasProps, CanvasControls, SeatVisual } from "./types";
