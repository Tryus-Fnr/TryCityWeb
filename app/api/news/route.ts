import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import {
  createNewsPost,
  loadPublishedNews,
  loadAllNews,
} from "@/lib/news";
import { parseNewsInput } from "@/lib/newsInput";

export const dynamic = "force-dynamic";

/**
 * GET  /api/news              veröffentlichte Beiträge (öffentlich)
 * GET  /api/news?drafts=1     alle Beiträge inkl. Entwürfe (nur Admin)
 * POST /api/news              neuen Beitrag anlegen (nur Admin)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantsDrafts = url.searchParams.get("drafts") === "1";

  if (wantsDrafts) {
    if (!(await getAdminStatus())) {
      return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, posts: await loadAllNews() });
  }

  const limit = Number(url.searchParams.get("limit") ?? 50);
  const type = url.searchParams.get("type") ?? undefined;
  const posts = await loadPublishedNews(Number.isFinite(limit) ? limit : 50, type);
  return NextResponse.json({ ok: true, posts });
}

export async function POST(req: Request) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }

  const parsed = await parseNewsInput(req);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const id = await createNewsPost(parsed.input);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[news/create]", e);
    return NextResponse.json(
      { ok: false, error: "Beitrag konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
