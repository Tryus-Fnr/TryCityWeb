import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMod } from "@/lib/auth";
import {
  loadPlayerDetail,
  loadPlayerPunishments,
  loadPlayerFriends,
  loadPlayerClan,
  loadPlayerAltAccounts,
  loadPlayerAnticheatFlags,
} from "@/lib/queries";
import ModPlayerDetail from "@/components/mod/ModPlayerDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>;
}): Promise<Metadata> {
  const { uuid } = await params;
  return { title: `Spieler ${uuid} – Mod-Panel – TryCity` };
}

export default async function ModPlayerPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  await requireMod();
  const { uuid } = await params;

  const [player, punishments, friends, clan, altAccounts, anticheatFlags] = await Promise.all([
    loadPlayerDetail(uuid).catch(() => null),
    loadPlayerPunishments(uuid).catch(() => []),
    loadPlayerFriends(uuid).catch(() => []),
    loadPlayerClan(uuid).catch(() => null),
    loadPlayerAltAccounts(uuid).catch(() => []),
    loadPlayerAnticheatFlags(uuid).catch(() => []),
  ]);

  if (!player) notFound();

  return (
    <ModPlayerDetail
      player={player}
      punishments={punishments}
      friends={friends}
      clan={clan}
      altAccounts={altAccounts}
      anticheatFlags={anticheatFlags}
    />
  );
}

