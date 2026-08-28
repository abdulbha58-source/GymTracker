"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { formatDateShort } from "@/lib/format";
import { readCache, writeCache } from "@/lib/offline";

type Day = {
  id: number;
  name: string;
  description: string | null;
  position: number;
  exerciseCount: number;
  sessionCount: number;
  lastTrainedAt: string | null;
};

export default function WorkoutHubClient() {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try network first, fallback to cache
      try {
        const res = await fetch("/api/workout-days", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          setDays(j.days ?? []);
          writeCache("workout-days", j.days ?? []);
        }
      } catch {
        // offline
      }
      const cached = readCache<Day[]>("workout-days");
      if (cached) setDays(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Workout</h1>
        <p className="text-sm text-neutral-400">Pick a day to start training.</p>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-[#141414]"
            />
          ))}
        </div>
      ) : days.length === 0 ? (
        <EmptyState
          title="No workout days yet"
          description="Create a day to start logging workouts."
          action={
            <Link href="/more">
              <Button variant="primary">Create day</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {days.map((d) => (
            <li key={d.id}>
              <Link
                href={`/workout-days/${d.id}`}
                className="tap flex items-center justify-between rounded-2xl border border-neutral-800 bg-[#141414] p-4 hover:border-emerald-600/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-white">
                    {d.name}
                  </p>
                  <p className="text-xs text-neutral-500">
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
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-xs text-neutral-500">
                    {d.lastTrainedAt
                      ? `Last: ${formatDateShort(d.lastTrainedAt)}`
                      : "Not started"}
                  </span>
                  <span className="text-emerald-400" aria-hidden>
                    Open →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
