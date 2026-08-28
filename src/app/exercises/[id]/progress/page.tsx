import ProgressClient from "@/components/ProgressClient";

export const dynamic = "force-dynamic";

export default function ProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProgressClient params={params} />;
}
