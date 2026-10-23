import type { Box, SeatInfo } from "@/lib/engine/geometry";
import type { Layout, PlacedElement, Zone } from "@/lib/types";

/** Pixels per foot at zoom 1 */
export const PX = 10;

export interface SeatVisual {
  fill: string;
  stroke?: string;
  tooltip?: string;
  clickable?: boolean;
}

export interface CanvasControls {
  fit: () => void;
  zoomBy: (factor: number) => void;
  toDataURL: () => string | undefined;
  centerOn: (x: number, y: number) => void;
}

export interface BlueprintCanvasProps {
  layout: Layout;
  mode: "edit" | "seats" | "view";
  selectedId?: string | null;
  onSelect?: (id: string | null, type?: "element" | "zone") => void;
  onElementChange?: (id: string, patch: Partial<PlacedElement>) => void;
  onZoneChange?: (id: string, patch: Partial<Zone>) => void;
  onDropKind?: (kind: string, x: number, y: number) => void;
  seatVisual?: (seat: SeatInfo) => SeatVisual;
  onSeatClick?: (seat: SeatInfo) => void;
  /** Elements flagged by safety checks */
  warnIds?: Set<string>;
  /** Elements to spotlight (e.g. a guest's table) */
  focusIds?: Set<string>;
  showGrid?: boolean;
  snap?: number;
  showZones?: boolean;
  zoneDraw?: boolean;
  onZoneDrawn?: (box: Box) => void;
  controls?: React.RefObject<CanvasControls | null>;
  className?: string;
}
