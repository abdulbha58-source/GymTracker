import { NextRequest } from "next/server";
import { db } from "@/db";
import { exerciseSets, exercises, workoutDays, workoutSessions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

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
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, id));
  if (!session) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const [day] = await db
    .select()
    .from(workoutDays)
    .where(eq(workoutDays.id, session.workoutDayId));
  const sets = await db
    .select({
      id: exerciseSets.id,
      setNumber: exerciseSets.setNumber,
      weight: exerciseSets.weight,
      reps: exerciseSets.reps,
      exerciseId: exerciseSets.exerciseId,
      exerciseName: exercises.name,
      workoutDayId: exercises.workoutDayId,
    })
    .from(exerciseSets)
    .innerJoin(exercises, eq(exercises.id, exerciseSets.exerciseId))
    .where(eq(exerciseSets.workoutSessionId, id))
    .orderBy(asc(exerciseSets.exerciseId), asc(exerciseSets.setNumber));

  return Response.json({
    session: {
      ...session,
      workoutDayName: day?.name ?? "Unknown",
    },
    sets,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (body?.endedAt) updates.endedAt = new Date(body.endedAt);
  if (typeof body?.notes === "string" || body?.notes === null) {
    updates.notes = body.notes ? String(body.notes).trim() : null;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  const [row] = await db
    .update(workoutSessions)
    .set(updates)
    .where(eq(workoutSessions.id, id))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ session: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  await db.delete(workoutSessions).where(eq(workoutSessions.id, id));
  return Response.json({ ok: true });
}
