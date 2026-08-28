import "server-only";
import { exerciseSets, exercises, workoutSessions } from "@/db/schema";
import { db } from "@/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export type SetRow = {
  id: number;
  setNumber: number;
  weight: number;
  reps: number;
  sessionId: number;
  date: Date;
};

export async function getExerciseHistory(
  exerciseId: number,
  sinceDate?: Date,
): Promise<SetRow[]> {
  const baseQuery = db
    .select({
      id: exerciseSets.id,
      setNumber: exerciseSets.setNumber,
      weight: exerciseSets.weight,
      reps: exerciseSets.reps,
      sessionId: exerciseSets.workoutSessionId,
      date: workoutSessions.date,
    })
    .from(exerciseSets)
    .innerJoin(
      workoutSessions,
      eq(workoutSessions.id, exerciseSets.workoutSessionId),
    )
    .where(
      sinceDate
        ? and(
            eq(exerciseSets.exerciseId, exerciseId),
            gte(workoutSessions.date, sinceDate),
          )
        : eq(exerciseSets.exerciseId, exerciseId),
    )
    .orderBy(desc(workoutSessions.date), desc(exerciseSets.setNumber));

  const rows = await baseQuery;
  return rows.map((r) => ({
    id: r.id,
    setNumber: r.setNumber,
    weight: r.weight,
    reps: r.reps,
    sessionId: r.sessionId,
    date: r.date,
  }));
}

export type SessionGroup = {
  sessionId: number;
  date: Date;
  sets: SetRow[];
  totalSets: number;
  topWeight: number;
  topRepsAtTopWeight: number;
  totalReps: number;
  totalVolume: number;
  averageReps: number;
};

export function groupBySession(rows: SetRow[]): SessionGroup[] {
  const map = new Map<number, SessionGroup>();
  for (const r of rows) {
    const key = r.sessionId;
    const g =
      map.get(key) ??
      ({
        sessionId: key,
        date: r.date,
        sets: [],
        totalSets: 0,
        topWeight: 0,
        topRepsAtTopWeight: 0,
        totalReps: 0,
        totalVolume: 0,
        averageReps: 0,
      } as SessionGroup);
    g.sets.push(r);
    g.totalSets += 1;
    g.totalReps += r.reps;
    g.totalVolume += r.weight * r.reps;
    if (r.weight > g.topWeight) {
      g.topWeight = r.weight;
      g.topRepsAtTopWeight = r.reps;
    } else if (r.weight === g.topWeight && r.reps > g.topRepsAtTopWeight) {
      g.topRepsAtTopWeight = r.reps;
    }
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.averageReps = g.totalSets > 0 ? g.totalReps / g.totalSets : 0;
  }
  return Array.from(map.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

export type ProgressStats = {
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

export function computeProgress(
  exercise: { id: number; targetSets?: number | null; targetReps?: number | null },
  history: SetRow[],
  weightIncrement: number = 2.5,
): ProgressStats {
  const sessions = groupBySession(history);
  const totalSessions = sessions.length;
  const totalWorkouts = sessions.reduce((acc, s) => acc + s.totalSets, 0);

  const personalBest = sessions.reduce(
    (acc, s) => (s.topWeight > acc ? s.topWeight : acc),
    0,
  );
  const personalBestVolume = sessions.reduce(
    (acc, s) => (s.totalVolume > acc ? s.totalVolume : acc),
    0,
  );
  const mostRecent = sessions[0]?.topWeight ?? 0;
  const mostRecentVolume = sessions[0]?.totalVolume ?? 0;

  const chronological = [...sessions].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const chart = chronological.map((s) => ({
    date: s.date.toISOString(),
    weight: s.topWeight,
    volume: s.totalVolume,
    sessionId: s.sessionId,
  }));

  const previousSession = sessions[1];
  const previousTopWeight = previousSession?.topWeight ?? 0;
  const previousTopReps = previousSession?.topRepsAtTopWeight ?? 0;
  const currentTopWeight = mostRecent;
  const currentTopReps = sessions[0]?.topRepsAtTopWeight ?? 0;
  const weightDelta = currentTopWeight - previousTopWeight;
  const volumeDelta = mostRecentVolume - (previousSession?.totalVolume ?? 0);

  const isNewRecord =
    currentTopWeight > 0 && currentTopWeight > personalBest - 1e-6 &&
    sessions.length > 1 && currentTopWeight > previousTopWeight;
  const isVolumeRecord =
    mostRecentVolume > 0 &&
    mostRecentVolume > personalBestVolume - 1e-6 &&
    sessions.length > 1 &&
    mostRecentVolume > (previousSession?.totalVolume ?? 0);

  // Suggestion is based on the *most recent* session (sessions[0])
  const mostRecentSession = sessions[0];
  let suggestedWeight: number | null = null;
  let suggestedRationale: string | null = null;
  if (mostRecentSession) {
    const targetSets = exercise.targetSets ?? null;
    const targetReps = exercise.targetReps ?? null;
    const lastTop = mostRecentSession.topWeight;
    if (targetSets && targetReps) {
      const allMetTarget = mostRecentSession.sets.every(
        (s) => s.reps >= targetReps,
      );
      const enoughSets = mostRecentSession.totalSets >= targetSets;
      if (allMetTarget && enoughSets) {
        suggestedWeight = roundToIncrement(
          lastTop + weightIncrement,
          weightIncrement,
        );
        suggestedRationale = `You hit ${mostRecentSession.totalSets}×${targetReps} last time — try +${weightIncrement} kg.`;
      } else {
        suggestedWeight = lastTop;
        suggestedRationale = `Repeat the same weight (${lastTop} kg) until all reps are completed.`;
      }
    } else {
      suggestedWeight = lastTop;
      suggestedRationale = `Set target reps & sets on this exercise to unlock smart suggestions.`;
    }
  }

  return {
    personalBest,
    heaviest: personalBest,
    mostRecent,
    mostRecentVolume,
    personalBestVolume,
    totalWorkouts,
    totalSessions,
    isNewRecord,
    isVolumeRecord,
    previousTopWeight,
    previousTopReps,
    currentTopWeight,
    currentTopReps,
    weightDelta,
    volumeDelta,
    suggestedWeight,
    suggestedRationale,
    chart,
  };
}

function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return weight;
  return Math.round(weight / increment) * increment;
}

export async function getLastSessionForExercise(
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SessionGroup | null> {
  const history = await getExerciseHistory(exerciseId);
  const grouped = groupBySession(history);
  if (excludeSessionId !== undefined) {
    return grouped.find((g) => g.sessionId !== excludeSessionId) ?? null;
  }
  return grouped[0] ?? null;
}
