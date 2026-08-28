import WorkoutDayClient from "@/components/WorkoutDayClient";

export const dynamic = "force-dynamic";

export default function WorkoutDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <WorkoutDayClient params={params} />;
}
