import {
  FEEDBACK_LIMITS,
  isSuggestionCategory,
  type SuggestionCategoryId,
} from "@/lib/feedbackTypes";
import type { BugImageInput } from "@/lib/feedback";

/**
 * Prüfung aller Eingaben, die Spieler selbst schicken.
 *
 * Anders als im Admin-Bereich sitzt hier niemand mit Vertrauensvorschuss am
 * anderen Ende. Alles kommt roh an und wird hier zurechtgestutzt, bevor es die
 * Datenbank sieht:
 *
 *  - Der Rohtext der Anfrage wird gedeckelt, bevor er überhaupt geparst wird.
 *  - Texte verlieren Steuerzeichen und unsichtbare Zeichen.
 *  - Bilder müssen wirklich Bilder sein: Kennung im Datenkopf, Größe im Rahmen,
 *    Kantenlänge plausibel. Was nicht sicher zu erkennen ist, fliegt raus.
 *
 * Ausgeliefert werden Bilder später ausschließlich mit dem hier festgestellten
 * Typ und `nosniff` – ein als PNG getarntes HTML kann so nirgends ausgeführt
 * werden.
 */

/** Grenze für den Rohtext einer Anfrage: drei Bilder plus Text passen locker. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Liest den Body einer Anfrage mit harter Größengrenze.
 *
 * `req.json()` würde erst alles einsammeln und dann parsen – bei einem
 * 200-MB-Wurf wäre der Speicher vorher weg. Deshalb zuerst als Text holen und
 * die Länge prüfen.
 */
export async function readJsonBody(
  req: Request
): Promise<{ body: Record<string, unknown> } | { error: string }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return { error: "Die Anfrage ist zu groß. Bitte weniger oder kleinere Bilder anhängen." };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { error: "Die Anfrage konnte nicht gelesen werden." };
  }
  if (text.length > MAX_BODY_BYTES) {
    return { error: "Die Anfrage ist zu groß. Bitte weniger oder kleinere Bilder anhängen." };
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "Ungültige Anfrage." };
    }
    return { body: parsed as Record<string, unknown> };
  } catch {
    return { error: "Ungültige Anfrage." };
  }
}

// ─── Text ───────────────────────────────────────────────────────────────────

/**
 * Räumt einen Fließtext auf: Steuerzeichen und unsichtbare Zeichen raus,
 * Zeilenenden vereinheitlichen, höchstens eine Leerzeile am Stück.
 *
 * Die unsichtbaren Zeichen sind kein Schönheitsproblem: mit ihnen lassen sich
 * Wortfilter umgehen und Beiträge bauen, die anders aussehen als sie sind.
 */
export function cleanMultiline(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // Steuerzeichen außer Zeilenumbruch
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    // Zero-Width-Zeichen und Richtungsmarken
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Wie {@link cleanMultiline}, aber für einzeilige Felder (Titel). */
export function cleanLine(raw: string): string {
  return cleanMultiline(raw).replace(/\s+/g, " ").trim();
}

function checkLength(
  value: string,
  min: number,
  max: number,
  was: string
): string | null {
  if (value.length < min) return `${was} muss mindestens ${min} Zeichen haben.`;
  if (value.length > max) return `${was} darf höchstens ${max} Zeichen haben.`;
  return null;
}

// ─── Vorschlag ──────────────────────────────────────────────────────────────

export type ParsedSuggestion = {
  category: SuggestionCategoryId;
  title: string;
  body: string;
  /** Der Einreicher hat bestätigt, dass es trotz ähnlicher Treffer neu ist. */
  confirmedDuplicate: boolean;
};

export function parseSuggestionInput(
  body: Record<string, unknown>
): { input: ParsedSuggestion } | { error: string } {
  const category = String(body.category ?? "");
  if (!isSuggestionCategory(category)) return { error: "Unbekannter Bereich." };

  const title = cleanLine(String(body.title ?? ""));
  const titleError = checkLength(
    title,
    FEEDBACK_LIMITS.suggestionTitleMin,
    FEEDBACK_LIMITS.suggestionTitleMax,
    "Der Titel"
  );
  if (titleError) return { error: titleError };

  const text = cleanMultiline(String(body.body ?? ""));
  const bodyError = checkLength(
    text,
    FEEDBACK_LIMITS.suggestionBodyMin,
    FEEDBACK_LIMITS.suggestionBodyMax,
    "Die Beschreibung"
  );
  if (bodyError) return { error: bodyError };

  return {
    input: { category, title, body: text, confirmedDuplicate: body.confirmDuplicate === true },
  };
}

// ─── Bug-Meldung ────────────────────────────────────────────────────────────

export type ParsedBug = {
  title: string;
  description: string;
  images: BugImageInput[];
};

export function parseBugInput(
  body: Record<string, unknown>
): { input: ParsedBug } | { error: string } {
  const title = cleanLine(String(body.title ?? ""));
  const titleError = checkLength(
    title,
    FEEDBACK_LIMITS.bugTitleMin,
    FEEDBACK_LIMITS.bugTitleMax,
    "Der Titel"
  );
  if (titleError) return { error: titleError };

  const description = cleanMultiline(String(body.description ?? ""));
  const descError = checkLength(
    description,
    FEEDBACK_LIMITS.bugBodyMin,
    FEEDBACK_LIMITS.bugBodyMax,
    "Die Beschreibung"
  );
  if (descError) return { error: descError };

  const rawImages = Array.isArray(body.images) ? body.images : [];
  if (rawImages.length > FEEDBACK_LIMITS.bugImages) {
    return { error: `Es sind höchstens ${FEEDBACK_LIMITS.bugImages} Bilder möglich.` };
  }

  const images: BugImageInput[] = [];
  for (const raw of rawImages) {
    const checked = parseImage(typeof raw === "string" ? raw : String((raw as { data?: unknown })?.data ?? ""));
    if ("error" in checked) return { error: checked.error };
    images.push(checked.image);
  }

  return { input: { title, description, images } };
}

// ─── Bilder ─────────────────────────────────────────────────────────────────

/**
 * Erlaubte Bildtypen.
 *
 * Kein SVG und kein GIF: SVG ist ausführbares Markup, GIF wird beim
 * Verkleinern im Browser ohnehin zu WebP. Der Browser rechnet vor dem
 * Hochladen alles auf WebP herunter – PNG und JPEG stehen nur hier, falls
 * jemand die Anfrage von Hand baut.
 */
const ALLOWED_MIME = ["image/webp", "image/png", "image/jpeg"] as const;

/** `data:image/webp;base64,AAA…` → Typ und reine Base64-Daten. */
function splitDataUrl(value: string): { mime: string; data: string } {
  const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) return { mime: "", data: "" };
  return { mime: match[1].toLowerCase(), data: match[2].replace(/\s+/g, "") };
}

