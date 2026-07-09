import ItemDetail from "@/components/ItemDetail";
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
  return <ItemDetail material={material.toUpperCase()} />;
}
