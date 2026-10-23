"use client";

import { useEffect } from "react";
import { startTabSync, useStore } from "@/lib/store";

/** Loads saved events from IndexedDB and keeps open tabs in sync. */
export function StoreBootstrap() {
  useEffect(() => {
    useStore.persist.rehydrate();
    return startTabSync();
  }, []);
  return null;
}
