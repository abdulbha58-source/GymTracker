import { db } from "@/db";
import { exercises } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(exercises)
    .orderBy(asc(exercises.workoutDayId), asc(exercises.position), asc(exercises.id));
  return Response.json({ exercises: rows });
}
