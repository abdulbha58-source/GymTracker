import { NextRequest } from "next/server";
import { db } from "@/db";
import { exerciseSets, exercises, workoutDays, workoutSessions } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const [day] = await db
    .select()
    .from(workoutDays)
    .where(eq(workoutDays.id, id));
  if (!day) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const exs = await db
    .select()
    .from(exercises)
    .where(eq(exercises.workoutDayId, id))
    .orderBy(asc(exercises.position), asc(exercises.id));

  const result: Array<{
    id: number;
    name: string;
    notes: string | null;
    targetSets: number | null;
    targetReps: number | null;
    workoutDayId: number;
    workoutDayName: string;
    lastSession: null | {
      sessionId: number;
      date: string;
      topWeight: number;
      reps: number;
      totalReps: number;
      totalVolume: number;
      sets: { setNumber: number; weight: number; reps: number }[];
    };
  }> = [];

  for (const ex of exs) {
    const [latestSession] = await db
      .select({
        id: workoutSessions.id,
        date: workoutSessions.date,
      })
      .from(workoutSessions)
      .innerJoin(exerciseSets, eq(exerciseSets.workoutSessionId, workoutSessions.id))
      .where(eq(exerciseSets.exerciseId, ex.id))
      .orderBy(desc(workoutSessions.date))
      .limit(1);
    let lastSession: (typeof result)[number]["lastSession"] = null;
    if (latestSession) {
      const sets = await db
        .select({
          setNumber: exerciseSets.setNumber,
          weight: exerciseSets.weight,
          reps: exerciseSets.reps,
        })
        .from(exerciseSets)
        .where(
          and(
            eq(exerciseSets.exerciseId, ex.id),
            eq(exerciseSets.workoutSessionId, latestSession.id),
          ),
        )
        .orderBy(asc(exerciseSets.setNumber));
      const topWeight = sets.reduce((acc, s) => (s.weight > acc ? s.weight : acc), 0);
      const reps = sets[0]?.reps ?? 0;
      const totalReps = sets.reduce((acc, s) => acc + s.reps, 0);
      const totalVolume = sets.reduce((acc, s) => acc + s.weight * s.reps, 0);
      lastSession = {
        sessionId: latestSession.id,
        date: latestSession.date.toISOString(),
        topWeight,
        reps,
        totalReps,
        totalVolume,
        sets,
      };
    }
    result.push({
      id: ex.id,
      name: ex.name,
      notes: ex.notes,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      workoutDayId: ex.workoutDayId,
      workoutDayName: day.name,
      lastSession,
    });
  }
  return Response.json({
    day: { id: day.id, name: day.name, description: day.description },
    exercises: result,
  });
}
