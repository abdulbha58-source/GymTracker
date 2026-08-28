"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { formatDate, formatDuration, formatVolume } from "@/lib/format";

type Session = {
  id: number;
  date: string;
  notes: string | null;
  workoutDayId: number;
  dayName: string;
  startedAt: string;
  endedAt: string | null;
  setCount: number;
  totalVolume: number;
  exerciseCount: number;
};

export default function HistoryClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      const j = await res.json();
      setSessions(j.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // group by date
  const grouped = (() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const key = new Date(s.date).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  })();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-sm text-neutral-400">
          All your past workouts in one place.
        </p>
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
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          description="Once you start a workout, it'll show up here."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateKey, items]) => (
            <section key={dateKey}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {formatDate(new Date(dateKey))}
              </p>
              <ul className="space-y-2">
                {items.map((s) => {
                  const dur =
                    s.startedAt && s.endedAt
                      ? formatDuration(
                          new Date(s.endedAt).getTime() -
                            new Date(s.startedAt).getTime(),
                        )
                      : null;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/sessions/${s.id}`}
                        className="tap flex items-center justify-between rounded-2xl border border-neutral-800 bg-[#141414] p-4 hover:border-emerald-600/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {s.dayName}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {s.exerciseCount}{" "}
                            {s.exerciseCount === 1 ? "exercise" : "exercises"}{" "}
                            · {s.setCount} {s.setCount === 1 ? "set" : "sets"}{" "}
                            · {formatVolume(s.totalVolume)} vol
                            {dur ? ` · ${dur}` : ""}
                          </p>
                        </div>
                        <span className="text-emerald-400" aria-hidden>
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
