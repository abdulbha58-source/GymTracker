"use client";

import { useEffect, useState, useCallback, use, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import NumberStepper from "@/components/NumberStepper";
import {
  clearActiveSession,
  clearDraft,
  enqueueWrite,
  isClient,
  readActiveSession,
  readAllDrafts,
  readDraft,
  writeActiveSession,
  writeCache,
  writeDraft,
} from "@/lib/offline";
import { formatDuration, formatVolume } from "@/lib/format";

type Exercise = {
  id: number;
  name: string;
  notes: string | null;
  targetSets: number | null;
  targetReps: number | null;
  workoutDayId: number;
  workoutDayName: string;
  lastSession: {
    sessionId: number;
    date: string;
    topWeight: number;
    reps: number;
    totalReps: number;
    totalVolume: number;
    sets: { setNumber: number; weight: number; reps: number }[];
  } | null;
};

type Day = { id: number; name: string; description: string | null };

type Draft = {
  weight: string;
  reps: string;
};

function defaultDraftFromSession(last: Exercise["lastSession"], targetReps: number | null): Draft[] {
  if (!last) {
    const reps = targetReps ? String(targetReps) : "";
    return [{ weight: "", reps }];
  }
  // For first suggested row, use top weight from last + last first-set reps
  const reps = targetReps
    ? String(targetReps)
    : String(last.sets[0]?.reps ?? "");
  return [{ weight: String(last.topWeight), reps }];
}

export default function LogWorkoutClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [day, setDay] = useState<Day | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-exercise UI state
  const [openExercise, setOpenExercise] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft[]>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [saveMessage, setSaveMessage] = useState<Record<number, string | null>>({});

  // Workout session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);

  const [confirmFinish, setConfirmFinish] = useState(false);

  const sessionInfoRef = useRef<{
    workoutDayId: number;
    workoutDayName: string;
    sessionId: number | null;
    startedAt: number;
  } | null>(null);

  // Load data + active session
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/workout-days/${id}/log`, {
          cache: "no-store",
        });
        if (!res.ok) {
          router.push("/workout");
          return;
        }
        const j = await res.json();
        setDay(j.day);
        setExercises(j.exercises);
        writeCache(`log:${id}`, j);

        // Resume active session if it matches this day
        const active = readActiveSession();
        const now = Date.now();
        if (active && active.workoutDayId === Number(id)) {
          setSessionId(active.id);
          setStartedAt(active.startedAt);
        } else {
          setStartedAt(now);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  // Persist active session
  useEffect(() => {
    if (!day) return;
    const sid = sessionId ?? -1; // -1 indicates not yet saved
    sessionInfoRef.current = {
      workoutDayId: day.id,
      workoutDayName: day.name,
      sessionId: sessionId,
      startedAt,
    };
    if (sessionId) {
      writeActiveSession({
        id: sessionId,
        workoutDayId: day.id,
        workoutDayName: day.name,
        startedAt,
      });
    }
  }, [sessionId, startedAt, day]);

  // Load drafts for each exercise
  useEffect(() => {
    if (exercises.length === 0) return;
    const nextDrafts: Record<number, Draft[]> = {};
    for (const ex of exercises) {
      const cached = readDraft(ex.workoutDayId, ex.id);
      if (cached && Array.isArray(cached.sets) && cached.sets.length > 0) {
        nextDrafts[ex.id] = cached.sets.map((s) => ({
          weight: String(s.weight),
          reps: String(s.reps),
        }));
      } else {
        nextDrafts[ex.id] = defaultDraftFromSession(ex.lastSession, ex.targetReps);
      }
    }
    setDrafts(nextDrafts);
    // Read all-drafts map to mark "saved" if any cache exists per exercise
    const all = readAllDrafts();
    const nextSaved: Record<number, boolean> = {};
    for (const ex of exercises) {
      const key = `${ex.workoutDayId}:${ex.id}`;
      if (all[key]?.workoutSessionId && sessionId && all[key]?.workoutSessionId === sessionId) {
        // already saved in this session
        nextSaved[ex.id] = true;
      }
    }
    setSaved(nextSaved);
  }, [exercises, sessionId]);

  // Persist drafts as they change
  useEffect(() => {
    if (!day) return;
    for (const ex of exercises) {
      const list = drafts[ex.id];
      if (!list) continue;
      writeDraft(day.id, ex.id, {
        workoutDayId: day.id,
        workoutSessionId: sessionId ?? undefined,
        sets: list.map((d, i) => ({
          setNumber: i + 1,
          weight: Number(d.weight) || 0,
          reps: Number(d.reps) || 0,
        })),
        updatedAt: Date.now(),
      });
    }
  }, [drafts, exercises, day, sessionId]);

  function updateDraft(exId: number, idx: number, key: keyof Draft, value: string) {
    setDrafts((prev) => {
      const list = prev[exId] ?? [];
      const next = list.map((d, i) => (i === idx ? { ...d, [key]: value } : d));
      return { ...prev, [exId]: next };
    });
  }

  function addSetRow(exId: number) {
    setDrafts((prev) => {
      const list = prev[exId] ?? [];
      const last = list[list.length - 1];
      const next: Draft = last
        ? { weight: last.weight, reps: last.reps }
        : { weight: "", reps: "" };
      return { ...prev, [exId]: [...list, next] };
    });
  }

  function removeSetRow(exId: number, idx: number) {
    setDrafts((prev) => {
      const list = prev[exId] ?? [];
      if (list.length <= 1) return prev;
      return { ...prev, [exId]: list.filter((_, i) => i !== idx) };
    });
  }

  function seedFromLast(exId: number) {
    const ex = exercises.find((e) => e.id === exId);
    if (!ex?.lastSession) return;
    const list: Draft[] = ex.lastSession.sets.map((s) => ({
      weight: String(s.weight),
      reps: String(s.reps),
    }));
    setDrafts((prev) => ({ ...prev, [exId]: list }));
  }

  async function saveExercise(exId: number) {
    const ex = exercises.find((e) => e.id === exId);
    if (!ex || !day) return;
    const list = drafts[exId] ?? [];
    const valid = list
      .map((d, i) => ({
        exerciseId: exId,
        setNumber: i + 1,
        weight: Number(d.weight),
        reps: Number(d.reps),
      }))
      .filter(
        (d) =>
          Number.isFinite(d.weight) &&
          Number.isFinite(d.reps) &&
          d.weight > 0 &&
          d.reps > 0,
      );
    if (valid.length === 0) {
      setSaveMessage((m) => ({ ...m, [exId]: "Add at least one set first." }));
      return;
    }
    setSubmitting((s) => ({ ...s, [exId]: true }));
    setSaveMessage((m) => ({ ...m, [exId]: null }));
    try {
      const body = {
        workoutDayId: day.id,
        sets: valid,
        date: new Date().toISOString(),
        startedAt: new Date(startedAt).toISOString(),
        sessionId: sessionId,
      };
      let newSessionId = sessionId;
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("network");
        const j = await res.json();
        newSessionId = j.session.id;
      } catch {
        // Offline: queue
        enqueueWrite({
          url: "/api/sessions",
          method: "POST",
          body,
        });
      }
      setSessionId(newSessionId);
      setSaved((s) => ({ ...s, [exId]: true }));
      setSaveMessage((m) => ({ ...m, [exId]: "Saved ✓" }));
      // Clear draft for this exercise (it's now persisted server-side)
      if (day) clearDraft(day.id, exId);
      // Close the row
      setOpenExercise(null);
    } finally {
      setSubmitting((s) => ({ ...s, [exId]: false }));
    }
  }

  async function finishWorkout() {
    setConfirmFinish(false);
    const end = Date.now();
    setEndedAt(end);
    if (sessionId) {
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endedAt: new Date(end).toISOString() }),
        });
      } catch {
        enqueueWrite({
          url: `/api/sessions/${sessionId}`,
          method: "PATCH",
          body: { endedAt: new Date(end).toISOString() },
        });
      }
    }
    clearActiveSession();
    setCompleted(true);
  }

  const totalSaved = useMemo(
    () => Object.values(saved).filter(Boolean).length,
    [saved],
  );
  const allDone = exercises.length > 0 && totalSaved >= exercises.length;
  const duration = formatDuration((endedAt ?? Date.now()) - startedAt);

  // PR detection: when saving an exercise, compare top weight to all-time PR
  const allTimePRs = useMemo(() => {
    // Best-effort: read top from local history cache per exercise if any.
    // Real source of truth is the API. We don't show PRs on this screen to keep
    // it simple; the exercise detail screen shows PR celebration.
    return new Map<number, number>();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-2/3 animate-pulse rounded bg-neutral-900" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#141414]" />
        ))}
      </div>
    );
  }

  if (completed) {
    return <CompletionScreen dayId={day?.id ?? 0} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/workout-days/${id}`}
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          ← Exit
        </Link>
        <div className="text-right text-xs text-neutral-500">
          <p>⏱ {duration}</p>
          <p>
            {totalSaved}/{exercises.length} done
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Workout
        </p>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-white">
          {day?.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Log each exercise below. Saving takes you to the next one.
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-4 border-b border-neutral-900 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur">
        <Button
          variant={allDone ? "primary" : "secondary"}
          full
          size="lg"
          onClick={() => setConfirmFinish(true)}
        >
          {allDone ? "🏁 Finish Workout" : "Finish Workout"}
        </Button>
      </div>

      <div className="space-y-3">
        {exercises.map((ex) => {
          const isOpen = openExercise === ex.id;
          const isSaved = !!saved[ex.id];
          const list = drafts[ex.id] ?? [];
          const validDrafts = list.filter(
            (d) => Number(d.weight) > 0 && Number(d.reps) > 0,
          );
          const curTop = validDrafts.reduce(
            (acc, d) => Math.max(acc, Number(d.weight) || 0),
            0,
          );
          const lastTop = ex.lastSession?.topWeight ?? 0;
          const willBeRecord = curTop > lastTop && lastTop > 0 && validDrafts.length > 0;

          return (
            <section
              key={ex.id}
              className={`rounded-2xl border ${
                isSaved
                  ? "border-emerald-700/60 bg-emerald-950/30"
                  : "border-neutral-800 bg-[#141414]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-white">
                      {ex.name}
                    </h2>
                    {isSaved && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        ✓ Done
                      </span>
                    )}
                  </div>
                  {ex.targetSets && ex.targetReps && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Target: {ex.targetSets} × {ex.targetReps}
                    </p>
                  )}
                  {ex.lastSession ? (
                    <p className="mt-1 text-sm text-neutral-300">
                      Last time:{" "}
                      <span className="font-mono">
                        {ex.lastSession.topWeight} kg × {ex.lastSession.reps} ×{" "}
                        {ex.lastSession.sets.length}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-neutral-500">
                      No previous workout
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {!isSaved && (
                    <Button
                      size="sm"
                      variant={isOpen ? "primary" : "secondary"}
                      onClick={() =>
                        setOpenExercise(isOpen ? null : ex.id)
                      }
                    >
                      {isOpen ? "Close" : "Log Sets"}
                    </Button>
                  )}
                  <Link
                    href={`/exercises/${ex.id}/progress`}
                    className="text-[10px] uppercase tracking-wide text-neutral-500 hover:text-emerald-400"
                  >
                    Progress
                  </Link>
                </div>
              </div>

              {isOpen && !isSaved && (
                <div className="border-t border-neutral-900 px-4 py-4">
                  <div className="space-y-2">
                    {list.map((d, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Set {i + 1}
                          </span>
                          {list.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSetRow(ex.id, i)}
                              className="tap rounded p-1 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
                              aria-label="Remove set"
                            >
                              <svg
                                viewBox="0 0 20 20"
                                className="h-4 w-4"
                                fill="currentColor"
                              >
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
                            onChange={(v) => updateDraft(ex.id, i, "weight", v)}
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
                            onChange={(v) => updateDraft(ex.id, i, "reps", v)}
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
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => addSetRow(ex.id)}
                      >
                        + Add Set
                      </Button>
                      {ex.lastSession && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          onClick={() => seedFromLast(ex.id)}
                          title="Repeat last workout"
                        >
                          ↺ Last
                        </Button>
                      )}
                    </div>
                    <div className="text-right">
                      {willBeRecord && (
                        <p className="mb-1 text-xs font-semibold text-emerald-400">
                          🏆 Would set a new PR
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        onClick={() => saveExercise(ex.id)}
                        disabled={submitting[ex.id]}
                      >
                        {submitting[ex.id] ? "Saving..." : "Save Exercise"}
                      </Button>
                    </div>
                  </div>
                  {saveMessage[ex.id] && (
                    <p className="mt-2 text-center text-sm text-neutral-300">
                      {saveMessage[ex.id]}
                    </p>
                  )}
                </div>
              )}

              {isSaved && (
                <div className="border-t border-emerald-900/40 px-4 py-3 text-sm text-emerald-300">
                  ✓ Logged. Tap <span className="font-semibold">Progress</span> to see charts, or move to the next exercise.
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Modal
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title="Finish workout?"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setConfirmFinish(false)}
            >
              Keep going
            </Button>
            <Button type="button" variant="primary" full onClick={finishWorkout}>
              Finish
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-300">
          You've completed{" "}
          <span className="font-semibold text-white">{totalSaved}</span> of{" "}
          {exercises.length} exercises in {duration}.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          You can still log more exercises later — your session is already saved.
        </p>
      </Modal>
    </div>
  );
}

function CompletionScreen({ dayId }: { dayId: number }) {
  const [data, setData] = useState<{
    dayName: string;
    exerciseCount: number;
    totalSets: number;
    totalVolume: number;
    duration: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const recent = j.recent?.[0];
        if (recent) {
          const dur =
            recent.startedAt && recent.endedAt
              ? formatDuration(
                  new Date(recent.endedAt).getTime() -
                    new Date(recent.startedAt).getTime(),
                )
              : "—";
          setData({
            dayName: recent.dayName,
            exerciseCount: 0,
            totalSets: recent.setCount,
            totalVolume: recent.totalVolume,
            duration: dur,
          });
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M2.25 12a9.75 9.75 0 1119.5 0 9.75 9.75 0 01-19.5 0zm14.28-2.03a.75.75 0 00-1.06-1.06l-5.47 5.47-1.97-1.97a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.06 0l6-6z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h1 className="text-3xl font-extrabold uppercase tracking-tight text-white">
        Workout Complete 🎉
      </h1>
      {data && (
        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
          <Tile label="Sets" value={String(data.totalSets)} />
          <Tile label="Volume" value={formatVolume(data.totalVolume)} />
          <Tile label="Duration" value={data.duration} />
          <Tile label="PRs" value="see Progress" muted />
        </div>
      )}
      <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
        <Link href={`/workout-days/${dayId}`} className="block">
          <Button variant="primary" size="lg" full>
            Back to day
          </Button>
        </Link>
        <Link href="/history" className="block">
          <Button variant="secondary" size="lg" full>
            View history
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          muted ? "text-sm font-medium text-neutral-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
