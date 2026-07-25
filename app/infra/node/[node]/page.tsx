import type { Metadata } from "next";
import NodeDetail from "@/components/infra/NodeDetail";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ node: string }>;
}): Promise<Metadata> {
  const { node } = await params;
  return { title: `${decodeURIComponent(node)} – Infrastruktur` };
}

export default async function NodePage({ params }: { params: Promise<{ node: string }> }) {
  await requireAdmin();
  const { node } = await params;
  return <NodeDetail nodeId={decodeURIComponent(node)} />;
}
