"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Shape, Stage, Text, Transformer } from "react-konva";
import { CATEGORY_STYLE, getDef } from "@/lib/catalog/elements";
import { localSeats, seatsForElement, type Box } from "@/lib/engine/geometry";
import type { PlacedElement, Zone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type BlueprintCanvasProps, PX } from "./types";

const half = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function BlueprintCanvas(props: BlueprintCanvasProps) {
  const { layout, mode, selectedId, onSelect, onElementChange, onZoneChange, onDropKind, seatVisual, onSeatClick, warnIds, focusIds, showGrid = true, snap = 0.5, showZones = true, zoneDraw, onZoneDrawn, controls, className } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const draftStart = useRef<{ x: number; y: number } | null>(null);
  const fittedKey = useRef("");
  const font = useMemo(() => (typeof window === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily || "sans-serif"), []);

  const W = layout.venue.widthFt * PX;
  const H = layout.venue.lengthFt * PX;
  const editing = mode === "edit";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const pad = 36;
    const s = clamp(Math.min((size.w - pad * 2) / W, (size.h - pad * 2) / H), 0.1, 4);
    setView({ scale: s, x: (size.w - W * s) / 2, y: (size.h - H * s) / 2 + 6 });
  }, [size, W, H]);

  useEffect(() => {
    const key = `${layout.id}:${W}:${H}:${Math.round(size.w / 40)}:${Math.round(size.h / 40)}`;
    if (size.w && fittedKey.current !== key) {
      fittedKey.current = key;
      fit();
    }
  }, [layout.id, W, H, size, fit]);

  const zoomBy = useCallback(
    (f: number, around?: { x: number; y: number }) => {
      setView((v) => {
        const s = clamp(v.scale * f, 0.1, 6);
        const p = around ?? { x: size.w / 2, y: size.h / 2 };
        const wx = (p.x - v.x) / v.scale;
        const wy = (p.y - v.y) / v.scale;
        return { scale: s, x: p.x - wx * s, y: p.y - wy * s };
      });
    },
    [size],
  );

  useImperativeHandle(
    controls,
    () => ({
      fit,
      zoomBy: (f) => zoomBy(f),
      toDataURL: () => stageRef.current?.toDataURL({ pixelRatio: 2 }),
      centerOn: (x, y) => setView((v) => ({ ...v, x: size.w / 2 - x * PX * v.scale, y: size.h / 2 - y * PX * v.scale })),
    }),
    [fit, zoomBy, size],
  );

  // Attach the transformer to the selected node
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId && editing ? nodes.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, editing, layout]);

  const selectedEl = layout.elements.find((e) => e.id === selectedId);
  const selectedZone = layout.zones.find((z) => z.id === selectedId);
  const keepRatio = !!(selectedEl && getDef(selectedEl.kind).keepRatio);

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = stageRef.current?.getPointerPosition();
    zoomBy(e.evt.deltaY > 0 ? 1 / 1.12 : 1.12, p ?? undefined);
  };

  const worldPointer = () => {
    const p = stageRef.current?.getRelativePointerPosition();
    return p ? { x: p.x / PX, y: p.y / PX } : null;
  };

  const onStageDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const target = e.target;
    const onEmpty = target === target.getStage() || target.name() === "floor";
    if (zoneDraw) {
      const p = worldPointer();
      if (p) {
        draftStart.current = p;
        setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
      }
      return;
    }
    if (onEmpty) onSelect?.(null);
  };

  const onStageMove = () => {
    if (!zoneDraw || !draftStart.current) return;
    const p = worldPointer();
    if (!p) return;
    const s = draftStart.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };

  const onStageUp = () => {
    if (!zoneDraw || !draftStart.current) return;
    draftStart.current = null;
    if (draft && draft.w > 2 && draft.h > 2) onZoneDrawn?.({ x: half(draft.x), y: half(draft.y), w: half(draft.w), h: half(draft.h) });
    setDraft(null);
  };

  const showTip = (text: string) => {
    const p = stageRef.current?.getPointerPosition();
    if (p) setTip({ x: p.x, y: p.y, text });
  };

  const registerNode = (id: string) => (n: Konva.Node | null) => {
    if (n) nodes.current.set(id, n);
    else nodes.current.delete(id);
  };

  const onElementDragEnd = (el: PlacedElement) => (e: KonvaEventObject<DragEvent>) => {
    const n = e.target;
    let x = n.x() / PX - el.w / 2;
    let y = n.y() / PX - el.h / 2;
    if (snap) {
      x = Math.round(x / snap) * snap;
      y = Math.round(y / snap) * snap;
    }
    n.position({ x: (x + el.w / 2) * PX, y: (y + el.h / 2) * PX });
    onElementChange?.(el.id, { x, y });
  };

  const onElementTransformEnd = (el: PlacedElement) => (e: KonvaEventObject<Event>) => {
    const n = e.target;
    const w = Math.max(1, half(el.w * n.scaleX()));
    const h = Math.max(1, half(el.h * n.scaleY()));
    n.scaleX(1);
    n.scaleY(1);
    const cx = n.x() / PX;
    const cy = n.y() / PX;
    onElementChange?.(el.id, { w, h, x: half(cx - w / 2), y: half(cy - h / 2), rotation: ((Math.round(n.rotation()) % 360) + 360) % 360 });
  };

  const onZoneTransformEnd = (z: Zone) => (e: KonvaEventObject<Event>) => {
    const n = e.target;
    const w = Math.max(2, half((z.w * PX * n.scaleX()) / PX));
    const h = Math.max(2, half((z.h * PX * n.scaleY()) / PX));
    n.scaleX(1);
    n.scaleY(1);
    onZoneChange?.(z.id, { x: half(n.x() / PX), y: half(n.y() / PX), w, h });
  };

  const gridMinor = useCallback(
    (ctx: Konva.Context, shape: Konva.Shape) => {
      ctx.beginPath();
      for (let x = 5; x < layout.venue.widthFt; x += 5) if (x % 10) (ctx.moveTo(x * PX, 0), ctx.lineTo(x * PX, H));
      for (let y = 5; y < layout.venue.lengthFt; y += 5) if (y % 10) (ctx.moveTo(0, y * PX), ctx.lineTo(W, y * PX));
      ctx.strokeShape(shape);
    },
    [layout.venue.widthFt, layout.venue.lengthFt, W, H],
  );
  const gridMajor = useCallback(
    (ctx: Konva.Context, shape: Konva.Shape) => {
      ctx.beginPath();
      for (let x = 10; x < layout.venue.widthFt; x += 10) (ctx.moveTo(x * PX, 0), ctx.lineTo(x * PX, H));
      for (let y = 10; y < layout.venue.lengthFt; y += 10) (ctx.moveTo(0, y * PX), ctx.lineTo(W, y * PX));
      ctx.strokeShape(shape);
    },
    [layout.venue.widthFt, layout.venue.lengthFt, W, H],
  );

  const sorted = useMemo(() => {
    const rank = (el: PlacedElement) => (getDef(el.kind).overlay ? 2 : el.kind === "dance-floor" || el.kind === "kids-zone" ? 0 : 1);
    return [...layout.elements].sort((a, b) => rank(a) - rank(b));
  }, [layout.elements]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden bg-[oklch(0.965_0.008_70)]", zoneDraw && "cursor-crosshair", className)}
      onDragOver={(e) => {
        if (onDropKind) e.preventDefault();
      }}
      onDrop={(e) => {
        const kind = e.dataTransfer.getData("application/x-element-kind");
        const stage = stageRef.current;
        if (!kind || !stage || !onDropKind) return;
        e.preventDefault();
        stage.setPointersPositions(e.nativeEvent);
        const p = stage.getRelativePointerPosition();
        if (p) onDropKind(kind, p.x / PX, p.y / PX);
      }}
    >
      {size.w > 0 && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable={!zoneDraw}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onWheel={onWheel}
          onMouseDown={onStageDown}
          onTouchStart={onStageDown}
          onMouseMove={onStageMove}
          onMouseUp={onStageUp}
          onTouchEnd={onStageUp}
        >
          <Layer>
            <Rect name="floor" x={0} y={0} width={W} height={H} fill="#ffffff" cornerRadius={6} shadowColor="#78350f" shadowBlur={24} shadowOpacity={0.1} shadowOffsetY={6} />
            {showGrid && <Shape sceneFunc={gridMinor} stroke="#f3eee8" strokeWidth={1} strokeScaleEnabled={false} listening={false} />}
            {showGrid && <Shape sceneFunc={gridMajor} stroke="#e8dfd5" strokeWidth={1} strokeScaleEnabled={false} listening={false} />}
            <Rect x={0} y={0} width={W} height={H} stroke="#a8a29e" strokeWidth={2} strokeScaleEnabled={false} cornerRadius={6} listening={false} />
            <Text x={0} y={-22} width={W} align="center" text={`${layout.venue.widthFt} ft`} fontSize={13} fill="#a8a29e" fontFamily={font} listening={false} />
            <Text x={-22} y={H} width={H} align="center" rotation={-90} text={`${layout.venue.lengthFt} ft`} fontSize={13} fill="#a8a29e" fontFamily={font} listening={false} />
          </Layer>

          {showZones && (
            <Layer>
              {layout.zones.map((z) => (
                <Group key={z.id}>
                  <Rect
                    ref={registerNode(z.id)}
                    x={z.x * PX}
                    y={z.y * PX}
                    width={z.w * PX}
                    height={z.h * PX}
                    fill={z.color}
                    opacity={selectedZone?.id === z.id ? 0.2 : 0.09}
                    stroke={z.color}
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    dash={[8, 5]}
                    cornerRadius={8}
                    listening={editing && !zoneDraw}
                    draggable={editing && selectedZone?.id === z.id}
                    onClick={() => onSelect?.(z.id, "zone")}
                    onTap={() => onSelect?.(z.id, "zone")}
                    onDragEnd={(e) => onZoneChange?.(z.id, { x: half(e.target.x() / PX), y: half(e.target.y() / PX) })}
                    onTransformEnd={onZoneTransformEnd(z)}
                  />
                  <Text x={z.x * PX + 6} y={z.y * PX + 5} text={z.name.toUpperCase()} fontSize={11} letterSpacing={1} fontStyle="bold" fill={z.color} fontFamily={font} listening={false} />
                </Group>
              ))}
            </Layer>
          )}

          <Layer>
            {sorted.map((el) => (
              <ElementNode
                key={el.id}
                el={el}
                font={font}
                mode={mode}
                selected={selectedId === el.id}
                warn={!!warnIds?.has(el.id)}
                focus={!!focusIds?.has(el.id)}
                registerRef={registerNode(el.id)}
                draggable={editing && !zoneDraw}
                listening={!zoneDraw}
                onSelect={() => onSelect?.(el.id, "element")}
                onDragEnd={onElementDragEnd(el)}
                onTransformEnd={onElementTransformEnd(el)}
                seatVisual={seatVisual}
                onSeatClick={onSeatClick}
                onSeatHover={(text) => (text ? showTip(text) : setTip(null))}
              />
            ))}
            {draft && <Rect x={draft.x * PX} y={draft.y * PX} width={draft.w * PX} height={draft.h * PX} fill="#e11d48" opacity={0.12} stroke="#e11d48" dash={[6, 4]} strokeScaleEnabled={false} />}
            {editing && (
              <Transformer
                ref={trRef}
                rotateEnabled={!!selectedEl}
                keepRatio={keepRatio}
                enabledAnchors={keepRatio ? ["top-left", "top-right", "bottom-left", "bottom-right"] : undefined}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                anchorSize={9}
                anchorCornerRadius={3}
                borderStroke="#e11d48"
                anchorStroke="#e11d48"
                ignoreStroke
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
              />
            )}
          </Layer>
        </Stage>
      )}
      {tip && (
        <div className="pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg" style={{ left: tip.x, top: tip.y - 10 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

interface ElementNodeProps {
  el: PlacedElement;
  font: string;
  mode: BlueprintCanvasProps["mode"];
  selected: boolean;
  warn: boolean;
  focus: boolean;
  draggable: boolean;
  listening: boolean;
  registerRef: (n: Konva.Node | null) => void;
  onSelect: () => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: KonvaEventObject<Event>) => void;
  seatVisual?: BlueprintCanvasProps["seatVisual"];
  onSeatClick?: BlueprintCanvasProps["onSeatClick"];
  onSeatHover: (text: string | null) => void;
}

function ElementNode({ el, font, mode, selected, warn, focus, draggable, listening, registerRef, onSelect, onDragEnd, onTransformEnd, seatVisual, onSeatClick, onSeatHover }: ElementNodeProps) {
  const def = getDef(el.kind);
  const style = CATEGORY_STYLE[def.category];
  const w = el.w * PX;
  const h = el.h * PX;
  const seats = useMemo(() => (def.category === "seating" ? seatsForElement(el) : []), [el, def.category]);
  const local = useMemo(() => localSeats(el.kind, el.w, el.h), [el.kind, el.w, el.h]);
  const isTable = def.category === "seating";
  const dark = el.kind === "pillar" || el.kind === "wall";
  const fill = el.kind === "exit" ? "#16a34a" : el.kind === "entry" ? "#0ea5e9" : dark ? "#57534e" : style.fill;
  const stroke = warn ? "#dc2626" : focus ? "#e11d48" : selected ? "#e11d48" : el.kind === "exit" ? "#15803d" : el.kind === "entry" ? "#0369a1" : dark ? "#44403c" : style.stroke;
  const strokeWidth = warn || focus || selected ? 3 : 1.5;
  const minSide = Math.min(w, h);
  const seatsInteractive = mode === "seats" && !!onSeatClick;

  return (
    <Group
      ref={registerRef}
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
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
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
      {el.kind === "dance-floor" && <Rect x={8} y={8} width={w - 16} height={h - 16} cornerRadius={4} fill="#ede9fe" opacity={0.6} listening={false} />}

      {isTable ? (
        <Text text={el.label} width={w} height={h} align="center" verticalAlign="middle" fontSize={clamp(minSide * 0.3, 9, 22)} fontStyle="bold" fill="#9a3412" fontFamily={font} listening={false} />
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
              <Text text={def.emoji} width={w} y={minSide >= 50 ? h / 2 - clamp(minSide * 0.32, 10, 34) * 0.85 : 0} height={minSide >= 50 ? undefined : h} align="center" verticalAlign={minSide >= 50 ? "top" : "middle"} fontSize={clamp(minSide * 0.32, 10, 34)} listening={false} />
            )}
            {minSide >= 50 && (
              <Text text={el.label} x={4} width={w - 8} y={h / 2 + 4} align="center" fontSize={clamp(minSide * 0.12, 9, 15)} fontStyle="600" fill="#44403c" fontFamily={font} listening={false} wrap="none" ellipsis />
            )}
          </>
        )
      )}

      {seats.map((s, i) => {
        const p = local[i];
        const v = seatVisual?.(s);
        return (
          <Circle
            key={s.id}
            x={p.x * PX}
            y={p.y * PX}
            radius={0.85 * PX}
            fill={v?.fill ?? "#f5f5f4"}
            stroke={v?.stroke ?? "#a8a29e"}
            strokeWidth={1}
            listening={seatsInteractive}
            onClick={(e) => {
              e.cancelBubble = true;
              if (v?.clickable !== false) onSeatClick?.(s);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (v?.clickable !== false) onSeatClick?.(s);
            }}
            onMouseEnter={(e) => {
              const c = e.target.getStage()?.container();
              if (c && v?.clickable !== false) c.style.cursor = "pointer";
              onSeatHover(v?.tooltip ?? s.label);
            }}
            onMouseLeave={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = "";
              onSeatHover(null);
            }}
          />
        );
      })}
    </Group>
  );
}
