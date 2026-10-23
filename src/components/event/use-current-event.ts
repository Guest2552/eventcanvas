"use client";

import { useParams } from "next/navigation";
import { useCallback } from "react";
import { activeLayoutOf, updateEvent, useEventPlan } from "@/lib/store";
import type { EventPlan } from "@/lib/types";

type Recipe = Parameters<typeof updateEvent>[1];

export function useCurrentEvent() {
  const { id } = useParams<{ id: string }>();
  const ev = useEventPlan(id) as EventPlan;
  const update = useCallback((recipe: Recipe, opts?: { history?: boolean; coalesce?: string }) => updateEvent(id, recipe, opts), [id]);
  return { id, ev, layout: ev ? activeLayoutOf(ev) : undefined!, update };
}
