import SessionClient from "@/components/SessionClient";

export const dynamic = "force-dynamic";

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SessionClient params={params} />;
}
