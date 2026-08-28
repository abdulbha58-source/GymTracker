"use client";

// A simple offline cache + write queue so the user can keep logging workouts
// at the gym even if the network drops. Data is keyed by request URL; writes
// are queued and replayed when the app comes back online.

export type CachedEntry<T> = {
  data: T;
  savedAt: number;
};

const CACHE_PREFIX = "gym-cache:";
const QUEUE_KEY = "gym-queue";
const SESSION_KEY = "gym-active-session";
const DRAFT_KEY = "gym-drafts";
const DRAFT_PREFIX = "gym-draft:";

type QueueItem = {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "DELETE" | "PUT";
  body: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isClient(): boolean {
  return typeof window !== "undefined";
}

export function readCache<T>(key: string): T | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<T>;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  const s = safeStorage();
  if (!s) return;
  try {
    const entry: CachedEntry<T> = { data, savedAt: Date.now() };
    s.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota errors are non-fatal
  }
}

export function clearCache(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    // ignore
  }
}

function readQueue(): QueueItem[] {
  const s = safeStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function enqueueWrite(
  item: Omit<QueueItem, "id" | "createdAt" | "attempts">,
): void {
  const queue = readQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
    ...item,
  });
  writeQueue(queue);
}

export function getQueueLength(): number {
  return readQueue().length;
}

export async function flushQueue(): Promise<{
  flushed: number;
  remaining: number;
  errors: string[];
}> {
  if (!isClient()) return { flushed: 0, remaining: 0, errors: [] };
  if (!navigator.onLine) {
    return { flushed: 0, remaining: getQueueLength(), errors: ["offline"] };
  }
  const queue = readQueue();
  if (queue.length === 0) {
    return { flushed: 0, remaining: 0, errors: [] };
  }
  const remaining: QueueItem[] = [];
  const errors: string[] = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { "content-type": "application/json" },
        body: item.body === undefined ? undefined : JSON.stringify(item.body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        item.attempts += 1;
        item.lastError = `${res.status} ${txt.slice(0, 120)}`;
        if (item.attempts < 6) remaining.push(item);
        else errors.push(item.lastError);
      } else {
        flushed += 1;
      }
    } catch (e) {
      item.attempts += 1;
      item.lastError = e instanceof Error ? e.message : String(e);
      if (item.attempts < 6) remaining.push(item);
      else errors.push(item.lastError ?? "unknown");
    }
  }
  writeQueue(remaining);
  return { flushed, remaining: remaining.length, errors };
}

export type ActiveSession = {
  id: number;
  workoutDayId: number;
  workoutDayName: string;
  startedAt: number; // ms epoch
};

export function readActiveSession(): ActiveSession | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveSession;
  } catch {
    return null;
  }
}

export function writeActiveSession(sess: ActiveSession | null): void {
  const s = safeStorage();
  if (!s) return;
  try {
    if (sess === null) s.removeItem(SESSION_KEY);
    else s.setItem(SESSION_KEY, JSON.stringify(sess));
  } catch {
    // ignore
  }
}

export function clearActiveSession(): void {
  writeActiveSession(null);
}

// Per-exercise draft (current sets being typed) so we don't lose work on refresh
export type DraftSetsPayload = {
  workoutDayId: number;
  workoutSessionId?: number; // may not exist yet for a brand new session
  sets: Array<{ setNumber: number; weight: number; reps: number }>;
  updatedAt: number;
};

export function readDraft(workoutDayId: number, exerciseId: number): DraftSetsPayload | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(DRAFT_PREFIX + `${workoutDayId}:${exerciseId}`);
    if (!raw) return null;
    return JSON.parse(raw) as DraftSetsPayload;
  } catch {
    return null;
  }
}

export function writeDraft(
  workoutDayId: number,
  exerciseId: number,
  payload: DraftSetsPayload,
): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(
      DRAFT_PREFIX + `${workoutDayId}:${exerciseId}`,
      JSON.stringify(payload),
    );
  } catch {
    // ignore
  }
}

export function clearDraft(workoutDayId: number, exerciseId: number): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(DRAFT_PREFIX + `${workoutDayId}:${exerciseId}`);
  } catch {
    // ignore
  }
}

export function readAllDrafts(): Record<string, DraftSetsPayload> {
  const s = safeStorage();
  if (!s) return {};
  const out: Record<string, DraftSetsPayload> = {};
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) {
        const raw = s.getItem(k);
        if (!raw) continue;
        const payload = JSON.parse(raw) as DraftSetsPayload;
        out[k.slice(DRAFT_PREFIX.length)] = payload;
      }
    }
  } catch {
    // ignore
  }
  return out;
}

export function clearAllDrafts(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    // ignore
  }
}
