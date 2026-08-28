"use client";

import { useEffect, useState, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { Input, Textarea } from "@/components/Field";
import NumberStepper from "@/components/NumberStepper";
import EmptyState from "@/components/EmptyState";
import { formatDateShort } from "@/lib/format";
import { formatVolume } from "@/lib/format";

type SetRow = {
  id: number;
  setNumber: number;
  weight: number;
  reps: number;
  sessionId: number;
  date: string;
};

type Exercise = {
  id: number;
  name: string;
  notes: string | null;
  workoutDayId: number;
  workoutDayName: string;
  targetSets: number | null;
  targetReps: number | null;
};

type DraftSet = {
  weight: string;
  reps: string;
};

export default function ExerciseClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [drafts, setDrafts] = useState<DraftSet[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{
    sessionId: number;
    label: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [exRes, histRes] = await Promise.all([
        fetch(`/api/exercises/${id}`, { cache: "no-store" }),
        fetch(`/api/exercises/${id}/history`, { cache: "no-store" }),
      ]);
      if (exRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (!exRes.ok) {
        setNotFound(true);
        return;
      }
      const exJson = await exRes.json();
      setExercise(exJson.exercise);
      setEditName(exJson.exercise.name);
      setEditNotes(exJson.exercise.notes ?? "");
      setEditSets(exJson.exercise.targetSets ? String(exJson.exercise.targetSets) : "");
      setEditReps(exJson.exercise.targetReps ? String(exJson.exercise.targetReps) : "");
      const histJson = await histRes.json();
      setHistory(histJson.history ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const sessionGroups = useMemo(() => {
    const map = new Map<
      number,
      { sessionId: number; date: string; sets: SetRow[]; topWeight: number; totalReps: number; totalVolume: number }
    >();
    for (const s of history) {
      const g = map.get(s.sessionId) ?? {
        sessionId: s.sessionId,
        date: s.date,
        sets: [],
        topWeight: 0,
        totalReps: 0,
        totalVolume: 0,
      };
      g.sets.push(s);
      if (s.weight > g.topWeight) g.topWeight = s.weight;
      g.totalReps += s.reps;
      g.totalVolume += s.weight * s.reps;
      map.set(s.sessionId, g);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [history]);

  const previousSession = sessionGroups[0];
  const priorSession = sessionGroups[1];

  // Initialize drafts based on previous session + target reps
  useEffect(() => {
    if (!exercise) return;
    if (drafts.length > 0) return;
    const targetReps = exercise.targetReps ?? null;
    const targetSets = exercise.targetSets ?? null;
    if (previousSession) {
      const reps = targetReps
        ? String(targetReps)
        : String(previousSession.sets[0]?.reps ?? "");
      const count = targetSets ?? previousSession.sets.length ?? 1;
      const next: DraftSet[] = Array.from({ length: count }, () => ({
        weight: String(previousSession.topWeight),
        reps,
      }));
      setDrafts(next);
    } else {
      const reps = targetReps ? String(targetReps) : "";
      const count = targetSets ?? 1;
      setDrafts(
        Array.from({ length: count }, () => ({ weight: "", reps })),
      );
    }
  }, [exercise, previousSession, drafts.length]);

  const personalBest = useMemo(
    () => sessionGroups.reduce((acc, s) => Math.max(acc, s.topWeight), 0),
    [sessionGroups],
  );

  const recordCheck = useMemo(() => {
    if (!exercise) return null;
    const validDrafts = drafts
      .map((d) => ({ weight: Number(d.weight), reps: Number(d.reps) }))
      .filter(
        (d) => Number.isFinite(d.weight) && Number.isFinite(d.reps) && d.weight > 0 && d.reps > 0,
      );
    if (validDrafts.length === 0) return null;
    const currentTop = validDrafts.reduce(
      (acc, d) => (d.weight > acc ? d.weight : acc),
      0,
    );
    const prevTop = previousSession?.topWeight ?? 0;
    if (prevTop === 0) {
      return { type: "first" as const, message: "First time logging this exercise" };
    }
    if (currentTop > prevTop) {
      return {
        type: "record" as const,
        message: `🏆 New PR! ${currentTop} kg > ${prevTop} kg`,
      };
    }
    if (currentTop < prevTop) {
      return {
        type: "down" as const,
        message: `${currentTop} kg vs last top ${prevTop} kg`,
      };
    }
    return {
      type: "same" as const,
      message: `Matching your top of ${currentTop} kg`,
    };
  }, [drafts, exercise, previousSession]);

  const totalVolume = useMemo(
    () =>
      drafts.reduce(
        (acc, d) => acc + (Number(d.weight) || 0) * (Number(d.reps) || 0),
        0,
      ),
    [drafts],
  );

  function updateDraft(index: number, key: keyof DraftSet, value: string) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
  }

  function addSet() {
    setDrafts((prev) => {
      const last = prev[prev.length - 1];
      const next = last ? { weight: last.weight, reps: last.reps } : { weight: "", reps: "" };
      return [...prev, next];
    });
  }

  function removeSet(index: number) {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function saveWorkout() {
    if (!exercise) return;
    const validSets = drafts
      .map((d, i) => ({
        exerciseId: exercise.id,
        setNumber: i + 1,
        weight: Number(d.weight),
        reps: Number(d.reps),
      }))
      .filter(
        (d) => Number.isFinite(d.weight) && Number.isFinite(d.reps) && d.weight > 0 && d.reps > 0,
      );
    if (validSets.length === 0) {
      setSaveMessage("Add at least one set first.");
      return;
    }
    setSubmitting(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workoutDayId: exercise.workoutDayId,
          sets: validSets,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setSaveMessage("Saved ✓");
      await load();
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exercises/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          notes: editNotes.trim() || null,
          targetSets: editSets ? Number(editSets) : null,
          targetReps: editReps ? Number(editReps) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setEditOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteSession() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    await fetch(`/api/sessions/${target.sessionId}`, { method: "DELETE" });
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-2/3 animate-pulse rounded bg-neutral-900" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#141414]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#141414]" />
      </div>
    );
  }
  if (notFound || !exercise) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400">Exercise not found.</p>
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
          href={`/workout-days/${exercise.workoutDayId}`}
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          ← {exercise.workoutDayName}
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href={`/exercises/${id}/progress`}
            className="tap rounded-md p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white"
            aria-label="View progress"
            title="Progress"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M3 17V8h2v9H3zm4 0V3h2v14H7zm4 0v-6h2v6h-2zm4 0V10h2v7h-2z" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="tap rounded-md p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white"
            aria-label="Edit exercise"
            title="Edit"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M17.4 2.6a1.5 1.5 0 012.1 2.1l-1.1 1.1-2.1-2.1 1.1-1.1zM15.2 4.8L4 16l-1.5 4 4-1.5L18 7l-2.8-2.2z" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white">{exercise.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {exercise.workoutDayName}
          {exercise.targetSets && exercise.targetReps && (
            <>
              {" · Target "}
              {exercise.targetSets}×{exercise.targetReps}
            </>
          )}
        </p>
      </div>

      {previousSession && (
        <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Last workout
          </p>
          <p className="mt-1 text-xl font-semibold text-white">
            {previousSession.topWeight} kg
            <span className="text-neutral-500"> × </span>
            {previousSession.sets[0]?.reps ?? 0}
            <span className="text-neutral-500"> × </span>
            {previousSession.sets.length}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {formatDateShort(previousSession.date)} · {previousSession.sets.length}{" "}
            {previousSession.sets.length === 1 ? "set" : "sets"} ·{" "}
            {formatVolume(previousSession.totalVolume)} vol
          </p>
        </div>
      )}

      {priorSession && (
        <div className="rounded-2xl border border-neutral-800 bg-[#0f0f0f] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Previous workout
          </p>
          <p className="mt-1 text-base font-semibold text-white">
            {priorSession.topWeight} kg
            <span className="text-neutral-500"> × </span>
            {priorSession.sets[0]?.reps ?? 0}
            <span className="text-neutral-500"> × </span>
            {priorSession.sets.length}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {formatDateShort(priorSession.date)}
          </p>
        </div>
      )}

      {!previousSession && (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-[#111] p-4 text-sm italic text-neutral-500">
          No previous workout
        </div>
      )}

      {exercise.notes && (
        <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-3 text-sm text-neutral-300">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-wrap">{exercise.notes}</p>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Today's workout
          </p>
          <p className="text-xs text-neutral-500">
            Vol: <span className="font-mono text-white">{formatVolume(totalVolume)}</span>
          </p>
        </div>
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Set {i + 1}
                </span>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(i)}
                    className="tap rounded p-1 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Remove set"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <NumberStepper
                  value={d.weight}
                  onChange={(v) => updateDraft(i, "weight", v)}
                  step={2.5}
                  stepOptions={[2.5, 5]}
                  placeholder="kg"
                  inputMode="decimal"
                  suffix="kg"
                  ariaLabel={`Set ${i + 1} weight`}
                  big
                />
                <NumberStepper
                  value={d.reps}
                  onChange={(v) => updateDraft(i, "reps", v)}
                  step={1}
                  min={0}
                  max={999}
                  placeholder="reps"
                  inputMode="numeric"
                  ariaLabel={`Set ${i + 1} reps`}
                  big
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="secondary" onClick={addSet} className="sm:w-auto">
            + Add Set
          </Button>
          <div className="text-right">
            {recordCheck && (
              <p
                className={`mb-1 text-xs font-semibold ${
                  recordCheck.type === "record"
                    ? "text-amber-400"
                    : recordCheck.type === "down"
                    ? "text-amber-400"
                    : "text-neutral-400"
                }`}
              >
                {recordCheck.message}
              </p>
            )}
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={saveWorkout}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save Workout"}
            </Button>
          </div>
        </div>
        {saveMessage && (
          <p className="mt-2 text-center text-sm text-neutral-300">
            {saveMessage}
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          History
        </h2>
        {sessionGroups.length === 0 ? (
          <EmptyState
            title="No history yet"
            description="Log your first workout above to see it here."
          />
        ) : (
          <ul className="space-y-2">
            {sessionGroups.map((g) => (
              <li
                key={g.sessionId}
                className="rounded-2xl border border-neutral-800 bg-[#141414] p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    {formatDateShort(g.date)}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-neutral-500">
                      {g.topWeight} kg · {g.sets.length}{" "}
                      {g.sets.length === 1 ? "set" : "sets"} ·{" "}
                      {formatVolume(g.totalVolume)} vol
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDelete({
                          sessionId: g.sessionId,
                          label: formatDateShort(g.date),
                        })
                      }
                      className="tap rounded-md p-1.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Delete session"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A1.75 1.75 0 007 2.75V3.5H4.25a1 1 0 100 2H5v11.25A2.25 2.25 0 007.25 19h5.5A2.25 2.25 0 0015 16.75V5.5h.75a1 1 0 100-2H13v-.75A1.75 1.75 0 0011.25 1h-2.5zM9 4.5h2v-.75a.25.25 0 00-.25-.25h-1.5a.25.25 0 00-.25.25v.75zm-1 4a1 1 0 112 0v6a1 1 0 11-2 0v-6zm4 0a1 1 0 112 0v6a1 1 0 11-2 0v-6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                  {g.sets
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 font-mono text-xs"
                      >
                        <span className="w-10 text-neutral-500">
                          #{s.setNumber}
                        </span>
                        <span>{s.weight} kg</span>
                        <span className="text-neutral-600">×</span>
                        <span>{s.reps} reps</span>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Exercise"
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
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Target sets"
              inputMode="numeric"
              placeholder="e.g. 3"
              value={editSets}
              onChange={(e) => setEditSets(e.target.value)}
            />
            <Input
              label="Target reps"
              inputMode="numeric"
              placeholder="e.g. 10"
              value={editReps}
              onChange={(e) => setEditReps(e.target.value)}
            />
          </div>
          <Textarea
            label="Notes"
            placeholder="Optional"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete workout?"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              full
              onClick={deleteSession}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-300">
          Delete the workout from {confirmDelete?.label}? All sets from that
          session will be removed.
        </p>
      </Modal>
    </div>
  );
}
