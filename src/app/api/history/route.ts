import { db } from "@/db";
import { exerciseSets, exercises, workoutDays, workoutSessions } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await db
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
      exerciseCount: sql<number>`(SELECT COUNT(DISTINCT ${exerciseSets.exerciseId})::int FROM ${exerciseSets} WHERE ${exerciseSets.workoutSessionId} = ${workoutSessions.id})`,
    })
    .from(workoutSessions)
    .innerJoin(workoutDays, eq(workoutDays.id, workoutSessions.workoutDayId))
    .orderBy(desc(workoutSessions.date));

  return Response.json({ sessions });
}
