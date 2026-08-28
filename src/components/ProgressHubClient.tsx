"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";

type Exercise = {
  id: number;
  name: string;
  workoutDayId: number;
  dayName: string;
  personalBest: number;
  mostRecent: number;
  mostRecentVolume: number;
  totalSessions: number;
  isNewRecord: boolean;
};

export default function ProgressHubClient() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      const j = await res.json();
      setExercises(j.exercises ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Progress</h1>
        <p className="text-sm text-neutral-400">
          Track every exercise over time.
        </p>
      </div>
      <input
        type="search"
        placeholder="Search exercises…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-neutral-800 bg-[#0f0f0f] px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-500"
      />
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-[#141414]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matches" : "No exercises yet"}
          description={
            search
              ? "Try a different search term."
              : "Create workout days and add exercises to start tracking."
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((ex) => (
            <li key={ex.id}>
              <Link
                href={`/exercises/${ex.id}/progress`}
                className="tap flex items-center justify-between rounded-2xl border border-neutral-800 bg-[#141414] p-4 hover:border-emerald-600/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {ex.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {ex.dayName} · {ex.totalSessions}{" "}
                    {ex.totalSessions === 1 ? "session" : "sessions"}
                  </p>
                </div>
                <div className="text-right">
                  {ex.personalBest > 0 && (
                    <p className="text-base font-bold text-emerald-400">
                      {ex.personalBest} kg
                    </p>
                  )}
                  {ex.isNewRecord && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                      🏆 Recent PR
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
