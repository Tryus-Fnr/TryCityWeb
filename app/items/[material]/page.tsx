import ItemDetail from "@/components/ItemDetail";
import { getAdminStatus } from "@/lib/auth";
import { formatMaterialName } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ material: string }>;
}) {
  const { material } = await params;
  return { title: `${formatMaterialName(material)} – Item-Werte – TryCity` };
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ material: string }>;
}) {
  const { material } = await params;
  const isAdmin = await getAdminStatus();
  return <ItemDetail material={material.toUpperCase()} isAdmin={isAdmin} />;
}
