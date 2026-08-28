import { NextRequest } from "next/server";
import { db } from "@/db";
import { exerciseSets, workoutSessions, exercises } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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
  // Confirm exercise exists
  const [ex] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.id, id));
  if (!ex) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const rows = await db
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
    .where(eq(exerciseSets.exerciseId, id))
    .orderBy(desc(workoutSessions.date), exerciseSets.setNumber);

  return Response.json({ history: rows });
}
