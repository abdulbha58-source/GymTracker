import { NextRequest } from "next/server";
import { db } from "@/db";
import { exercises, workoutDays } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const workoutDayId = Number(body?.workoutDayId);
  const name = String(body?.name ?? "").trim();
  const notes = body?.notes ? String(body.notes).trim() : null;
  const targetSets =
    body?.targetSets === null || body?.targetSets === undefined
      ? null
      : Number(body.targetSets);
  const targetReps =
    body?.targetReps === null || body?.targetReps === undefined
      ? null
      : Number(body.targetReps);

  if (!Number.isInteger(workoutDayId) || !name) {
    return Response.json(
      { error: "workoutDayId and name are required" },
      { status: 400 },
    );
  }
  const [day] = await db
    .select()
    .from(workoutDays)
    .where(eq(workoutDays.id, workoutDayId));
  if (!day) {
    return Response.json({ error: "Workout day not found" }, { status: 404 });
  }
  const [{ next }] = await db
    .select({ next: sql<number>`COALESCE(MAX(${exercises.position}), -1) + 1` })
    .from(exercises)
    .where(eq(exercises.workoutDayId, workoutDayId));

  const [row] = await db
    .insert(exercises)
    .values({
      workoutDayId,
      name,
      notes,
      position: next,
      targetSets: Number.isInteger(targetSets) && targetSets! > 0 ? targetSets : null,
      targetReps: Number.isInteger(targetReps) && targetReps! > 0 ? targetReps : null,
    })
    .returning();
  return Response.json({ exercise: row });
}
