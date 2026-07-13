import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSessionRevoked, loadClanDetail } from "@/lib/queries";
import ClanDetailView from "@/components/clan/ClanDetailView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const clanId = parseInt(id, 10);
  if (isNaN(clanId)) return { title: "Clan – TryCity" };
  const clan = await loadClanDetail(clanId).catch(() => null);
  return { title: clan ? `${clan.tag} ${clan.name} – TryCity` : "Clan – TryCity" };
}

export default async function ClanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clanId = parseInt(id, 10);
  if (isNaN(clanId)) notFound();

  const clan = await loadClanDetail(clanId).catch(() => null);
  if (!clan) notFound();

  // Session prüfen für erweiterte Ansicht
  let memberUuid: string | null = null;
  try {
    const session = await getSession();
    if (session?.uuid) {
      const revoked = await isSessionRevoked(session.uuid, session.issuedAt);
      if (!revoked) {
        const isMember = clan.members.some((m) => m.uuid === session.uuid);
        if (isMember) memberUuid = session.uuid;
      }
    }
  } catch {
    // Keine Session – nur öffentliche Ansicht
  }

  return <ClanDetailView clan={clan} memberUuid={memberUuid} />;
}

