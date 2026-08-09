/**
 * Parser für das Minecraft-Textformat, das auch das Plugin versteht
 * (`de.leon.tryusCloudGlobal.ColorUtil` / `de.leon.sMPGlobal.news.NewsFormat`).
 *
 * Unterstützt:
 *   &0–&9 &a–&f      klassische Farben
 *   &l &o &n &m &k   fett, kursiv, unterstrichen, durchgestrichen, verschlüsselt
 *   &r               alles zurücksetzen
 *   &#RRGGBB         Hex-Farbe
 *   <#RRGGBB>        Hex-Farbe (Tag-Schreibweise)
 *   <gradient:#a:#b:…>Text</gradient>
 *   [img:N]          Platzhalter für ein eingebettetes Bild
 *
 * Wie im Spiel setzt eine Farbe alle Formatierungen zurück – deshalb muss beim
 * Erzeugen immer erst die Farbe und danach die Formatierung kommen. Zeilen sind
 * unabhängig voneinander: am Zeilenumbruch startet der Stil neu. Genau so
 * verarbeitet auch der Dialog im Spiel den Text (er splittet zuerst an `\n`).
 */

import type { CSSProperties } from "react";

export type McStyle = {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  obf?: boolean;
};

export type McNode =
  | { kind: "text"; text: string; style: McStyle }
  | { kind: "gradient"; colors: string[]; children: McNode[] }
  | { kind: "image"; index: number }
  | { kind: "break" };

/** Die 16 klassischen Minecraft-Farben. */
export const LEGACY_COLORS: Record<string, string> = {
  "0": "#000000", "1": "#0000AA", "2": "#00AA00", "3": "#00AAAA",
  "4": "#AA0000", "5": "#AA00AA", "6": "#FFAA00", "7": "#AAAAAA",
  "8": "#555555", "9": "#5555FF", a: "#55FF55", b: "#55FFFF",
  c: "#FF5555", d: "#FF55FF", e: "#FFFF55", f: "#FFFFFF",
};

/** Namen für die Farbauswahl im Editor. */
export const LEGACY_COLOR_NAMES: Record<string, string> = {
  "0": "Schwarz", "1": "Dunkelblau", "2": "Dunkelgrün", "3": "Türkis",
  "4": "Dunkelrot", "5": "Lila", "6": "Gold", "7": "Grau",
  "8": "Dunkelgrau", "9": "Blau", a: "Grün", b: "Aqua",
  c: "Rot", d: "Pink", e: "Gelb", f: "Weiß",
};

/** Zusätzliche Farbnamen, die in `<gradient:…>` erlaubt sind (wie in ColorUtil). */
const NAMED_COLORS: Record<string, string> = {
  black: "#000000", dark_blue: "#0000AA", dark_green: "#00AA00",
  dark_aqua: "#00AAAA", dark_red: "#AA0000", dark_purple: "#AA00AA",
  gold: "#FFAA00", gray: "#AAAAAA", grey: "#AAAAAA", dark_gray: "#555555",
  dark_grey: "#555555", blue: "#5555FF", green: "#55FF55", aqua: "#55FFFF",
  cyan: "#55FFFF", red: "#FF5555", light_purple: "#FF55FF", pink: "#FF55FF",
  magenta: "#FF00FF", yellow: "#FFFF55", white: "#FFFFFF", orange: "#FF8000",
  purple: "#9B30FF", violet: "#8A2BE2", lime: "#80FF00", teal: "#008080",
  brown: "#8B4513",
};

const HEX_RE = /^[0-9a-fA-F]{6}$/;

/** Small-Caps-Mapping: Kleinbuchstaben → Unicode-Small-Caps (s und x haben kein Äquivalent). */
const SMALL_CAPS: Record<string, string> = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ғ", g: "ɢ", h: "ʜ",
  i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ",
  q: "ǫ", r: "ʀ", s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x",
  y: "ʏ", z: "ᴢ",
};

/** Wandelt Kleinbuchstaben in Small-Caps-Unicode um; Großbuchstaben und Zahlen bleiben. */
export function toSmallCaps(text: string): string {
  return [...text].map((c) => SMALL_CAPS[c] ?? c).join("");
}

