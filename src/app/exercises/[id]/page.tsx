import ExerciseClient from "@/components/ExerciseClient";

export const dynamic = "force-dynamic";

export default function ExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ExerciseClient params={params} />;
}
