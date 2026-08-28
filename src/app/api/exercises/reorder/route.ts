import { NextRequest } from "next/server";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const workoutDayId = Number(body?.workoutDayId);
  const order: unknown = body?.order;
  if (
    !Number.isInteger(workoutDayId) ||
    !Array.isArray(order) ||
    !order.every((x) => Number.isInteger(x))
  ) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const ids = order as number[];
  if (ids.length === 0) return Response.json({ ok: true });

  const existing = await db
    .select({ id: exercises.id, workoutDayId: exercises.workoutDayId })
    .from(exercises)
    .where(inArray(exercises.id, ids));
  if (
    existing.length !== ids.length ||
    existing.some((e) => e.workoutDayId !== workoutDayId)
  ) {
    return Response.json({ error: "Invalid exercise set" }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(exercises)
        .set({ position: i })
        .where(eq(exercises.id, ids[i]));
    }
  });
  return Response.json({ ok: true });
}
