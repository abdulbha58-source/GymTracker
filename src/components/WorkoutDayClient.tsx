"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { Input, Textarea } from "@/components/Field";
import EmptyState from "@/components/EmptyState";
import { formatDateShort } from "@/lib/format";
import { formatVolume } from "@/lib/format";

type Day = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
};

type Exercise = {
  id: number;
  workoutDayId: number;
  name: string;
  notes: string | null;
  targetSets: number | null;
  targetReps: number | null;
  position: number;
  createdAt: string;
};

export default function WorkoutDayClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [day, setDay] = useState<Day | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseNotes, setExerciseNotes] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [editExercise, setEditExercise] = useState<Exercise | null>(null);
  const [editExName, setEditExName] = useState("");
  const [editExNotes, setEditExNotes] = useState("");
  const [editExSets, setEditExSets] = useState("");
  const [editExReps, setEditExReps] = useState("");

  const [pendingDelete, setPendingDelete] = useState<Exercise | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workout-days/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Workout day not found");
        return;
      }
      const j = await res.json();
      setDay(j.day);
      setExercises(j.exercises);
      setEditName(j.day.name);
      setEditDescription(j.day.description ?? "");
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workoutDayId: Number(id),
          name: exerciseName.trim(),
          notes: exerciseNotes.trim() || null,
          targetSets: exerciseSets ? Number(exerciseSets) : null,
          targetReps: exerciseReps ? Number(exerciseReps) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setExerciseName("");
      setExerciseNotes("");
      setExerciseSets("");
      setExerciseReps("");
      setAddOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/workout-days/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setEditOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEditExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!editExercise) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exercises/${editExercise.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editExName.trim(),
          notes: editExNotes.trim() || null,
          targetSets: editExSets ? Number(editExSets) : null,
          targetReps: editExReps ? Number(editExReps) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setEditExercise(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function moveExercise(ex: Exercise, direction: -1 | 1) {
    const idx = exercises.findIndex((e) => e.id === ex.id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= exercises.length) return;
    const newOrder = [...exercises];
    const [m] = newOrder.splice(idx, 1);
    newOrder.splice(target, 0, m);
    setExercises((prev) =>
      prev.map((e) => {
        const ni = newOrder.findIndex((x) => x.id === e.id);
        return ni >= 0 ? { ...e, position: ni } : e;
      }),
    );
    await fetch("/api/exercises/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workoutDayId: ex.workoutDayId,
        order: newOrder.map((e) => e.id),
      }),
    });
  }

  async function deleteExercise() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await fetch(`/api/exercises/${target.id}`, { method: "DELETE" });
    await load();
  }

  async function deleteDay() {
    if (!window.confirm("Delete this entire workout day and all its data?")) return;
    await fetch(`/api/workout-days/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-1/2 animate-pulse rounded bg-neutral-900" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#141414]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#141414]" />
      </div>
    );
  }
  if (error || !day) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400">{error ?? "Not found"}</p>
        <Link href="/" className="text-sm text-emerald-400">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/workout"
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          ← Workout
        </Link>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.4 2.6a1.5 1.5 0 012.1 2.1l-1.1 1.1-2.1-2.1 1.1-1.1zM15.2 4.8L4 16l-1.5 4 4-1.5L18 7l-2.8-2.2z" />
          </svg>
          Edit
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-white">
          {day.name}
        </h1>
        {day.description && (
          <p className="mt-1 text-sm text-neutral-400">{day.description}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/workout-days/${id}/log`} className="flex-1">
          <Button variant="primary" size="lg" full disabled={exercises.length === 0}>
            ▶ Start Workout
          </Button>
        </Link>
        <Button variant="secondary" size="lg" onClick={() => setAddOpen(true)}>
          + Add Exercise
        </Button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Exercises ({exercises.length})
        </h2>
        {exercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            description="Add the exercises you do on this day so you can quickly log them later."
            action={
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                + Add Exercise
              </Button>
            }
            icon={
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="currentColor">
                <path d="M3 5a1 1 0 011-1h12a1 1 0 011 1v2H3V5zm0 4h14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9z" />
              </svg>
            }
          />
        ) : (
          <ul className="space-y-2">
            {exercises.map((ex, idx) => (
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
                      {ex.targetSets && ex.targetReps
                        ? `Target ${ex.targetSets}×${ex.targetReps}`
                        : "Tap to log or view progress"}
                    </p>
                  </Link>
                  <div className="flex items-center gap-0.5">
                    <IconBtn
                      disabled={idx === 0}
                      onClick={() => moveExercise(ex, -1)}
                      title="Move up"
                    >
                      ▲
                    </IconBtn>
                    <IconBtn
                      disabled={idx === exercises.length - 1}
                      onClick={() => moveExercise(ex, 1)}
                      title="Move down"
                    >
                      ▼
                    </IconBtn>
                    <IconBtn
                      onClick={() => {
                        setEditExercise(ex);
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
                      onClick={() => setPendingDelete(ex)}
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

      <div className="pt-2">
        <button
          type="button"
          onClick={deleteDay}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Delete this workout day
        </button>
      </div>

      {/* Add exercise modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Exercise"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              full
              disabled={submitting || !exerciseName.trim()}
              onClick={() => {
                addExercise({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              {submitting ? "Adding..." : "Add"}
            </Button>
          </div>
        }
      >
        <form onSubmit={addExercise} className="space-y-3">
          <Input
            label="Exercise name"
            placeholder="e.g. Bench Press"
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Target sets"
              inputMode="numeric"
              placeholder="e.g. 3"
              value={exerciseSets}
              onChange={(e) => setExerciseSets(e.target.value)}
            />
            <Input
              label="Target reps"
              inputMode="numeric"
              placeholder="e.g. 10"
              value={exerciseReps}
              onChange={(e) => setExerciseReps(e.target.value)}
            />
          </div>
          <Textarea
            label="Notes (optional)"
            placeholder="Form cues, machine number, etc."
            value={exerciseNotes}
            onChange={(e) => setExerciseNotes(e.target.value)}
          />
        </form>
      </Modal>

      {/* Edit day modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Workout Day"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setEditOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              full
              disabled={submitting || !editName.trim()}
              onClick={() => {
                saveEdit({ preventDefault: () => {} } as React.FormEvent);
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Description"
            placeholder="Optional"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
        </form>
      </Modal>

      {/* Edit exercise modal */}
      <Modal
        open={!!editExercise}
        onClose={() => setEditExercise(null)}
        title="Edit Exercise"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setEditExercise(null)}
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
            placeholder="Optional"
            value={editExNotes}
            onChange={(e) => setEditExNotes(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete exercise?"
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
            <Button
              type="button"
              variant="danger"
              full
              onClick={deleteExercise}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-300">
          This will permanently remove{" "}
          <span className="font-semibold text-white">
            {pendingDelete?.name}
          </span>{" "}
          and all its logged sets. This cannot be undone.
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
