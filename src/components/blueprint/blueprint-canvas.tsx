"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Rect, Shape, Stage, Text, Transformer } from "react-konva";
import { getDef, seatCount } from "@/lib/catalog/elements";
import { type Box, seatsForElement } from "@/lib/engine/geometry";
import { clamp, roundHalf } from "@/lib/math";
import type { PlacedElement, Zone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ElementNode, type ItemApi } from "./element-node";
import { type BlueprintCanvasProps, PX } from "./types";

export default function BlueprintCanvas(props: BlueprintCanvasProps) {
  const {
    layout,
    mode,
    selectedId,
    onSelect,
    onElementChange,
    onZoneChange,
    onDropKind,
    seatVisual,
    onSeatClick,
    warnIds,
    focusIds,
    showGrid = true,
    snap = 0.5,
    showZones = true,
    zoneDraw,
    onZoneDrawn,
    controls,
    className,
  } = props;
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
  const font = useMemo(
    () => (typeof window === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily || "sans-serif"),
    [],
  );

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
    if (draft && draft.w > 2 && draft.h > 2)
      onZoneDrawn?.({ x: roundHalf(draft.x), y: roundHalf(draft.y), w: roundHalf(draft.w), h: roundHalf(draft.h) });
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
    const w = Math.max(1, roundHalf(el.w * n.scaleX()));
    const h = Math.max(1, roundHalf(el.h * n.scaleY()));
    n.scaleX(1);
    n.scaleY(1);
    const cx = n.x() / PX;
    const cy = n.y() / PX;
    onElementChange?.(el.id, {
      w,
      h,
      x: roundHalf(cx - w / 2),
      y: roundHalf(cy - h / 2),
      rotation: ((Math.round(n.rotation()) % 360) + 360) % 360,
    });
  };

  // Items are memoised; they get stable callbacks that always reach the latest handlers,
  // so editing one table re-renders that table instead of every table and seat.
  const latest = useRef({ onSelect, onSeatClick, onElementDragEnd, onElementTransformEnd, showTip });
  useLayoutEffect(() => {
    latest.current = { onSelect, onSeatClick, onElementDragEnd, onElementTransformEnd, showTip };
  });
  const itemApi = useMemo<ItemApi>(
    () => ({
      register: (id, n) => {
        if (n) nodes.current.set(id, n);
        else nodes.current.delete(id);
      },
      select: (id) => latest.current.onSelect?.(id, "element"),
      dragEnd: (el, e) => latest.current.onElementDragEnd(el)(e),
      transformEnd: (el, e) => latest.current.onElementTransformEnd(el)(e),
      seatClick: (s) => latest.current.onSeatClick?.(s),
      hover: (text) => (text ? latest.current.showTip(text) : setTip(null)),
    }),
    [],
  );

  const onZoneTransformEnd = (z: Zone) => (e: KonvaEventObject<Event>) => {
    const n = e.target;
    const w = Math.max(2, roundHalf((z.w * PX * n.scaleX()) / PX));
    const h = Math.max(2, roundHalf((z.h * PX * n.scaleY()) / PX));
    n.scaleX(1);
    n.scaleY(1);
    onZoneChange?.(z.id, { x: roundHalf(n.x() / PX), y: roundHalf(n.y() / PX), w, h });
  };

  /** Grid lines every `step` ft; the minor grid skips lines the major grid draws. */
  const gridDrawer = useCallback(
    (step: number, skipEvery?: number) => (ctx: Konva.Context, shape: Konva.Shape) => {
      const draw = (v: number) => !skipEvery || v % skipEvery !== 0;
      ctx.beginPath();
      for (let x = step; x < layout.venue.widthFt; x += step) {
        if (!draw(x)) continue;
        ctx.moveTo(x * PX, 0);
        ctx.lineTo(x * PX, H);
      }
      for (let y = step; y < layout.venue.lengthFt; y += step) {
        if (!draw(y)) continue;
        ctx.moveTo(0, y * PX);
        ctx.lineTo(W, y * PX);
      }
      ctx.strokeShape(shape);
    },
    [layout.venue.widthFt, layout.venue.lengthFt, W, H],
  );
  const gridMinor = useMemo(() => gridDrawer(5, 10), [gridDrawer]);
  const gridMajor = useMemo(() => gridDrawer(10), [gridDrawer]);

  const sorted = useMemo(() => {
    const rank = (el: PlacedElement) => (getDef(el.kind).overlay ? 2 : el.kind === "dance-floor" || el.kind === "kids-zone" ? 0 : 1);
    return [...layout.elements].sort((a, b) => rank(a) - rank(b));
  }, [layout.elements]);

  const tableCount = layout.elements.filter((e) => getDef(e.kind).category === "seating").length;
  const seatTotal = layout.elements.reduce((n, e) => n + seatCount(e.kind, e.w), 0);
  const otherCount = layout.elements.length - tableCount;
  const { venue } = layout;
  const summary = `${venue.name} blueprint, ${venue.widthFt} by ${venue.lengthFt} feet, ${tableCount} tables with ${seatTotal} seats and ${otherCount} other items.`;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-roledescription="venue blueprint"
      aria-label={summary}
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
            <Rect
              name="floor"
              x={0}
              y={0}
              width={W}
              height={H}
              fill="#ffffff"
              cornerRadius={6}
              shadowColor="#78350f"
              shadowBlur={24}
              shadowOpacity={0.1}
              shadowOffsetY={6}
            />
            {showGrid && <Shape sceneFunc={gridMinor} stroke="#f3eee8" strokeWidth={1} strokeScaleEnabled={false} listening={false} />}
            {showGrid && <Shape sceneFunc={gridMajor} stroke="#e8dfd5" strokeWidth={1} strokeScaleEnabled={false} listening={false} />}
            <Rect
              x={0}
              y={0}
              width={W}
              height={H}
              stroke="#a8a29e"
              strokeWidth={2}
              strokeScaleEnabled={false}
              cornerRadius={6}
              listening={false}
            />
            <Text
              x={0}
              y={-22}
              width={W}
              align="center"
              text={`${layout.venue.widthFt} ft`}
              fontSize={13}
              fill="#a8a29e"
              fontFamily={font}
              listening={false}
            />
            <Text
              x={-22}
              y={H}
              width={H}
              align="center"
              rotation={-90}
              text={`${layout.venue.lengthFt} ft`}
              fontSize={13}
              fill="#a8a29e"
              fontFamily={font}
              listening={false}
            />
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
                    onDragEnd={(e) => onZoneChange?.(z.id, { x: roundHalf(e.target.x() / PX), y: roundHalf(e.target.y() / PX) })}
                    onTransformEnd={onZoneTransformEnd(z)}
                  />
                  <Text
                    x={z.x * PX + 6}
                    y={z.y * PX + 5}
                    text={z.name.toUpperCase()}
                    fontSize={11}
                    letterSpacing={1}
                    fontStyle="bold"
                    fill={z.color}
                    fontFamily={font}
                    listening={false}
                  />
                </Group>
              ))}
            </Layer>
          )}

          <Layer>
            {sorted.map((el) => {
              const visuals = seatVisual && getDef(el.kind).category === "seating" ? seatsForElement(el).map(seatVisual) : undefined;
              return (
                <ElementNode
                  key={el.id}
                  el={el}
                  font={font}
                  selected={selectedId === el.id}
                  warn={!!warnIds?.has(el.id)}
                  focus={!!focusIds?.has(el.id)}
                  draggable={editing && !zoneDraw}
                  listening={!zoneDraw}
                  seatsClickable={mode === "seats" && !!onSeatClick}
                  visuals={visuals}
                  seatKey={
                    visuals ? visuals.map((v) => `${v.fill}${v.stroke}${v.clickable === false ? 0 : 1}${v.tooltip ?? ""}`).join("|") : ""
                  }
                  api={itemApi}
                />
              );
            })}
            {draft && (
              <Rect
                x={draft.x * PX}
                y={draft.y * PX}
                width={draft.w * PX}
                height={draft.h * PX}
                fill="#e11d48"
                opacity={0.12}
                stroke="#e11d48"
                dash={[6, 4]}
                strokeScaleEnabled={false}
              />
            )}
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
      {/* Text alternative for screen readers: the canvas itself is purely visual */}
      <ul className="sr-only">
        {layout.zones.map((z) => (
          <li key={z.id}>Zone: {z.name}</li>
        ))}
        {layout.elements.map((el) => {
          const seats = seatCount(el.kind, el.w);
          return (
            <li key={el.id}>
              {el.label} ({getDef(el.kind).label}){seats ? `, ${seats} seats` : ""}, at {Math.round(el.x)} by {Math.round(el.y)} feet
            </li>
          );
        })}
      </ul>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg"
          style={{ left: tip.x, top: tip.y - 10 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
