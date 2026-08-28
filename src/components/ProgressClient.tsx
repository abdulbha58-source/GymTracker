"use client";

import { useEffect, useState, useCallback, use, useMemo } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
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

type Stats = {
  personalBest: number;
  heaviest: number;
  mostRecent: number;
  mostRecentVolume: number;
  personalBestVolume: number;
  totalWorkouts: number;
  totalSessions: number;
  isNewRecord: boolean;
  isVolumeRecord: boolean;
  previousTopWeight: number;
  previousTopReps: number;
  currentTopWeight: number;
  currentTopReps: number;
  weightDelta: number;
  volumeDelta: number;
  suggestedWeight: number | null;
  suggestedRationale: string | null;
  chart: Array<{ date: string; weight: number; volume: number; sessionId: number }>;
};

const RANGES: Array<{ key: string; label: string }> = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "3m" },
  { key: "180d", label: "6m" },
  { key: "365d", label: "1y" },
  { key: "all", label: "All" },
];

export default function ProgressClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [range, setRange] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [exRes, statsRes, histRes] = await Promise.all([
        fetch(`/api/exercises/${id}`, { cache: "no-store" }),
        fetch(`/api/exercises/${id}/stats?range=${range}`, {
          cache: "no-store",
        }),
        fetch(`/api/exercises/${id}/history`, { cache: "no-store" }),
      ]);
      if (exRes.status === 404) {
        setNotFound(true);
        return;
      }
      const ex = await exRes.json();
      setExercise(ex.exercise);
      const s = await statsRes.json();
      setStats(s.stats ?? null);
      const h = await histRes.json();
      setHistory(h.history ?? []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, range]);

  useEffect(() => {
    load();
  }, [load]);

  const sessionGroups = useMemo(() => {
    const map = new Map<
      number,
      { sessionId: number; date: string; sets: SetRow[]; topWeight: number; totalReps: number; totalVolume: number }
    >();
    for (const r of history) {
      const g = map.get(r.sessionId) ?? {
        sessionId: r.sessionId,
        date: r.date,
        sets: [],
        topWeight: 0,
        totalReps: 0,
        totalVolume: 0,
      };
      g.sets.push(r);
      if (r.weight > g.topWeight) g.topWeight = r.weight;
      g.totalReps += r.reps;
      g.totalVolume += r.weight * r.reps;
      map.set(r.sessionId, g);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [history]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-1/2 animate-pulse rounded bg-neutral-900" />
        <div className="h-56 animate-pulse rounded-2xl bg-[#141414]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#141414]" />
      </div>
    );
  }
  if (notFound || !exercise) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400">Exercise not found.</p>
        <Link href="/progress" className="text-sm text-emerald-400">
          ← Back to progress
        </Link>
      </div>
    );
  }

  const chartData = stats?.chart ?? [];
  const hasData = chartData.length > 0;
  const totalVolumeAll = sessionGroups.reduce(
    (acc, g) => acc + g.totalVolume,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/progress"
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          ← Progress
        </Link>
        <Link
          href={`/exercises/${id}`}
          className="tap rounded-md p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white"
          aria-label="Open exercise"
          title="Log"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M3 4h2v12H3V4zm12 0h2v12h-2V4zM6 6h8v2H6V6zm0 3h8v2H6V9zm0 3h8v2H6v-2z" />
          </svg>
        </Link>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          {exercise.workoutDayName}
        </p>
        <h1 className="text-2xl font-bold text-white">{exercise.name}</h1>
        <p className="text-sm text-neutral-400">Progress</p>
        {stats?.isNewRecord && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">
            🏆 New personal record
          </p>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Current"
            value={stats.mostRecent > 0 ? `${stats.mostRecent} kg` : "—"}
          />
          <Stat
            label="Heaviest"
            value={stats.personalBest > 0 ? `${stats.personalBest} kg` : "—"}
            highlight
          />
          <Stat
            label="Previous"
            value={
              stats.previousTopWeight > 0
                ? `${stats.previousTopWeight} kg`
                : "—"
            }
            sub={stats.previousTopReps > 0 ? `× ${stats.previousTopReps}` : undefined}
          />
          <Stat
            label="Weight Δ"
            value={
              stats.weightDelta === 0
                ? "—"
                : `${stats.weightDelta > 0 ? "+" : ""}${stats.weightDelta.toFixed(1)} kg`
            }
            positive={stats.weightDelta > 0}
            negative={stats.weightDelta < 0}
          />
          <Stat
            label="Total Workouts"
            value={stats.totalSessions.toString()}
            sub={`${stats.totalWorkouts} sets`}
          />
          <Stat
            label="Total Volume"
            value={formatVolume(totalVolumeAll)}
            sub="all time"
          />
        </div>
      )}

      {stats?.suggestedWeight !== null && stats?.suggestedWeight !== undefined && (
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Next time
          </p>
          <p className="mt-1 text-3xl font-extrabold text-emerald-300">
            Try {stats.suggestedWeight} kg
          </p>
          {stats.suggestedRationale && (
            <p className="mt-1 text-xs text-emerald-200/80">
              {stats.suggestedRationale}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-800 bg-[#141414] p-1">
        {RANGES.map((r) => {
          const active = r.key === range;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`tap flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "bg-emerald-500 text-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {hasData ? (
        <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Weight Progression
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData.map((c) => ({
                  dateLabel: formatDateShort(c.date),
                  weight: c.weight,
                  ts: new Date(c.date).getTime(),
                }))}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="gradWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: "#a3a3a3", fontSize: 11 }}
                  stroke="#404040"
                />
                <YAxis
                  tick={{ fill: "#a3a3a3", fontSize: 11 }}
                  stroke="#404040"
                  domain={["dataMin - 2", "dataMax + 2"]}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f0f0f",
                    border: "1px solid #404040",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#a3a3a3" }}
                  formatter={(v) => [`${v as number} kg`, "Top weight"]}
                />
                {stats && (
                  <ReferenceLine
                    y={stats.personalBest}
                    stroke="#22c55e"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#gradWeight)"
                  dot={{ r: 3, fill: "#22c55e" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-[#111] p-6 text-center text-sm text-neutral-400">
          No data in this range. Log a workout to see your progression.
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          History
        </h2>
        {sessionGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-[#111] p-6 text-center text-sm text-neutral-400">
            No sessions logged yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessionGroups.map((g) => (
              <li
                key={g.sessionId}
                className="rounded-2xl border border-neutral-800 bg-[#141414] p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {formatDateShort(g.date)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {g.sets.length} {g.sets.length === 1 ? "set" : "sets"} ·{" "}
                      {g.totalReps} reps · {formatVolume(g.totalVolume)} vol
                    </p>
                  </div>
                  <p className="text-lg font-bold text-emerald-400">
                    {g.topWeight} kg
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-3.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-0.5 text-xl font-bold ${
          highlight
            ? "text-emerald-400"
            : positive
            ? "text-emerald-400"
            : negative
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-neutral-500">{sub}</p>}
    </div>
  );
}
