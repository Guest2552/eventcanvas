import { type Draft, produce } from "immer";
import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import type { EventPlan, Layout } from "@/lib/types";

const isBrowser = () => typeof window !== "undefined" && typeof indexedDB !== "undefined";

type Persisted = { events: Record<string, EventPlan> };

/**
 * IndexedDB holds far more than localStorage's ~5 MB, which matters once guest lists grow.
 * Writes are batched: a drag or a burst of typing serialises the plan once, not on every change,
 * and anything pending is flushed when the tab is hidden or closed.
 */
export const SAVE_DEBOUNCE_MS = 400;
let pendingSave: { name: string; value: StorageValue<Persisted> } | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function flushSave() {
  clearTimeout(saveTimer);
  if (!pendingSave || !isBrowser()) return;
  const { name, value } = pendingSave;
  pendingSave = null;
  void idbSet(name, JSON.stringify(value));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushSave);
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushSave());
}

const idbStorage: PersistStorage<Persisted> = {
  getItem: async (name) => {
    if (!isBrowser()) return null;
    const raw = await idbGet<string>(name);
    return raw ? (JSON.parse(raw) as StorageValue<Persisted>) : null;
  },
  setItem: (name, value) => {
    pendingSave = { name, value };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  },
  removeItem: async (name) => {
    if (isBrowser()) await idbDel(name);
  },
};

type Recipe = (draft: Draft<EventPlan>) => void;

interface History {
  past: EventPlan[];
  future: EventPlan[];
}

interface StoreState {
  events: Record<string, EventPlan>;
  hydrated: boolean;
  history: Record<string, History>;
  addEvent: (ev: EventPlan) => void;
  removeEvent: (id: string) => void;
  /** Immutable update with undo history. `coalesce` merges rapid edits (typing) into one undo step. */
  update: (id: string, recipe: Recipe, opts?: { history?: boolean; coalesce?: string }) => void;
  undo: (id: string) => void;
  redo: (id: string) => void;
}

let lastKey = "";
let lastAt = 0;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      events: {},
      hydrated: false,
      history: {},
      // Creating or deleting a whole event is rare and important, so it is saved immediately
      addEvent: (ev) => {
        set((s) => ({ events: { ...s.events, [ev.id]: ev } }));
        flushSave();
      },
      removeEvent: (id) => {
        set((s) => {
          const events = { ...s.events };
          delete events[id];
          return { events };
        });
        flushSave();
      },
      update: (id, recipe, opts = {}) => {
        const s = get();
        const ev = s.events[id];
        if (!ev) return;
        const next = produce(ev, (d) => {
          recipe(d);
          d.updatedAt = new Date().toISOString();
        });
        const h = s.history[id] ?? { past: [], future: [] };
        const now = Date.now();
        const coalesced = !!opts.coalesce && opts.coalesce === lastKey && now - lastAt < 1200;
        lastKey = opts.coalesce ?? "";
        lastAt = now;
        const record = opts.history !== false && !coalesced;
        set({
          events: { ...s.events, [id]: next },
          history: { ...s.history, [id]: { past: record ? [...h.past.slice(-59), ev] : h.past, future: record ? [] : h.future } },
        });
      },
      undo: (id) => {
        const s = get();
        const h = s.history[id];
        const ev = s.events[id];
        if (!h?.past.length || !ev) return;
        const prev = h.past[h.past.length - 1];
        set({
          events: { ...s.events, [id]: prev },
          history: { ...s.history, [id]: { past: h.past.slice(0, -1), future: [ev, ...h.future] } },
        });
      },
      redo: (id) => {
        const s = get();
        const h = s.history[id];
        const ev = s.events[id];
        if (!h?.future.length || !ev) return;
        const [next, ...rest] = h.future;
        set({ events: { ...s.events, [id]: next }, history: { ...s.history, [id]: { past: [...h.past, ev], future: rest } } });
      },
    }),
    {
      name: "eventcanvas-v1",
      storage: idbStorage,
      partialize: (s): Persisted => ({ events: s.events }),
      skipHydration: true,
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export function useEventPlan(id: string | undefined): EventPlan | undefined {
  return useStore((s) => (id ? s.events[id] : undefined));
}

export function updateEvent(id: string, recipe: Recipe, opts?: { history?: boolean; coalesce?: string }) {
  useStore.getState().update(id, recipe, opts);
}

/** Like updateEvent, but hands back whatever the recipe returns (e.g. the element it created). */
export function updateEventAndReturn<T>(
  id: string,
  recipe: (d: Draft<EventPlan>) => T,
  opts?: { history?: boolean; coalesce?: string },
): T | undefined {
  let result: T | undefined;
  updateEvent(
    id,
    (d) => {
      result = recipe(d);
    },
    opts,
  );
  return result;
}

export function activeLayoutOf(ev: EventPlan): Layout {
  return ev.layouts.find((l) => l.id === ev.activeLayoutId) ?? ev.layouts[0];
}

/** Draft helper: returns the active layout inside an immer recipe. */
export function draftLayout(d: Draft<EventPlan>): Draft<Layout> {
  return d.layouts.find((l) => l.id === d.activeLayoutId) ?? d.layouts[0];
}

/**
 * Same-browser live sync: changes in one tab (e.g. an attendee booking a seat)
 * appear instantly in every other open tab via BroadcastChannel.
 */
export function startTabSync() {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel("eventcanvas-sync");
  let applyingRemote = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = useStore.subscribe((s, prev) => {
    if (applyingRemote || !s.hydrated || s.events === prev.events) return;
    clearTimeout(timer);
    timer = setTimeout(() => channel.postMessage({ type: "events", events: useStore.getState().events }), 100);
  });
  channel.onmessage = (e: MessageEvent) => {
    if (e.data?.type !== "events") return;
    applyingRemote = true;
    useStore.setState({ events: e.data.events });
    applyingRemote = false;
  };
  return () => {
    clearTimeout(timer);
    unsubscribe();
    channel.close();
  };
}
