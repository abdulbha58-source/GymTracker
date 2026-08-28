import { NextRequest } from "next/server";
import { db } from "@/db";
import { exerciseSets, workoutSessions, workoutDays, exercises } from "@/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const workoutDayId = Number(body?.workoutDayId);
  const setsInput: Array<{
    exerciseId: number;
    setNumber: number;
    weight: number;
    reps: number;
  }> = Array.isArray(body?.sets) ? body.sets : [];
  const notes = body?.notes ? String(body.notes).trim() : null;
  const date = body?.date ? new Date(body.date) : new Date();
  const sessionId = body?.sessionId ? Number(body.sessionId) : null;
  const startedAt = body?.startedAt ? new Date(body.startedAt) : null;
  const endedAt = body?.endedAt ? new Date(body.endedAt) : null;

  if (!Number.isInteger(workoutDayId)) {
    return Response.json(
      { error: "workoutDayId is required" },
      { status: 400 },
    );
  }
  if (setsInput.length === 0) {
    return Response.json({ error: "No sets provided" }, { status: 400 });
  }
  for (const s of setsInput) {
    if (
      !Number.isInteger(s.exerciseId) ||
      !Number.isInteger(s.setNumber) ||
      typeof s.weight !== "number" ||
      !Number.isFinite(s.weight) ||
      s.weight < 0 ||
      !Number.isInteger(s.reps) ||
      s.reps < 0
    ) {
      return Response.json({ error: "Invalid set payload" }, { status: 400 });
    }
  }

  const [day] = await db
    .select()
    .from(workoutDays)
    .where(eq(workoutDays.id, workoutDayId));
  if (!day) {
    return Response.json({ error: "Workout day not found" }, { status: 404 });
  }

  let session;
  if (sessionId && Number.isInteger(sessionId)) {
    const [existing] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId));
    if (existing && existing.workoutDayId === workoutDayId) {
      const updateVals: { date: Date; startedAt?: Date; endedAt?: Date; notes?: string | null } = {
        date,
      };
      if (startedAt) updateVals.startedAt = startedAt;
      if (endedAt) updateVals.endedAt = endedAt;
      if (notes !== null) updateVals.notes = notes;
      [session] = await db
        .update(workoutSessions)
        .set(updateVals)
        .where(eq(workoutSessions.id, sessionId))
        .returning();
      // Remove old sets for this exerciseIds so we can re-insert cleanly
      const exerciseIds = Array.from(new Set(setsInput.map((s) => s.exerciseId)));
      if (exerciseIds.length > 0) {
        await db
          .delete(exerciseSets)
          .where(
            sql`${exerciseSets.workoutSessionId} = ${sessionId} AND ${exerciseSets.exerciseId} = ANY(${exerciseIds})`,
          );
      }
    }
  }

  if (!session) {
    const insertVals: {
      workoutDayId: number;
      date: Date;
      notes: string | null;
      startedAt?: Date;
      endedAt?: Date;
    } = {
      workoutDayId,
      notes,
      date,
    };
    if (startedAt) insertVals.startedAt = startedAt;
    if (endedAt) insertVals.endedAt = endedAt;
    [session] = await db.insert(workoutSessions).values(insertVals).returning();
  }

  const insertRows = setsInput.map((s) => ({
    workoutSessionId: session.id,
    exerciseId: s.exerciseId,
    setNumber: s.setNumber,
    weight: s.weight,
    reps: s.reps,
  }));
  const inserted = await db
    .insert(exerciseSets)
    .values(insertRows)
    .returning();

  return Response.json({ session, sets: inserted });
}
