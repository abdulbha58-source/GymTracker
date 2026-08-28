import { NextRequest } from "next/server";
import { db } from "@/db";
import { workoutDays } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const order: unknown = body?.order;
  if (!Array.isArray(order) || !order.every((x) => Number.isInteger(x))) {
    return Response.json({ error: "order must be an array of integer ids" }, { status: 400 });
  }
  const ids = order as number[];
  if (ids.length === 0) return Response.json({ ok: true });

  // Verify all ids exist
  const existing = await db
    .select({ id: workoutDays.id })
    .from(workoutDays)
    .where(inArray(workoutDays.id, ids));
  if (existing.length !== ids.length) {
    return Response.json({ error: "Some ids not found" }, { status: 400 });
  }
  // Update positions in a transaction
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(workoutDays)
        .set({ position: i })
        .where(eq(workoutDays.id, ids[i]));
    }
  });
  return Response.json({ ok: true });
}
