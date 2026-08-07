import { LIMITS, isNewsType, type NewsInput, type NewsImageInput } from "@/lib/newsTypes";

/**
 * Liest und prüft den Beitrags-Body einer POST/PATCH-Anfrage.
 *
 * Die Prüfung ist bewusst streng: der Text landet unverändert in der Datenbank
 * und wird sowohl im Web als auch ingame gerendert. Bilder kommen als Data-URL
 * aus dem Editor und werden hier auf Base64 reduziert.
 */
export async function parseNewsInput(
  req: Request
): Promise<{ input: NewsInput } | { error: string }> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return { error: "Ungültige Anfrage." };
  }

  const type = String(body.type ?? "");
  if (!isNewsType(type)) return { error: "Unbekannter Beitragstyp." };

  const title = String(body.title ?? "").trim();
  if (!title) return { error: "Der Titel darf nicht leer sein." };
  if (title.length > LIMITS.title) {
    return { error: `Der Titel darf höchstens ${LIMITS.title} Zeichen haben.` };
  }

  const summary = String(body.summary ?? "").trim();
  if (summary.length > LIMITS.summary) {
    return { error: `Die Kurzfassung darf höchstens ${LIMITS.summary} Zeichen haben.` };
  }

  const text = String(body.body ?? "");
  if (text.length > LIMITS.body) {
    return { error: "Der Beitragstext ist zu lang." };
  }

  // Mehrere Verfasser sind erlaubt; ältere Aufrufer schicken noch ein einzelnes
  // authorName, das wird hier mit aufgenommen.
  const rawAuthors = Array.isArray(body.authorNames)
    ? body.authorNames
    : body.authorName !== undefined
      ? [body.authorName]
      : [];
  const authorNames: string[] = [];
  for (const raw of rawAuthors) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      return { error: `„${name}" ist kein gültiger Minecraft-Name (3–16 Zeichen, A–Z, 0–9, _).` };
    }
    if (authorNames.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    authorNames.push(name);
  }
  if (authorNames.length === 0) {
    return { error: "Es muss mindestens ein Verfasser angegeben sein." };
  }
  if (authorNames.length > LIMITS.authors) {
    return { error: `Es sind höchstens ${LIMITS.authors} Verfasser möglich.` };
  }

  const rawImages = Array.isArray(body.images) ? body.images : [];
  if (rawImages.length > LIMITS.images) {
    return { error: `Es sind höchstens ${LIMITS.images} Bilder pro Beitrag möglich.` };
  }

  const images: NewsImageInput[] = [];
  for (const raw of rawImages) {
    const img = raw as Record<string, unknown>;
    const idx = Number(img.idx);
    if (!Number.isInteger(idx) || idx < 1) return { error: "Ungültiger Bild-Index." };

    const { mime, data } = splitDataUrl(String(img.data ?? ""));
    if (!data) return { error: "Ein Bild konnte nicht gelesen werden." };
    if (!/^image\/(png|jpeg|gif|webp)$/.test(mime)) {
      return { error: "Erlaubt sind nur PNG-, JPEG-, GIF- und WebP-Bilder." };
    }
    if (data.length > LIMITS.imageData) {
      return { error: "Ein Bild ist zu groß (maximal etwa 2 MB)." };
    }

    images.push({
      idx,
      mime,
      caption: String(img.caption ?? "").trim(),
      data,
    });
  }

  return {
    input: {
      type,
      title,
      summary,
      body: text,
      authorNames,
      published: body.published !== false,
      pinned: body.pinned === true,
      images,
    },
  };
}

/** `data:image/png;base64,AAA…` → `{ mime, data }`; sonst leere Werte. */
function splitDataUrl(value: string): { mime: string; data: string } {
  const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) return { mime: "", data: "" };
  return { mime: match[1].toLowerCase(), data: match[2].replace(/\s+/g, "") };
}
