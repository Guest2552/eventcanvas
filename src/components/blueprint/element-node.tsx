import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { memo, useMemo } from "react";
import { Circle, Group, Rect, Text } from "react-konva";
import { CATEGORY_STYLE, getDef } from "@/lib/catalog/elements";
import { localSeats, type SeatInfo, seatsForElement } from "@/lib/engine/geometry";
import { clamp } from "@/lib/math";
import type { PlacedElement } from "@/lib/types";
import { PX, type SeatVisual } from "./types";

/** Stable callbacks the canvas hands to every item, so memoised items never re-render just because a handler changed. */
export interface ItemApi {
  register: (id: string, n: Konva.Node | null) => void;
  select: (id: string) => void;
  dragEnd: (el: PlacedElement, e: KonvaEventObject<DragEvent>) => void;
  transformEnd: (el: PlacedElement, e: KonvaEventObject<Event>) => void;
  seatClick: (s: SeatInfo) => void;
  hover: (text: string | null) => void;
}

interface ElementNodeProps {
  el: PlacedElement;
  font: string;
  selected: boolean;
  warn: boolean;
  focus: boolean;
  draggable: boolean;
  listening: boolean;
  seatsClickable: boolean;
  visuals?: SeatVisual[];
  /** Cheap signature of `visuals`, used by memo to skip unchanged items */
  seatKey: string;
  api: ItemApi;
}

/** One blueprint item with its seats. Memoised: it re-renders only when its own data or state changes. */
export const ElementNode = memo(
  ElementNodeImpl,
  (a, b) =>
    a.el === b.el &&
    a.font === b.font &&
    a.selected === b.selected &&
    a.warn === b.warn &&
    a.focus === b.focus &&
    a.draggable === b.draggable &&
    a.listening === b.listening &&
    a.seatsClickable === b.seatsClickable &&
    a.seatKey === b.seatKey &&
    a.api === b.api,
);

function ElementNodeImpl({ el, font, selected, warn, focus, draggable, listening, seatsClickable, visuals, api }: ElementNodeProps) {
  const def = getDef(el.kind);
  const style = CATEGORY_STYLE[def.category];
  const w = el.w * PX;
  const h = el.h * PX;
  const seats = useMemo(() => (def.category === "seating" ? seatsForElement(el) : []), [el, def.category]);
  const local = useMemo(() => localSeats(el.kind, el.w, el.h), [el.kind, el.w, el.h]);
  const isTable = def.category === "seating";
  const dark = el.kind === "pillar" || el.kind === "wall";
  const fill = el.kind === "exit" ? "#16a34a" : el.kind === "entry" ? "#0ea5e9" : dark ? "#57534e" : style.fill;
  const stroke = warn
    ? "#dc2626"
    : focus
      ? "#e11d48"
      : selected
        ? "#e11d48"
        : el.kind === "exit"
          ? "#15803d"
          : el.kind === "entry"
            ? "#0369a1"
            : dark
              ? "#44403c"
              : style.stroke;
  const strokeWidth = warn || focus || selected ? 3 : 1.5;
  const minSide = Math.min(w, h);
  const seatsInteractive = seatsClickable;
  const onSelect = () => api.select(el.id);

  return (
    <Group
      ref={(n) => api.register(el.id, n)}
      x={(el.x + el.w / 2) * PX}
      y={(el.y + el.h / 2) * PX}
      offsetX={w / 2}
      offsetY={h / 2}
      rotation={el.rotation}
      draggable={draggable}
      listening={listening}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={(e) => api.dragEnd(el, e)}
      onTransformEnd={(e) => api.transformEnd(el, e)}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c && draggable) c.style.cursor = "move";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "";
      }}
    >
      {focus && <Rect x={-10} y={-10} width={w + 20} height={h + 20} cornerRadius={14} fill="#e11d48" opacity={0.12} listening={false} />}
      {def.shape === "round" ? (
        <Circle x={w / 2} y={h / 2} radius={w / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} dash={warn ? [6, 4] : undefined} />
      ) : (
        <Rect
          width={w}
          height={h}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          cornerRadius={isTable ? 4 : dark ? 1 : 6}
          dash={warn ? [6, 4] : el.kind === "dance-floor" || el.kind === "kids-zone" ? [10, 6] : undefined}
          opacity={def.overlay ? 0.92 : 1}
        />
      )}
      {el.kind === "dance-floor" && (
        <Rect x={8} y={8} width={w - 16} height={h - 16} cornerRadius={4} fill="#ede9fe" opacity={0.6} listening={false} />
      )}

      {isTable ? (
        <Text
          text={el.label}
          width={w}
          height={h}
          align="center"
          verticalAlign="middle"
          fontSize={clamp(minSide * 0.3, 9, 22)}
          fontStyle="bold"
          fill="#9a3412"
          fontFamily={font}
          listening={false}
        />
      ) : el.kind === "exit" || el.kind === "entry" ? (
        <Text
          text={el.kind === "exit" ? "EXIT" : (el.label || "ENTRY").toUpperCase()}
          width={w}
          height={h}
          align="center"
          verticalAlign="middle"
          fontSize={clamp(minSide * 0.45, 8, 13)}
          fontStyle="bold"
          fill="#ffffff"
          fontFamily={font}
          listening={false}
          wrap="none"
          ellipsis
        />
      ) : (
        !dark && (
          <>
            {def.emoji && (
              <Text
                text={def.emoji}
                width={w}
                y={minSide >= 50 ? h / 2 - clamp(minSide * 0.32, 10, 34) * 0.85 : 0}
                height={minSide >= 50 ? undefined : h}
                align="center"
                verticalAlign={minSide >= 50 ? "top" : "middle"}
                fontSize={clamp(minSide * 0.32, 10, 34)}
                listening={false}
              />
            )}
            {minSide >= 50 && (
              <Text
                text={el.label}
                x={4}
                width={w - 8}
                y={h / 2 + 4}
                align="center"
                fontSize={clamp(minSide * 0.12, 9, 15)}
                fontStyle="600"
                fill="#44403c"
                fontFamily={font}
                listening={false}
                wrap="none"
                ellipsis
              />
            )}
          </>
        )
      )}

      {seats.map((s, i) => {
        const p = local[i];
        const v = visuals?.[i];
        return (
          <Circle
            key={s.id}
            x={p.x * PX}
            y={p.y * PX}
            radius={0.85 * PX}
            fill={v?.fill ?? "#f5f5f4"}
            stroke={v?.stroke ?? "#a8a29e"}
            strokeWidth={1}
            perfectDrawEnabled={false}
            listening={seatsInteractive}
            onClick={(e) => {
              e.cancelBubble = true;
              if (v?.clickable !== false) api.seatClick(s);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (v?.clickable !== false) api.seatClick(s);
            }}
            onMouseEnter={(e) => {
              const c = e.target.getStage()?.container();
              if (c && v?.clickable !== false) c.style.cursor = "pointer";
              api.hover(v?.tooltip ?? s.label);
            }}
            onMouseLeave={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = "";
              api.hover(null);
            }}
          />
        );
      })}
    </Group>
  );
}
