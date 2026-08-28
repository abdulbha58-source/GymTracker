import { NextRequest } from "next/server";
import { db } from "@/db";
import { exercises, workoutDays, workoutSessions } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: workoutDays.id,
      name: workoutDays.name,
      description: workoutDays.description,
      position: workoutDays.position,
      createdAt: workoutDays.createdAt,
      exerciseCount: sql<number>`(SELECT COUNT(*)::int FROM ${exercises} WHERE ${exercises.workoutDayId} = ${workoutDays.id})`,
      sessionCount: sql<number>`(SELECT COUNT(*)::int FROM ${workoutSessions} WHERE ${workoutSessions.workoutDayId} = ${workoutDays.id})`,
      lastTrainedAt: sql<Date | null>`(SELECT MAX(${workoutSessions.date}) FROM ${workoutSessions} WHERE ${workoutSessions.workoutDayId} = ${workoutDays.id})`,
    })
    .from(workoutDays)
    .orderBy(asc(workoutDays.position), asc(workoutDays.id));

  return Response.json({ days: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const description = body?.description ? String(body.description).trim() : null;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const [{ next }] = await db
    .select({ next: sql<number>`COALESCE(MAX(${workoutDays.position}), -1) + 1` })
    .from(workoutDays);
  const [row] = await db
    .insert(workoutDays)
    .values({ name, description, position: next })
    .returning();
  return Response.json({ day: row });
}