function parseColor(raw: string): string {
  const s = raw.trim().replace(/^#/, "");
  if (HEX_RE.test(s)) return `#${s.toUpperCase()}`;
  return NAMED_COLORS[s.toLowerCase()] ?? "#FFFFFF";
}

/** Farbe setzen heißt im Spiel: Formatierungen fallen weg. */
function withColor(color: string): McStyle {
  return { color };
}

/**
 * Zerlegt einen Beitragstext in Knoten.
 *
 * @param text  Rohtext im Minecraft-Format
 */
export function parseMc(text: string): McNode[] {
  return parseSegment(text ?? "", {});
}

function parseSegment(text: string, start: McStyle): McNode[] {
  const out: McNode[] = [];
  let style: McStyle = { ...start };
  let buf = "";

  const flush = () => {
    if (buf) {
      out.push({ kind: "text", text: buf, style: { ...style } });
      buf = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];

    // ── Zeilenumbruch: Stil beginnt neu ──────────────────────────────────
    if (c === "\n") {
      flush();
      out.push({ kind: "break" });
      style = {};
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }

    // ── &-Codes ──────────────────────────────────────────────────────────
    if ((c === "&" || c === "§") && i + 1 < text.length) {
      const next = text[i + 1];

      if (next === "#" && HEX_RE.test(text.slice(i + 2, i + 8))) {
        flush();
        style = withColor(`#${text.slice(i + 2, i + 8).toUpperCase()}`);
        i += 8;
        continue;
      }

      const code = next.toLowerCase();
      if (code in LEGACY_COLORS) {
        flush();
        style = withColor(LEGACY_COLORS[code]);
        i += 2;
        continue;
      }
      if ("lonmk".includes(code)) {
        flush();
        style = {
          ...style,
          bold: code === "l" ? true : style.bold,
          italic: code === "o" ? true : style.italic,
          underline: code === "n" ? true : style.underline,
          strike: code === "m" ? true : style.strike,
          obf: code === "k" ? true : style.obf,
        };
        i += 2;
        continue;
      }
      if (code === "r") {
        flush();
        style = {};
        i += 2;
        continue;
      }
    }

    // ── <#RRGGBB> ────────────────────────────────────────────────────────
    if (c === "<" && text[i + 1] === "#" && text[i + 8] === ">" && HEX_RE.test(text.slice(i + 2, i + 8))) {
      flush();
      style = withColor(`#${text.slice(i + 2, i + 8).toUpperCase()}`);
      i += 9;
      continue;
    }

    // ── <gradient:…>…</gradient> ─────────────────────────────────────────
    if (text.startsWith("<gradient:", i)) {
      const tagEnd = text.indexOf(">", i);
      const close = tagEnd < 0 ? -1 : text.indexOf("</gradient>", tagEnd);
      if (tagEnd > 0 && close > 0) {
        flush();
        const colors = text
          .slice(i + "<gradient:".length, tagEnd)
          .split(":")
          .map((p) => p.trim())
          .filter(Boolean)
          .map(parseColor);
        const inner = text.slice(tagEnd + 1, close);
        // Formatierungen vor dem Tag bleiben erhalten, die Farbe nicht.
        const innerStart: McStyle = { ...style, color: undefined };
        out.push({
          kind: "gradient",
          colors: colors.length >= 2 ? colors : [colors[0] ?? "#FFFFFF", colors[0] ?? "#FFFFFF"],
          children: parseSegment(inner, innerStart),
        });
        i = close + "</gradient>".length;
        continue;
      }
    }

    // ── <small>…</small> ─────────────────────────────────────────────────
    if (text.startsWith("<small>", i)) {
      const close = text.indexOf("</small>", i);
      if (close >= 0) {
        flush();
        const inner = text.slice(i + "<small>".length, close);
        // Inner-Nodes parsen, dann bei Text-Knoten Small-Caps anwenden.
        const innerNodes = parseSegment(inner, { ...style });
        for (const n of innerNodes) {
          if (n.kind === "text") n.text = toSmallCaps(n.text);
          out.push(n);
        }
        i = close + "</small>".length;
        continue;
      }
    }

    // ── [img:N] ──────────────────────────────────────────────────────────
    if (text.startsWith("[img:", i)) {
      const end = text.indexOf("]", i);
      const num = end > 0 ? text.slice(i + 5, end) : "";
      if (end > 0 && /^\d+$/.test(num)) {
        flush();
        out.push({ kind: "image", index: Number(num) });
        i = end + 1;
        continue;
      }
    }

    buf += c;
    i++;
  }

  flush();
  return out;
}

// ─── Aufmacherbild ──────────────────────────────────────────────────────────

/**
 * Ein Bild ganz am Anfang des Beitrags: davor darf nur Leerraum oder
 * Formatierung stehen, kein sichtbarer Text. Der Umbruch dahinter gehört mit
 * dazu – der Editor setzt Bilder immer auf eine eigene Zeile.
 */
const LEADING_IMAGE =
  /^(?:\s|&#[0-9a-f]{6}|<#[0-9a-f]{6}>|[&§][0-9a-fk-or])*\[img:(\d+)\][ \t]*\r?\n?/i;

/**
 * Index des Titelbilds, oder null, wenn der Beitrag nicht mit einem Bild
 * beginnt.
 *
 * Steht ein Bild an allererster Stelle, gehört es zu keinem Absatz – es ist als
 * Aufmacher gemeint. Es wird deshalb oben groß gezeigt und aus dem Text
 * genommen, sonst stünde dasselbe Bild zweimal auf der Seite. Ein Bild mitten
 * im Text bleibt dagegen an seiner Stelle, dort gehört es zum Zusammenhang.
 */
export function leadingImageIndex(text: string): number | null {
  const m = LEADING_IMAGE.exec(text ?? "");
  return m ? Number(m[1]) : null;
}

/** Entfernt genau den Platzhalter, den {@link leadingImageIndex} meldet. */
export function stripLeadingImage(text: string): string {
  return (text ?? "").replace(LEADING_IMAGE, "");
}

/** Text ohne jede Formatierung – für Kurzfassungen, Titel-Tags und Suche. */
export function mcPlainText(text: string): string {
  const parts: string[] = [];
  const walk = (nodes: McNode[]) => {
    for (const n of nodes) {
      if (n.kind === "text") parts.push(n.text);
      else if (n.kind === "gradient") walk(n.children);
      else if (n.kind === "break") parts.push(" ");
    }
  };
  walk(parseMc(text));
  return parts.join("").replace(/\s+/g, " ").trim();
}

/** Kürzt einen Text sauber auf `max` Zeichen. */
export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** CSS-Eigenschaften für einen Stil (ohne Farbe – die setzt der Renderer). */
export function styleToCss(style: McStyle): CSSProperties {
  const decorations: string[] = [];
  if (style.underline) decorations.push("underline");
  if (style.strike) decorations.push("line-through");
  return {
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: decorations.length ? decorations.join(" ") : undefined,
  };
}

// ─── Blöcke: Überschriften à la Markdown ─────────────────────────────────────

/**
 * Ein Abschnitt eines Beitragstexts.
 *
 * Der Beitragstext ist Minecraft-Format, kein Markdown – die einzige Ausnahme
 * sind Überschriften. Eine Zeile, die mit einer bis drei Rauten und einem
 * Leerzeichen beginnt, wird im Web zur Überschrift. Ingame bleiben die Rauten
 * einfach als Text stehen; das ist gewollt, dort gibt es keine Schriftgrößen.
 */
export type McBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "body"; text: string };

const HEADING = /^ {0,3}(#{1,3})[ \t]+(.*)$/;

/**
 * Zerlegt einen Beitragstext in Überschriften und normale Abschnitte.
 * Der Text der Abschnitte bleibt unangetastet und geht danach durch
 * {@link parseMc} – Farben und Verläufe funktionieren also auch in
 * Überschriften.
 */
export function splitMcBlocks(text: string): McBlock[] {
  const out: McBlock[] = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    // Leerzeilen am Rand eines Abschnitts würden sonst als <br> auftauchen und
    // die Abstände neben Überschriften verdoppeln.
    while (buf.length && buf[0].trim() === "") buf.shift();
    while (buf.length && buf[buf.length - 1].trim() === "") buf.pop();
    if (buf.length) out.push({ kind: "body", text: buf.join("\n") });
    buf = [];
  };

  for (const line of (text ?? "").split("\n")) {
    const m = HEADING.exec(line.replace(/\r$/, ""));
    if (m && m[2].trim()) {
      flush();
      out.push({ kind: "heading", level: m[1].length as 1 | 2 | 3, text: m[2].trim() });
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}
