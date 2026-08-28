import { db } from "@/db";
import { exerciseSets, exercises, workoutDays, workoutSessions } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  // For each exercise, compute the most recent session and overall PB
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      workoutDayId: exercises.workoutDayId,
      dayName: workoutDays.name,
      personalBest: sql<number>`COALESCE(MAX(${exerciseSets.weight}), 0)::float`,
    })
    .from(exercises)
    .innerJoin(workoutDays, eq(workoutDays.id, exercises.workoutDayId))
    .leftJoin(exerciseSets, eq(exerciseSets.exerciseId, exercises.id))
    .groupBy(exercises.id, exercises.name, exercises.workoutDayId, workoutDays.name)
    .orderBy(workoutDays.position, exercises.position);

  // For each, find most recent session stats
  const result: Array<{
    id: number;
    name: string;
    workoutDayId: number;
    dayName: string;
    personalBest: number;
    mostRecent: number;
    mostRecentVolume: number;
    totalSessions: number;
    isNewRecord: boolean;
  }> = [];

  for (const r of rows) {
    const [latest] = await db
      .select({
        id: workoutSessions.id,
        date: workoutSessions.date,
      })
      .from(workoutSessions)
      .innerJoin(exerciseSets, eq(exerciseSets.workoutSessionId, workoutSessions.id))
      .where(eq(exerciseSets.exerciseId, r.id))
      .orderBy(desc(workoutSessions.date))
      .limit(1);
    if (!latest) {
      result.push({
        id: r.id,
        name: r.name,
        workoutDayId: r.workoutDayId,
        dayName: r.dayName,
        personalBest: Number(r.personalBest) || 0,
        mostRecent: 0,
        mostRecentVolume: 0,
        totalSessions: 0,
        isNewRecord: false,
      });
      continue;
    }
    const [stats] = await db
      .select({
        topWeight: sql<number>`COALESCE(MAX(${exerciseSets.weight}), 0)::float`,
        totalVolume: sql<number>`COALESCE(SUM(${exerciseSets.weight} * ${exerciseSets.reps}), 0)::float`,
        totalSessions: sql<number>`COUNT(DISTINCT ${workoutSessions.id})::int`,
      })
      .from(workoutSessions)
      .innerJoin(exerciseSets, eq(exerciseSets.workoutSessionId, workoutSessions.id))
      .where(eq(exerciseSets.exerciseId, r.id));
    // The "most recent" is just topWeight of the latest session - we use the global MAX for "most recent top" here
    // For "isNewRecord", compare to all-time PB (which is the global MAX) — if most recent equals PB and there are 2+ sessions, it's a recent PR
    const isNewRecord =
      Number(stats?.topWeight ?? 0) >= Number(r.personalBest ?? 0) &&
      Number(stats?.topWeight ?? 0) > 0 &&
      Number(r.personalBest ?? 0) > 0 &&
      Number(stats?.totalSessions ?? 0) > 1;
    result.push({
      id: r.id,
      name: r.name,
      workoutDayId: r.workoutDayId,
      dayName: r.dayName,
      personalBest: Number(r.personalBest) || 0,
      mostRecent: Number(stats?.topWeight ?? 0),
      mostRecentVolume: Number(stats?.totalVolume ?? 0),
      totalSessions: Number(stats?.totalSessions ?? 0),
      isNewRecord,
    });
  }
  return Response.json({ exercises: result });
}
