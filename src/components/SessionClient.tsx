"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { formatDateTime } from "@/lib/format";
import { formatDuration, formatVolume } from "@/lib/format";

type SetRow = {
  id: number;
  setNumber: number;
  weight: number;
  reps: number;
  exerciseId: number;
  exerciseName: string;
  workoutDayId: number;
  workoutDayName: string;
};

type Session = {
  id: number;
  date: string;
  notes: string | null;
  workoutDayId: number;
  workoutDayName: string;
  startedAt: string;
  endedAt: string | null;
};

export default function SessionClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
      if (!res.ok) {
        router.push("/history");
        return;
      }
      const j = await res.json();
      setSession(j.session);
      setSets(j.sets);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteSession() {
    setConfirmDelete(false);
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (session) router.push(`/workout-days/${session.workoutDayId}`);
    else router.push("/history");
  }

  if (loading || !session) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-2/3 animate-pulse rounded bg-neutral-900" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#141414]" />
      </div>
    );
  }

  // group sets by exercise
  const byExercise = new Map<number, { name: string; sets: SetRow[]; totalVolume: number; topWeight: number }>();
  for (const s of sets) {
    const g = byExercise.get(s.exerciseId) ?? { name: s.exerciseName, sets: [], totalVolume: 0, topWeight: 0 };
    g.sets.push(s);
    g.totalVolume += s.weight * s.reps;
    if (s.weight > g.topWeight) g.topWeight = s.weight;
    byExercise.set(s.exerciseId, g);
  }
  const totalVolume = Array.from(byExercise.values()).reduce(
    (acc, g) => acc + g.totalVolume,
    0,
  );
  const duration =
    session.startedAt && session.endedAt
      ? formatDuration(
          new Date(session.endedAt).getTime() -
            new Date(session.startedAt).getTime(),
        )
      : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/workout-days/${session.workoutDayId}`}
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          ← {session.workoutDayName}
        </Link>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="tap rounded-md p-2 text-neutral-400 hover:bg-red-500/10 hover:text-red-400"
          aria-label="Delete workout"
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

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Workout
        </p>
        <h1 className="text-2xl font-bold text-white">
          {session.workoutDayName}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {formatDateTime(session.date)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Exercises" value={byExercise.size.toString()} />
        <Tile label="Total Sets" value={sets.length.toString()} />
        <Tile
          label="Volume"
          value={formatVolume(totalVolume)}
        />
      </div>
      {duration && (
        <p className="text-center text-sm text-neutral-400">
          Duration: <span className="text-white">{duration}</span>
        </p>
      )}

      {session.notes && (
        <div className="rounded-xl border border-neutral-800 bg-[#141414] p-3 text-sm text-neutral-300">
          {session.notes}
        </div>
      )}

      <div className="space-y-3">
        {Array.from(byExercise.entries()).map(([exId, g]) => (
          <section
            key={exId}
            className="rounded-2xl border border-neutral-800 bg-[#141414] p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{g.name}</h2>
              <Link
                href={`/exercises/${exId}`}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Open →
              </Link>
            </div>
            <ul className="space-y-1 font-mono text-sm text-neutral-200">
              {g.sets
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs">
                    <span className="w-10 text-neutral-500">#{s.setNumber}</span>
                    <span>{s.weight} kg</span>
                    <span className="text-neutral-600">×</span>
                    <span>{s.reps} reps</span>
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-right text-xs text-neutral-500">
              Top: <span className="font-semibold text-emerald-400">{g.topWeight} kg</span> · Vol: {formatVolume(g.totalVolume)}
            </p>
          </section>
        ))}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete workout?"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setConfirmDelete(false)}
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
          This will permanently remove this workout and all its sets.
        </p>
      </Modal>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
