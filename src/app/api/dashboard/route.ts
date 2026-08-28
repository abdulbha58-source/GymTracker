import { db } from "@/db";
import { exerciseSets, exercises, workoutDays, workoutSessions } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const recent = await db
    .select({
      id: workoutSessions.id,
      date: workoutSessions.date,
      notes: workoutSessions.notes,
      workoutDayId: workoutSessions.workoutDayId,
      dayName: workoutDays.name,
      startedAt: workoutSessions.startedAt,
      endedAt: workoutSessions.endedAt,
      setCount: sql<number>`(SELECT COUNT(*)::int FROM ${exerciseSets} WHERE ${exerciseSets.workoutSessionId} = ${workoutSessions.id})`,
      totalVolume: sql<number>`COALESCE((SELECT SUM(${exerciseSets.weight} * ${exerciseSets.reps})::float FROM ${exerciseSets} WHERE ${exerciseSets.workoutSessionId} = ${workoutSessions.id}), 0)`,
    })
    .from(workoutSessions)
    .innerJoin(workoutDays, eq(workoutDays.id, workoutSessions.workoutDayId))
    .orderBy(desc(workoutSessions.date))
    .limit(10);

  const personalBests = await db
    .select({
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      workoutDayId: exercises.workoutDayId,
      dayName: workoutDays.name,
      topWeight: sql<number>`COALESCE(MAX(${exerciseSets.weight}), 0)::float`,
      topVolume: sql<number>`COALESCE(MAX(${exerciseSets.weight} * ${exerciseSets.reps}), 0)::float`,
    })
    .from(exercises)
    .innerJoin(workoutDays, eq(workoutDays.id, exercises.workoutDayId))
    .leftJoin(exerciseSets, eq(exerciseSets.exerciseId, exercises.id))
    .groupBy(exercises.id, exercises.name, exercises.workoutDayId, workoutDays.name)
    .orderBy(desc(sql`MAX(${exerciseSets.weight})`))
    .limit(5);

  const [{ totalSessions }] = await db
    .select({ totalSessions: sql<number>`COUNT(*)::int` })
    .from(workoutSessions);

  const [{ totalDays }] = await db
    .select({ totalDays: sql<number>`COUNT(*)::int` })
    .from(workoutDays);

  const [{ totalSets }] = await db
    .select({ totalSets: sql<number>`COUNT(*)::int` })
    .from(exerciseSets);

  const [{ totalExercises }] = await db
    .select({ totalExercises: sql<number>`COUNT(*)::int` })
    .from(exercises);

  const [{ personalBest }] = await db
    .select({ personalBest: sql<number>`COALESCE(MAX(${exerciseSets.weight}), 0)::float` })
    .from(exerciseSets);

  return Response.json({
    recent,
    personalBests,
    totals: {
      totalSessions,
      totalDays,
      totalExercises,
      totalSets,
      personalBest,
    },
  });
}
