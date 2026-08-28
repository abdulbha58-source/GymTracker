import { NextRequest } from "next/server";
import { db } from "@/db";
import { workoutDays, exercises, workoutDays as wd } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";

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
  const [day] = await db.select().from(workoutDays).where(eq(workoutDays.id, id));
  if (!day) return Response.json({ error: "Not found" }, { status: 404 });
  const dayExercises = await db
    .select()
    .from(exercises)
    .where(eq(exercises.workoutDayId, id))
    .orderBy(asc(exercises.position), asc(exercises.id));
  return Response.json({ day, exercises: dayExercises });
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
  if (typeof body?.description === "string" || body?.description === null) {
    updates.description = body.description ? String(body.description).trim() : null;
  }
  if (typeof body?.position === "number" && Number.isInteger(body.position)) {
    updates.position = body.position;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  const [row] = await db
    .update(workoutDays)
    .set(updates)
    .where(eq(workoutDays.id, id))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ day: row });
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
  await db.delete(workoutDays).where(eq(workoutDays.id, id));
  return Response.json({ ok: true });
}
