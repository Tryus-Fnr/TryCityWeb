import ItemDetail from "@/components/ItemDetail";
import { getAdminStatus } from "@/lib/auth";
import { germanName } from "@/lib/itemNames.server";
import { loadSimilarItems, loadSparklinesFor } from "@/lib/queries";
import SimilarItems from "@/components/SimilarItems";
import { SetBreadcrumb } from "@/components/Breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ material: string }>;
}) {
  const { material } = await params;
  return { title: `${germanName(material.toUpperCase())} – Item-Werte – TryCity` };
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ material: string }>;
}) {
  const { material } = await params;
  const isAdmin = await getAdminStatus();
  const mat = material.toUpperCase();
  const name = germanName(mat);
  // Der deutsche Name kommt vom Server mit: so steht die Überschrift schon beim
  // ersten Anzeigen richtig da und springt nicht nachträglich um.
  // Serverseitig geladen, damit die Vorschläge direkt mit der Seite da sind
  // und keine zusätzliche Anfrage aus dem Browser brauchen.
  const similar = await loadSimilarItems(mat, 3).catch(() => []);
  const similarSparks = await loadSparklinesFor(similar.map((s) => s.material)).catch(() => ({}));

  return (
    <>
      <SetBreadcrumb label={name} />
      <ItemDetail material={mat} name={name} isAdmin={isAdmin} />
      <SimilarItems items={similar} sparklines={similarSparks} />
    </>
  );
}
