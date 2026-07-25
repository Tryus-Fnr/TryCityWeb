import type { Metadata } from "next";
import ServiceDetail from "@/components/infra/ServiceDetail";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  return { title: `${decodeURIComponent(name)} – Infrastruktur` };
}

export default async function ServicePage({ params }: { params: Promise<{ name: string }> }) {
  await requireAdmin();
  const { name } = await params;
  return <ServiceDetail serviceName={decodeURIComponent(name)} />;
}
