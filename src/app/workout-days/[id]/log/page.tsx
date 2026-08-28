import LogWorkoutClient from "@/components/LogWorkoutClient";

export const dynamic = "force-dynamic";

export default function LogWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <LogWorkoutClient params={params} />;
}
