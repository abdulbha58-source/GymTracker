import { NextRequest } from "next/server";
import { db } from "@/db";
import { exerciseSets, workoutSessions, exercises } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  computeProgress,
  getExerciseHistory,
} from "@/lib/stats-server";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
  all: null,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const [ex] = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      targetSets: exercises.targetSets,
      targetReps: exercises.targetReps,
    })
    .from(exercises)
    .where(eq(exercises.id, id));
  if (!ex) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const range = req.nextUrl.searchParams.get("range") ?? "all";
  const days = RANGE_DAYS[range] ?? null;
  const sinceDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
  const history = await getExerciseHistory(id, sinceDate);
  const stats = computeProgress(ex, history);
  return Response.json({ stats, range });
}
