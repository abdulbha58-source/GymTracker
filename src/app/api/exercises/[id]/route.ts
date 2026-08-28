import { NextRequest } from "next/server";
import { db } from "@/db";
import { exercises, workoutDays } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  const [row] = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      notes: exercises.notes,
      workoutDayId: exercises.workoutDayId,
      workoutDayName: workoutDays.name,
      targetSets: exercises.targetSets,
      targetReps: exercises.targetReps,
    })
    .from(exercises)
    .innerJoin(workoutDays, eq(workoutDays.id, exercises.workoutDayId))
    .where(eq(exercises.id, id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ exercise: row });
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
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = name;
  }
  if (typeof body?.notes === "string" || body?.notes === null) {
    updates.notes = body.notes ? String(body.notes).trim() : null;
  }
  if (body?.targetSets !== undefined) {
    const v = body.targetSets;
    if (v === null || v === "") updates.targetSets = null;
    else {
      const n = Number(v);
      if (Number.isInteger(n) && n > 0 && n < 100) updates.targetSets = n;
      else return Response.json({ error: "Invalid targetSets" }, { status: 400 });
    }
  }
  if (body?.targetReps !== undefined) {
    const v = body.targetReps;
    if (v === null || v === "") updates.targetReps = null;
    else {
      const n = Number(v);
      if (Number.isInteger(n) && n > 0 && n < 1000) updates.targetReps = n;
      else return Response.json({ error: "Invalid targetReps" }, { status: 400 });
    }
  }
  if (typeof body?.position === "number" && Number.isInteger(body.position)) {
    updates.position = body.position;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  const [row] = await db
    .update(exercises)
    .set(updates)
    .where(eq(exercises.id, id))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ exercise: row });
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
  await db.delete(exercises).where(eq(exercises.id, id));
  return Response.json({ ok: true });
}
