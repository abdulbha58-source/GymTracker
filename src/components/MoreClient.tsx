"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { Input, Textarea } from "@/components/Field";
import EmptyState from "@/components/EmptyState";
import { clearCache, flushQueue, getQueueLength } from "@/lib/offline";
type Day = {
  id: number;
  name: string;
  description: string | null;
  position: number;
  exerciseCount: number;
  sessionCount: number;
  lastTrainedAt: string | null;
};

type Exercise = {
  id: number;
  workoutDayId: number;
  name: string;
  notes: string | null;
  targetSets: number | null;
  targetReps: number | null;
  position: number;
};

export default function MoreClient() {
  const router = useRouter();
  const [tab, setTab] = useState<"days" | "exercises">("days");
  const [days, setDays] = useState<Day[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // New day form
  const [newDayOpen, setNewDayOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New exercise form
  const [newExOpen, setNewExOpen] = useState(false);
  const [exName, setExName] = useState("");
  const [exNotes, setExNotes] = useState("");
  const [exSets, setExSets] = useState("");
  const [exReps, setExReps] = useState("");
  const [exDayId, setExDayId] = useState<number | null>(null);

  // Edit states
  const [editDay, setEditDay] = useState<Day | null>(null);
  const [editDayName, setEditDayName] = useState("");
  const [editDayDesc, setEditDayDesc] = useState("");

  const [editEx, setEditEx] = useState<Exercise | null>(null);
  const [editExName, setEditExName] = useState("");
  const [editExNotes, setEditExNotes] = useState("");
  const [editExSets, setEditExSets] = useState("");
  const [editExReps, setEditExReps] = useState("");

  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "day"; id: number; name: string }
    | { kind: "exercise"; id: number; name: string }
    | null
  >(null);

  const [queue, setQueue] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, ex] = await Promise.all([
        fetch("/api/workout-days", { cache: "no-store" }),
        fetch("/api/exercises/all", { cache: "no-store" }),
      ]);
      const dj = await d.json();
      const ej = await ex.json();
      setDays(dj.days ?? []);
      setExercises(ej.exercises ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setQueue(getQueueLength());
    const t = setInterval(() => setQueue(getQueueLength()), 1500);
    return () => clearInterval(t);
  }, []);

  async function createDay(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/workout-days", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Failed");
        return;
      }
      setNewName("");
      setNewDesc("");
      setNewDayOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEditDay(e: React.FormEvent) {
    e.preventDefault();
    if (!editDay) return;
    setSubmitting(true);
    try {
      await fetch(`/api/workout-days/${editDay.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editDayName.trim(),
          description: editDayDesc.trim() || null,
        }),
      });
      setEditDay(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function createExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!exName.trim() || !exDayId) return;
    setSubmitting(true);
    try {
      await fetch("/api/exercises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workoutDayId: exDayId,
          name: exName.trim(),
          notes: exNotes.trim() || null,
          targetSets: exSets ? Number(exSets) : null,
          targetReps: exReps ? Number(exReps) : null,
        }),
      });
      setExName("");
      setExNotes("");
      setExSets("");
      setExReps("");
      setNewExOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEditExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!editEx) return;
    setSubmitting(true);
    try {
      await fetch(`/api/exercises/${editEx.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editExName.trim(),
          notes: editExNotes.trim() || null,
          targetSets: editExSets ? Number(editExSets) : null,
          targetReps: editExReps ? Number(editExReps) : null,
        }),
      });
      setEditEx(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem() {
    if (!pendingDelete) return;
    const url =
      pendingDelete.kind === "day"
        ? `/api/workout-days/${pendingDelete.id}`
        : `/api/exercises/${pendingDelete.id}`;
    setPendingDelete(null);
    await fetch(url, { method: "DELETE" });
    await load();
  }

  async function moveDay(id: number, direction: -1 | 1) {
    const idx = days.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= days.length) return;
    const newOrder = [...days];
    const [m] = newOrder.splice(idx, 1);
    newOrder.splice(target, 0, m);
    setDays(newOrder);
    await fetch("/api/workout-days/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: newOrder.map((d) => d.id) }),
    });
  }

  async function moveExercise(id: number, direction: -1 | 1) {
    const list = exercises
      .filter((e) => e.workoutDayId === exercises.find((x) => x.id === id)?.workoutDayId)
      .sort((a, b) => a.position - b.position);
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= list.length) return;
    const newOrder = [...list];
    const [m] = newOrder.splice(idx, 1);
    newOrder.splice(target, 0, m);
    // Update local state
    setExercises((prev) =>
      prev.map((e) => {
        if (e.workoutDayId !== m.workoutDayId) return e;
        const ni = newOrder.findIndex((x) => x.id === e.id);
        return ni >= 0 ? { ...e, position: ni } : e;
      }),
    );
    await fetch("/api/exercises/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workoutDayId: m.workoutDayId,
        order: newOrder.map((e) => e.id),
      }),
    });
  }

  async function manualSync() {
    const r = await flushQueue();
    if (r.flushed > 0) {
      // Refresh data after sync
      await load();
    }
    setQueue(getQueueLength());
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">More</h1>
        <p className="text-sm text-neutral-400">
          Manage your workout days and exercises.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-[#141414] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Sync
        </h2>
        <p className="mt-1 text-sm text-neutral-300">
          {queue > 0
            ? `${queue} pending change${queue === 1 ? "" : "s"} waiting to sync.`
            : "All changes synced."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={manualSync}
            disabled={queue === 0}
          >
            Sync now
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm("Clear cached data on this device?")) clearCache();
            }}
          >
            Clear local cache
          </Button>
        </div>
      </section>

      <div className="flex gap-1 rounded-xl border border-neutral-800 bg-[#141414] p-1">
        <button
          type="button"
          onClick={() => setTab("days")}
          className={`tap flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === "days"
              ? "bg-emerald-500 text-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Workout Days
        </button>
        <button
          type="button"
          onClick={() => setTab("exercises")}
          className={`tap flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === "exercises"
              ? "bg-emerald-500 text-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Exercises
        </button>
      </div>

      {tab === "days" ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Days ({days.length})
            </h2>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setNewDayOpen(true)}
            >
              + Add
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl bg-[#141414]"
                />
              ))}
            </div>
          ) : days.length === 0 ? (
            <EmptyState
              title="No workout days"
              action={
                <Button variant="primary" onClick={() => setNewDayOpen(true)}>
                  + Add day
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {days.map((d, idx) => (
                <li
                  key={d.id}
                  className="rounded-2xl border border-neutral-800 bg-[#141414] p-3"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/workout-days/${d.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-base font-semibold text-white">
                        {d.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {d.exerciseCount}{" "}
                        {d.exerciseCount === 1 ? "exercise" : "exercises"}
                        {d.sessionCount > 0 &&
                          ` · ${d.sessionCount} session${
                            d.sessionCount === 1 ? "" : "s"
                          }`}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1">
                      <IconBtn
                        disabled={idx === 0}
                        onClick={() => moveDay(d.id, -1)}
                        title="Move up"
                      >
                        ▲
                      </IconBtn>
                      <IconBtn
                        disabled={idx === days.length - 1}
                        onClick={() => moveDay(d.id, 1)}
                        title="Move down"
                      >
                        ▼
                      </IconBtn>
                      <IconBtn
                        onClick={() => {
                          setEditDay(d);
                          setEditDayName(d.name);
                          setEditDayDesc(d.description ?? "");
                        }}
                        title="Edit"
                      >
                        ✎
                      </IconBtn>
                      <IconBtn
                        danger
                        onClick={() =>
                          setPendingDelete({ kind: "day", id: d.id, name: d.name })
                        }
                        title="Delete"
                      >
                        ✕
                      </IconBtn>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Exercises ({exercises.length})
            </h2>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setExDayId(days[0]?.id ?? null);
                setNewExOpen(true);
              }}
              disabled={days.length === 0}
            >
              + Add
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl bg-[#141414]"
                />
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <EmptyState
              title="No exercises"
              description="Add exercises from a workout day."
            />
          ) : (
            <ul className="space-y-2">
              {exercises.map((ex, _idx) => {
                const day = days.find((d) => d.id === ex.workoutDayId);
                const siblings = exercises
                  .filter((e) => e.workoutDayId === ex.workoutDayId)
                  .sort((a, b) => a.position - b.position);
                const sibIdx = siblings.findIndex((e) => e.id === ex.id);
                return (
                  <li
                    key={ex.id}
                    className="rounded-2xl border border-neutral-800 bg-[#141414] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/exercises/${ex.id}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="truncate text-base font-semibold text-white">
                          {ex.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {day?.name ?? "Unknown day"}
                          {ex.targetSets && ex.targetReps
                            ? ` · ${ex.targetSets}×${ex.targetReps}`
                            : ""}
                        </p>
                      </Link>
                      <div className="flex items-center gap-1">
                        <IconBtn
                          disabled={sibIdx <= 0}
                          onClick={() => moveExercise(ex.id, -1)}
                          title="Move up"
                        >
                          ▲
                        </IconBtn>
                        <IconBtn
                          disabled={sibIdx >= siblings.length - 1}
                          onClick={() => moveExercise(ex.id, 1)}
                          title="Move down"
                        >
                          ▼
                        </IconBtn>
                        <IconBtn
                          onClick={() => {
                            setEditEx(ex);
                            setEditExName(ex.name);
                            setEditExNotes(ex.notes ?? "");
                            setEditExSets(ex.targetSets ? String(ex.targetSets) : "");
                            setEditExReps(ex.targetReps ? String(ex.targetReps) : "");
                          }}
                          title="Edit"
                        >
                          ✎
                        </IconBtn>
                        <IconBtn
                          danger
                          onClick={() =>
                            setPendingDelete({
                              kind: "exercise",
                              id: ex.id,
                              name: ex.name,
                            })
                          }
                          title="Delete"
                        >
                          ✕
                        </IconBtn>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* New day modal */}
      <Modal
        open={newDayOpen}
        onClose={() => setNewDayOpen(false)}
        title="New Workout Day"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setNewDayOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              full
              disabled={submitting || !newName.trim()}
              onClick={() => {
                createDay({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        }
      >
        <form onSubmit={createDay} className="space-y-3">
          <Input
            label="Name"
            placeholder="e.g. Monday — Chest + Triceps"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="e.g. Heavy compounds first, isolation last"
          />
        </form>
      </Modal>

      {/* Edit day modal */}
      <Modal
        open={!!editDay}
        onClose={() => setEditDay(null)}
        title="Edit Workout Day"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setEditDay(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              full
              disabled={submitting || !editDayName.trim()}
              onClick={() => {
                saveEditDay({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <form onSubmit={saveEditDay} className="space-y-3">
          <Input
            label="Name"
            value={editDayName}
            onChange={(e) => setEditDayName(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Description"
            value={editDayDesc}
            onChange={(e) => setEditDayDesc(e.target.value)}
            placeholder="Optional"
          />
        </form>
      </Modal>

      {/* New exercise modal */}
      <Modal
        open={newExOpen}
        onClose={() => setNewExOpen(false)}
        title="New Exercise"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setNewExOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              full
              disabled={submitting || !exName.trim() || !exDayId}
              onClick={() => {
                createExercise({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              {submitting ? "Adding..." : "Add"}
            </Button>
          </div>
        }
      >
        <form onSubmit={createExercise} className="space-y-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-400">
              Workout day
            </span>
            <select
              className="w-full rounded-xl border border-neutral-800 bg-[#0f0f0f] px-3 py-3 text-base text-white outline-none focus:border-emerald-500"
              value={exDayId ?? ""}
              onChange={(e) => setExDayId(Number(e.target.value))}
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Exercise name"
            placeholder="e.g. Bench Press"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Target sets"
              inputMode="numeric"
              placeholder="e.g. 3"
              value={exSets}
              onChange={(e) => setExSets(e.target.value)}
            />
            <Input
              label="Target reps"
              inputMode="numeric"
              placeholder="e.g. 10"
              value={exReps}
              onChange={(e) => setExReps(e.target.value)}
            />
          </div>
          <Textarea
            label="Notes (optional)"
            placeholder="e.g. Keep elbows tucked"
            value={exNotes}
            onChange={(e) => setExNotes(e.target.value)}
          />
        </form>
      </Modal>

      {/* Edit exercise modal */}
      <Modal
        open={!!editEx}
        onClose={() => setEditEx(null)}
        title="Edit Exercise"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setEditEx(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              full
              disabled={submitting || !editExName.trim()}
              onClick={() => {
                saveEditExercise({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <form onSubmit={saveEditExercise} className="space-y-3">
          <Input
            label="Name"
            value={editExName}
            onChange={(e) => setEditExName(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Target sets"
              inputMode="numeric"
              placeholder="e.g. 3"
              value={editExSets}
              onChange={(e) => setEditExSets(e.target.value)}
            />
            <Input
              label="Target reps"
              inputMode="numeric"
              placeholder="e.g. 10"
              value={editExReps}
              onChange={(e) => setEditExReps(e.target.value)}
            />
          </div>
          <Textarea
            label="Notes"
            placeholder="e.g. Use controlled negative"
            value={editExNotes}
            onChange={(e) => setEditExNotes(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title={
          pendingDelete?.kind === "day" ? "Delete workout day?" : "Delete exercise?"
        }
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" full onClick={deleteItem}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-300">
          This will permanently remove{" "}
          <span className="font-semibold text-white">{pendingDelete?.name}</span> and
          all related data. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`tap rounded-md p-1.5 text-sm ${
        disabled
          ? "text-neutral-700"
          : danger
          ? "text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
          : "text-neutral-500 hover:bg-neutral-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
