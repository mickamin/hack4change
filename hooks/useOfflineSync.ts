"use client";

import { useState, useEffect, useCallback } from "react";
import type { Farmer } from "@/app/api/data/mockData";
import type { SubmittedEntry } from "@/components/FarmerInputForm";

// ── Queue keys ────────────────────────────────────────────────────────────────
// FORM_QUEUE  written by FarmerInputForm with full SubmittedEntry shape
//             → synced to Supabase via POST /api/requests
// FARMER_QUEUE (legacy) written by the old inline register block
//             → synced to the mock route optimizer via POST /api/optimize-route
const FORM_QUEUE_KEY   = "agropool_pending_requests";
const FARMER_QUEUE_KEY = "agropool_offline_queue";

export interface PendingRegistration {
  id: string;
  farmer: Farmer;
  queuedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadFormQueue(): SubmittedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FORM_QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveFormQueue(queue: SubmittedEntry[]) {
  localStorage.setItem(FORM_QUEUE_KEY, JSON.stringify(queue));
}

function loadFarmerQueue(): PendingRegistration[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FARMER_QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveFarmerQueue(queue: PendingRegistration[]) {
  localStorage.setItem(FARMER_QUEUE_KEY, JSON.stringify(queue));
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useOfflineSync() {
  const [isOnline, setIsOnline]         = useState(true);
  const [pendingQueue, setPendingQueue] = useState<PendingRegistration[]>([]);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError]       = useState<string | null>(null);

  // ── Sync form queue → Supabase via /api/requests ──────────────────────────
  const syncFormQueue = useCallback(async () => {
    const queue = loadFormQueue();
    if (queue.length === 0 || !navigator.onLine) return;

    const failed: SubmittedEntry[] = [];

    for (const entry of queue) {
      try {
        const res = await fetch("/api/requests", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(entry),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.warn("[sync] /api/requests returned", res.status, body);
          failed.push({ ...entry, status: "offline_pending" });
        }
        // on 200 we intentionally do NOT re-queue
      } catch (err) {
        console.warn("[sync] network error, will retry:", err);
        failed.push(entry);
      }
    }

    saveFormQueue(failed);
  }, []);

  // ── Sync legacy farmer queue → route optimizer ────────────────────────────
  const syncFarmerQueue = useCallback(async () => {
    const queue = loadFarmerQueue();
    if (queue.length === 0 || !navigator.onLine) return;

    const failed: PendingRegistration[] = [];

    for (const item of queue) {
      try {
        const res = await fetch("/api/optimize-route", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(item.farmer),
        });
        if (!res.ok) throw new Error("sync failed");
      } catch {
        failed.push(item);
      }
    }

    saveFarmerQueue(failed);
    setPendingQueue(failed);
  }, []);

  // ── Combined sync ─────────────────────────────────────────────────────────
  const syncAll = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await Promise.all([syncFormQueue(), syncFarmerQueue()]);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Błąd synchronizacji.");
    } finally {
      setIsSyncing(false);
    }
  }, [syncFormQueue, syncFarmerQueue]);

  // ── Online / offline listeners ────────────────────────────────────────────
  useEffect(() => {
    setIsOnline(navigator.onLine);
    setPendingQueue(loadFarmerQueue());

    const handleOnline  = () => { setIsOnline(true);  syncAll(); };
    const handleOffline = () =>   setIsOnline(false);

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncAll]);

  // ── enqueue: add a farmer to the legacy queue + attempt immediate sync ────
  const enqueue = useCallback((farmer: Farmer) => {
    const item: PendingRegistration = {
      id:        crypto.randomUUID(),
      farmer,
      queuedAt:  new Date().toISOString(),
    };

    const queue = loadFarmerQueue();
    queue.push(item);
    saveFarmerQueue(queue);
    setPendingQueue([...queue]);

    if (navigator.onLine) syncAll();
  }, [syncAll]);

  // ── Pending count combines both queues for the UI badge ──────────────────
  const formQueueLength = typeof window !== "undefined"
    ? loadFormQueue().filter((e) => e.status === "offline_pending").length
    : 0;

  const totalPending = pendingQueue.length + formQueueLength;

  return {
    isOnline,
    pendingQueue,
    totalPending,
    isSyncing,
    lastSyncedAt,
    syncError,
    enqueue,
    syncAll,
  };
}