function parseImage(value: string): { image: BugImageInput } | { error: string } {
  const { mime, data } = splitDataUrl(value);
  if (!data) return { error: "Ein Bild konnte nicht gelesen werden." };
  if (!(ALLOWED_MIME as readonly string[]).includes(mime)) {
    return { error: "Erlaubt sind nur WebP-, PNG- und JPEG-Bilder." };
  }
  if (data.length > FEEDBACK_LIMITS.bugImageData) {
    return { error: "Ein Bild ist zu groß. Bitte kleiner zuschneiden." };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(data, "base64");
  } catch {
    return { error: "Ein Bild konnte nicht gelesen werden." };
  }
  if (buf.length < 32) return { error: "Ein Bild ist unvollständig." };

  // Die Angabe im Datenkopf ist nur eine Behauptung – hier zählt, was wirklich
  // in den ersten Bytes steht.
  const real = detectMime(buf);
  if (real === null || real !== mime) {
    return { error: "Ein Anhang ist kein gültiges Bild." };
  }

  const size = imageSize(buf, real);
  if (size === null) {
    return { error: "Ein Bild konnte nicht geprüft werden. Bitte als PNG oder JPEG speichern." };
  }
  if (size.width < 1 || size.height < 1) {
    return { error: "Ein Bild hat keine gültige Größe." };
  }
  // Eine Datei kann klein sein und trotzdem beim Anzeigen Gigabytes belegen
  // (10.000 × 10.000 einfarbig komprimiert sich prächtig). Deshalb zählt hier
  // die Pixelzahl, nicht die Dateigröße.
  if (size.width * size.height > FEEDBACK_LIMITS.bugImagePixels) {
    return { error: "Ein Bild hat zu viele Bildpunkte. Bitte verkleinern." };
  }

  return { image: { mime: real, data } };
}

/** Bildtyp anhand der Kennbytes. */
function detectMime(buf: Buffer): string | null {
  if (
    buf.length > 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Kantenlängen aus dem Dateikopf – ohne das Bild zu dekodieren.
 *
 * Genau darum geht es: ein Bild erst zu entpacken, um festzustellen, dass es zu
 * groß ist, wäre der Angriff, den wir verhindern wollen.
 */
function imageSize(buf: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === "image/png") {
      if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        // Marker ohne Längenfeld überspringen
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = buf.readUInt16BE(i + 2);
        // SOF0…SOF15 (ohne die Huffman-/Arithmetik-Marker) tragen die Maße
        const isSof =
          marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSof) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        if (len < 2) return null;
        i += 2 + len;
      }
      return null;
    }

    if (mime === "image/webp") {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8 ") {
        return {
          width: buf.readUInt16LE(26) & 0x3fff,
          height: buf.readUInt16LE(28) & 0x3fff,
        };
      }
      if (chunk === "VP8L") {
        const bits = buf.readUInt32LE(21);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1,
        };
      }
      if (chunk === "VP8X") {
        return {
          width: buf.readUIntLE(24, 3) + 1,
          height: buf.readUIntLE(27, 3) + 1,
        };
      }
      return null;
    }
  } catch {
    // Zu kurz oder abgeschnitten – dann eben nicht prüfbar.
    return null;
  }
  return null;
}
