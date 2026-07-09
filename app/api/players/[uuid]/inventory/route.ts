import { NextResponse } from "next/server";
import { loadPlayerRawInventory } from "@/lib/queries";
import { parseInventoryBase64 } from "@/lib/nbtParser";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  try {
    const raw = await loadPlayerRawInventory(uuid);
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Keine Inventardaten gefunden." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      inventory:   parseInventoryBase64(raw.inventory),
      enderChest:  parseInventoryBase64(raw.ender_chest),
      armor:       parseInventoryBase64(raw.armor),
      offhand:     parseInventoryBase64(raw.offhand),
    });
  } catch (e) {
    console.error("[api/players/[uuid]/inventory]", e);
    return NextResponse.json({ ok: false, error: "Datenbank nicht erreichbar." }, { status: 500 });
  }
}

