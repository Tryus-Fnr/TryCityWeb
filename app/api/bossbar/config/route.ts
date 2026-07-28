import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { setBossBarConfig } from "@/lib/bossbar";
import { describeDbError } from "@/lib/dbError";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/bossbar/config
 *   { enabled: boolean }           → Bossbar global an/aus
 *   { intervalSeconds: number }    → Wechselintervall in Sekunden
 */
export async function PATCH(req: Request) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (typeof body.enabled === "boolean") {
      await setBossBarConfig("enabled", String(body.enabled));
    }
    if (typeof body.intervalSeconds === "number") {
      const val = Math.max(3, Math.floor(body.intervalSeconds));
      await setBossBarConfig("interval-seconds", String(val));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[bossbar/config]", e);
    return NextResponse.json({ ok: false, error: describeDbError(e) }, { status: 500 });
  }
}

