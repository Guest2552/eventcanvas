"use client";

import { Columns2, Copy, Grid3x3, Maximize, Plus, Square, Trash2, Wand2, ZoomIn, ZoomOut } from "lucide-react";
import { nanoid } from "nanoid";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BlueprintCanvas, type CanvasControls } from "@/components/blueprint/canvas";
import { ElementLibrary } from "@/components/blueprint/element-library";
import { ElementInspector, LayoutOverview, ZoneInspector } from "@/components/blueprint/inspector";
import { CompareDialog, GenerateLayoutDialog } from "@/components/blueprint/layout-dialogs";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addElement, addZone, duplicateElement, removeElements } from "@/lib/actions";
import { getDef } from "@/lib/catalog/elements";
import { aabb, center } from "@/lib/engine/geometry";
import { vendorChecklist } from "@/lib/engine/planning";
import { issueElements, type Issue, validateLayout } from "@/lib/engine/validation";
import { draftLayout, updateEventAndReturn, useStore } from "@/lib/store";
import { useStudioShortcuts } from "@/components/blueprint/use-studio-shortcuts";
import type { PlacedElement, Zone } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function BlueprintPage() {
  const { ev, layout, update } = useCurrentEvent();
  const [selected, setSelected] = useState<string | null>(null);
  const [zoneDraw, setZoneDraw] = useState(false);
  const [grid, setGrid] = useState(true);
  const [genOpen, setGenOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const controls = useRef<CanvasControls | null>(null);

  const validation = useMemo(() => (ev ? validateLayout(ev, layout) : null), [ev, layout]);
  const checklist = useMemo(() => (ev ? vendorChecklist(ev, layout) : []), [ev, layout]);
  const warnIds = useMemo(() => issueElements((validation?.issues ?? []).filter((i) => i.severity !== "info")), [validation]);
  const selectedEl = layout?.elements.find((e) => e.id === selected);
  const selectedZone = layout?.zones.find((z) => z.id === selected);

  const patchElement = (id: string, patch: Partial<PlacedElement>, coalesce?: string) =>
    update(
      (d) => {
        const el = draftLayout(d).elements.find((e) => e.id === id);
        if (el) Object.assign(el, patch);
      },
      coalesce ? { coalesce } : undefined,
    );
  const patchZone = (id: string, patch: Partial<Zone>, coalesce?: string) =>
    update(
      (d) => {
        const z = draftLayout(d).zones.find((x) => x.id === id);
        if (z) Object.assign(z, patch);
      },
      coalesce ? { coalesce } : undefined,
    );

  const add = (kind: string, x?: number, y?: number) => {
    const created = updateEventAndReturn(ev.id, (d) => addElement(d, kind, { x, y }));
    if (created) setSelected(created.id);
    else toast.error(`No free space for a ${getDef(kind).label.toLowerCase()}. Try a bigger venue or remove something.`);
  };

  const deleteSelected = () => {
    if (selectedEl) {
      const seated = ev.guests.filter((g) => g.seatId?.startsWith(`${selectedEl.id}:`)).length;
      update((d) => removeElements(d, [selectedEl.id]));
      toast(`Removed ${selectedEl.label}${seated ? `. ${seated} guests now need seats` : ""}`, {
        action: { label: "Undo", onClick: () => undo() },
      });
    } else if (selectedZone) {
      update((d) => {
        const l = draftLayout(d);
        l.zones = l.zones.filter((z) => z.id !== selectedZone.id);
      });
    }
    setSelected(null);
  };

  const undo = () => useStore.getState().undo(ev.id);

  const duplicate = (el: PlacedElement) => {
    const copy = updateEventAndReturn(ev.id, (d) => duplicateElement(d, el.id));
    if (copy) setSelected(copy.id);
  };

  useStudioShortcuts({
    hasSelection: !!(selectedEl || selectedZone),
    selectedElement: selectedEl,
    onEscape: () => {
      setSelected(null);
      setZoneDraw(false);
    },
    onDelete: deleteSelected,
    onDuplicate: duplicate,
    onRotate: (el) => patchElement(el.id, { rotation: (el.rotation + 90) % 360 }),
    onNudge: (el, dx, dy) => patchElement(el.id, { x: el.x + dx, y: el.y + dy }, `nudge-${el.id}`),
  });

  if (!ev || !validation) return null;

  const focusIssue = (issue: Issue) => {
    const first = layout.elements.find((e) => issue.elementIds.includes(e.id));
    if (first) {
      setSelected(first.id);
      const c = center(aabb(first));
      controls.current?.centerOn(c.x, c.y);
    }
  };

  const setActive = (id: string) => {
    update((d) => void (d.activeLayoutId = id), { history: false });
    setSelected(null);
  };

  const duplicateLayout = () => {
    const id = nanoid(8);
    update((d) => {
      const src = draftLayout(d);
      d.layouts.push({ ...JSON.parse(JSON.stringify(src)), id, name: `${src.name} (copy)` });
      d.activeLayoutId = id;
    });
    toast.success("Duplicated. Edit freely and compare versions side by side.");
  };

  const deleteLayout = () => {
    if (ev.layouts.length < 2) return;
    if (!confirm(`Delete "${layout.name}"?`)) return;
    update((d) => {
      d.layouts = d.layouts.filter((l) => l.id !== layout.id);
      d.activeLayoutId = d.layouts[0].id;
    });
  };

  return (
    <div className="flex h-full min-h-[600px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <div className="flex min-w-0 flex-1 scrollbar-thin items-center gap-1 overflow-x-auto">
          {ev.layouts.map((l) => (
            <button
              key={l.id}
              onClick={() => setActive(l.id)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition",
                l.id === ev.activeLayoutId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {l.name}
            </button>
          ))}
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={duplicateLayout} aria-label="Duplicate version" />}>
              <Copy />
            </TooltipTrigger>
            <TooltipContent>Duplicate this version</TooltipContent>
          </Tooltip>
          {ev.layouts.length > 1 && (
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={deleteLayout} aria-label="Delete version" />}>
                <Trash2 />
              </TooltipTrigger>
              <TooltipContent>Delete this version</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" className="gap-1.5" onClick={() => setGenOpen(true)}>
            <Wand2 className="size-3.5" /> Auto-layout
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCompareOpen(true)}>
            <Columns2 className="size-3.5" /> Compare
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant={zoneDraw ? "default" : "outline"}
                  onClick={() => setZoneDraw((z) => !z)}
                  aria-label="Draw zone"
                  aria-pressed={zoneDraw}
                />
              }
            >
              <Square />
            </TooltipTrigger>
            <TooltipContent>{zoneDraw ? "Drag on the floor to draw a zone (Esc to cancel)" : "Draw a zone"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant={grid ? "secondary" : "outline"}
                  onClick={() => setGrid((g) => !g)}
                  aria-label="Toggle grid"
                  aria-pressed={grid}
                />
              }
            >
              <Grid3x3 />
            </TooltipTrigger>
            <TooltipContent>Grid (5 ft squares)</TooltipContent>
          </Tooltip>
          <Button size="icon-sm" variant="outline" onClick={() => controls.current?.zoomBy(1 / 1.25)} aria-label="Zoom out">
            <ZoomOut />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => controls.current?.fit()} aria-label="Fit to screen">
            <Maximize />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => controls.current?.zoomBy(1.25)} aria-label="Zoom in">
            <ZoomIn />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="max-h-56 shrink-0 border-b bg-card lg:max-h-none lg:w-56 lg:border-r lg:border-b-0">
          <ElementLibrary city={ev.city} onAdd={(k) => add(k)} />
        </aside>
        <section className="relative min-h-[420px] flex-1">
          <BlueprintCanvas
            layout={layout}
            mode="edit"
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            onElementChange={(id, patch) => patchElement(id, patch)}
            onZoneChange={(id, patch) => patchZone(id, patch)}
            onDropKind={(kind, x, y) => add(kind, x, y)}
            warnIds={warnIds}
            showGrid={grid}
            zoneDraw={zoneDraw}
            onZoneDrawn={(box) => {
              let id = "";
              update((d) => {
                id = addZone(d, box).id;
              });
              setZoneDraw(false);
              setSelected(id);
            }}
            controls={controls}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-md bg-card/90 px-2 py-1 shadow-sm">Scroll to zoom · drag empty space to pan</span>
            {warnIds.size > 0 && (
              <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive shadow-sm">Red dashed = needs attention</span>
            )}
          </div>
          {layout.elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl border bg-card p-5 text-center shadow-lg">
                <p className="font-semibold">Empty venue</p>
                <p className="mb-3 text-sm text-muted-foreground">Drag items from the left or let auto-layout fill it.</p>
                <Button size="sm" className="gap-1.5" onClick={() => setGenOpen(true)}>
                  <Plus className="size-3.5" /> Auto-layout
                </Button>
              </div>
            </div>
          )}
        </section>
        <aside className="shrink-0 scrollbar-thin overflow-y-auto border-t bg-card lg:w-80 lg:border-t-0 lg:border-l">
          {selectedEl ? (
            <ElementInspector
              ev={ev}
              layout={layout}
              el={selectedEl}
              onChange={(patch, field) => patchElement(selectedEl.id, patch, `${selectedEl.id}-${field}`)}
              onDuplicate={() => {
                duplicate(selectedEl);
              }}
              onDelete={deleteSelected}
            />
          ) : selectedZone ? (
            <ZoneInspector
              zone={selectedZone}
              onChange={(patch, field) => patchZone(selectedZone.id, patch, `${selectedZone.id}-${field}`)}
              onDelete={deleteSelected}
            />
          ) : (
            <LayoutOverview
              ev={ev}
              layout={layout}
              validation={validation}
              checklist={checklist}
              onIssueClick={focusIssue}
              onSelectItem={setSelected}
              onRename={(name) => update((d) => void (draftLayout(d).name = name), { coalesce: `rename-${layout.id}` })}
              onVenueChange={(patch, field) =>
                update((d) => void Object.assign(draftLayout(d).venue, patch), { coalesce: `venue-${field}` })
              }
            />
          )}
        </aside>
      </div>

      <GenerateLayoutDialog
        key={genOpen ? "open" : "closed"}
        ev={ev}
        open={genOpen}
        onOpenChange={setGenOpen}
        onGenerate={(l, replace) => {
          update((d) => {
            if (replace) {
              const i = d.layouts.findIndex((x) => x.id === l.id);
              d.layouts[i] = l;
            } else {
              d.layouts.push(l);
              d.activeLayoutId = l.id;
            }
          });
          setSelected(null);
          toast.success(
            replace
              ? "Layout regenerated. Re-run auto-seating on the Guests page."
              : `Created "${l.name}". Compare it with your other versions.`,
          );
        }}
      />
      <CompareDialog ev={ev} open={compareOpen} onOpenChange={setCompareOpen} onActivate={(id) => (setActive(id), setCompareOpen(false))} />
    </div>
  );
}
