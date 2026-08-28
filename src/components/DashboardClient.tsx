"use client";

import { useEffect, useState, useCallback } from "react";
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
  position: number;
  createdAt: string;
  exerciseCount: number;
  sessionCount: number;
  lastTrainedAt: string | null;
};

type RecentSession = {
  id: number;
  date: string;
  notes: string | null;
  workoutDayId: number;
  dayName: string;
  setCount: number;
  totalVolume: number;
};

type PersonalBest = {
  exerciseId: number;
  exerciseName: string;
  workoutDayId: number;
  dayName: string;
  topWeight: number;
  topVolume: number;
};

type DashboardData = {
  recent: RecentSession[];
  personalBests: PersonalBest[];
  totals: {
    totalSessions: number;
    totalDays: number;
    totalExercises: number;
    totalSets: number;
    personalBest: number;
  };
};

export default function DashboardClient() {
  const router = useRouter();
  const [days, setDays] = useState<Day[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [daysRes, dashRes] = await Promise.all([
        fetch("/api/workout-days", { cache: "no-store" }),
        fetch("/api/dashboard", { cache: "no-store" }),
      ]);
      const daysJson = await daysRes.json();
      const dashJson = await dashRes.json();
      setDays(daysJson.days ?? []);
      setData(dashJson);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createDay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/workout-days", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to create");
      }
      setName("");
      setDescription("");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Home
            </h1>
            <p className="text-sm text-neutral-400">
              Pick a workout day to start training.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setOpen(true)}
            aria-label="Add workout day"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            New
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-neutral-900 bg-[#141414]"
              />
            ))}
          </div>
        ) : days.length === 0 ? (
          <EmptyState
            title="No workout days yet"
            description="Create your first workout day like 'Monday — Chest' to get started."
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                Add workout day
              </Button>
            }
            icon={
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="currentColor">
                <path d="M10 2a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H3a1 1 0 110-2h6V3a1 1 0 011-1z" />
              </svg>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {days.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => router.push(`/workout-days/${d.id}`)}
                className="tap group flex h-28 flex-col justify-between rounded-2xl border border-neutral-800 bg-[#141414] p-4 text-left hover:border-emerald-600/60 hover:bg-[#171717]"
              >
                <div>
                  <p className="line-clamp-2 text-lg font-bold leading-tight text-white">
                    {d.name}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {d.exerciseCount}{" "}
                    {d.exerciseCount === 1 ? "exercise" : "exercises"}
                    {d.sessionCount > 0 && (
                      <>
                        {" · "}
                        {d.sessionCount}{" "}
                        {d.sessionCount === 1 ? "session" : "sessions"}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {d.lastTrainedAt
                      ? `Last: ${formatDateShort(d.lastTrainedAt)}`
                      : "Not started"}
                  </span>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="tap flex h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-neutral-800 bg-transparent text-neutral-400 hover:border-emerald-600/50 hover:text-emerald-300"
            >
              <svg
                viewBox="0 0 20 20"
                className="h-6 w-6"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">Add Workout Day</span>
            </button>
          </div>
        )}
      </section>

      {data && data.totals.totalSessions > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Workouts" value={data.totals.totalSessions} />
            <Stat label="Exercises" value={data.totals.totalExercises} />
            <Stat label="Total Sets" value={data.totals.totalSets} />
            <Stat
              label="Personal Best"
              value={`${data.totals.personalBest} kg`}
              highlight
            />
          </div>
        </section>
      )}

      {data && data.personalBests.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Top Lifts
            </h2>
            <Link
              href="/progress"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              See all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#141414]">
            <ul className="divide-y divide-neutral-900">
              {data.personalBests
                .filter((pb) => pb.topWeight > 0)
                .slice(0, 5)
                .map((pb) => (
                  <li key={pb.exerciseId}>
                    <Link
                      href={`/exercises/${pb.exerciseId}/progress`}
                      className="tap flex items-center justify-between px-4 py-3 hover:bg-[#181818]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {pb.exerciseName}
                        </p>
                        <p className="text-xs text-neutral-500">{pb.dayName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-emerald-400">
                          {pb.topWeight} kg
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      )}

      {data && data.recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Recent Activity
            </h2>
            <Link
              href="/history"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              See all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#141414]">
            <ul className="divide-y divide-neutral-900">
              {data.recent.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="tap flex items-center justify-between px-4 py-3 hover:bg-[#181818]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {s.dayName}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDateShort(s.date)} · {s.setCount}{" "}
                        {s.setCount === 1 ? "set" : "sets"}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-400">
                      {formatVolume(s.totalVolume)} vol
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Workout Day"
      >
        <form onSubmit={createDay} className="space-y-3">
          <Input
            label="Name"
            placeholder="e.g. Monday — Chest + Triceps"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            placeholder="Notes about this workout day"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              full
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              full
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          highlight ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
