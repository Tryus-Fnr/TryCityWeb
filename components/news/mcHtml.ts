import { parseMc, type McNode, type McStyle } from "@/lib/mcformat";

/**
 * Übersetzung zwischen dem gespeicherten Minecraft-Textformat und dem DOM des
 * Editors.
 *
 * Im Editor trägt jeder formatierte Abschnitt seine Formatierung doppelt:
 * als `data-*`-Attribut (dient dem Zurückschreiben) und als Inline-CSS (damit
 * man beim Schreiben sofort sieht, wie es aussieht).
 *
 *   data-c  Farbe als #RRGGBB
 *   data-g  Verlauf als "#a,#b,…"
 *   data-b  fett          data-i  kursiv
 *   data-u  unterstrichen data-s  durchgestrichen
 *   data-k  verschlüsselt
 *   data-img  Index eines eingebetteten Bildes
 */

export type EditorStyle = McStyle & { gradient?: string[] };

export const EMPTY_STYLE: EditorStyle = {};

export function isEmptyStyle(s: EditorStyle): boolean {
  return (
    !s.color && !s.gradient && !s.bold && !s.italic && !s.underline && !s.strike && !s.obf
  );
}

/** Elternstil und eigener Stil zusammenführen – der eigene gewinnt bei Farbe. */
export function mergeStyle(parent: EditorStyle, own: EditorStyle): EditorStyle {
  const merged: EditorStyle = {
    color: own.color ?? parent.color,
    gradient: own.gradient ?? parent.gradient,
    bold: own.bold || parent.bold || undefined,
    italic: own.italic || parent.italic || undefined,
    underline: own.underline || parent.underline || undefined,
    strike: own.strike || parent.strike || undefined,
    obf: own.obf || parent.obf || undefined,
  };
  // Farbe und Verlauf schließen einander aus – was zuletzt gesetzt wurde, zählt.
  if (own.gradient) merged.color = undefined;
  if (own.color) merged.gradient = undefined;
  return merged;
}

export function readStyle(el: HTMLElement): EditorStyle {
  const grad = el.dataset.g;
  return {
    color: el.dataset.c || undefined,
    gradient: grad ? grad.split(",").filter(Boolean) : undefined,
    bold: el.dataset.b === "1" || undefined,
    italic: el.dataset.i === "1" || undefined,
    underline: el.dataset.u === "1" || undefined,
    strike: el.dataset.s === "1" || undefined,
    obf: el.dataset.k === "1" || undefined,
  };
}

/**
 * Markierung für frisch formatierte Abschnitte.
 *
 * `Range.extractContents()` lässt die angeschnittenen Eltern-Spans stehen, der
 * neue Abschnitt landet also IN ihnen. Ohne diese Markierung würde z. B.
 * „Formatierung entfernen“ wirkungslos bleiben, weil die Formatierung von
 * aussen weitergälte. Ein markierter Abschnitt bringt seinen Stil absolut mit;
 * {@link flattenEditor} löst die Verschachtelung anschliessend auf.
 */
const ABSOLUTE_ATTR = "x";

/**
 * Erzeugt den Knoten für einen Textabschnitt.
 * @param absolute true, wenn der Stil Elternstile überschreiben soll
 */
export function makeStyledNode(text: string, style: EditorStyle, absolute = false): Node {
  if (isEmptyStyle(style) && !absolute) return document.createTextNode(text);

  const span = document.createElement("span");
  if (absolute) span.dataset[ABSOLUTE_ATTR] = "1";
  span.textContent = text;

  if (style.gradient?.length) span.dataset.g = style.gradient.join(",");
  else if (style.color) span.dataset.c = style.color;
  if (style.bold) span.dataset.b = "1";
  if (style.italic) span.dataset.i = "1";
  if (style.underline) span.dataset.u = "1";
  if (style.strike) span.dataset.s = "1";
  if (style.obf) span.dataset.k = "1";

  applyCss(span, style);
  return span;
}

/** Setzt das Inline-CSS passend zum Stil (Live-Darstellung im Editor). */
export function applyCss(span: HTMLElement, style: EditorStyle): void {
  if (style.gradient?.length) {
    span.style.backgroundImage = `linear-gradient(90deg, ${style.gradient.join(", ")})`;
    span.style.webkitBackgroundClip = "text";
    span.style.backgroundClip = "text";
    span.style.color = "transparent";
  } else if (style.color) {
    span.style.color = style.color;
  }
  if (style.bold) span.style.fontWeight = "700";
  if (style.italic) span.style.fontStyle = "italic";

  const deco: string[] = [];
  if (style.underline) deco.push("underline");
  if (style.strike) deco.push("line-through");
  if (deco.length) span.style.textDecoration = deco.join(" ");

  if (style.obf) span.style.opacity = "0.75";
}

// ─── Minecraft-Text → Editor-DOM ────────────────────────────────────────────

/**
 * Baut den Editor-Inhalt aus gespeichertem Text auf.
 * @param imageSrc liefert die Data-URL zu einem Bild-Index
 */
export function mcToNodes(
  text: string,
  imageSrc: (idx: number) => string | undefined
): DocumentFragment {
  const frag = document.createDocumentFragment();

  const emit = (nodes: McNode[], inherited: EditorStyle) => {
    for (const node of nodes) {
      switch (node.kind) {
        case "break":
          frag.appendChild(document.createElement("br"));
          break;
        case "text":
          if (node.text) frag.appendChild(makeStyledNode(node.text, mergeStyle(inherited, node.style)));
          break;
        case "gradient":
          emit(node.children, mergeStyle(inherited, { gradient: node.colors }));
          break;
        case "image": {
          const src = imageSrc(node.index);
          if (src) frag.appendChild(makeImageNode(node.index, src));
          break;
        }
      }
    }
  };

  emit(parseMc(text), EMPTY_STYLE);
  return frag;
}

export function makeImageNode(idx: number, src: string): HTMLElement {
  const img = document.createElement("img");
  img.dataset.img = String(idx);
  img.src = src;
  img.alt = `Bild ${idx}`;
  img.contentEditable = "false";
  img.style.display = "block";
  img.style.maxHeight = "140px";
  img.style.maxWidth = "100%";
  img.style.margin = "8px 0";
  img.style.borderRadius = "8px";
  img.style.border = "1px solid rgba(255,255,255,0.15)";
  return img;
}

// ─── Aufräumen ──────────────────────────────────────────────────────────────

/**
 * Baut den Editor-Inhalt zu einer flachen Folge aus Spans, `<br>` und Bildern um.
 *
 * Nötig, weil Browser (und `extractContents`) beim Bearbeiten verschachtelte
 * und leere Spans hinterlassen. Nach dem Durchlauf trägt jeder Textabschnitt
 * genau einen Span mit seinem endgültigen Stil – das hält das Zurückschreiben
 * einfach und verhindert, dass Formatierungen über die Zeit immer tiefer
 * ineinander wandern.
 */
export function flattenEditor(root: HTMLElement): void {
  const flat = document.createDocumentFragment();

  const walk = (node: Node, style: EditorStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) flat.appendChild(makeStyledNode(text, style));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      flat.appendChild(document.createElement("br"));
      return;
    }
    if (el.tagName === "IMG") {
      const clone = el.cloneNode(true) as HTMLElement;
      delete clone.dataset[ABSOLUTE_ATTR];
      flat.appendChild(clone);
      return;
    }

    // Markierte Abschnitte bringen ihren Stil absolut mit.
    const own = readStyle(el);
    const next = el.dataset[ABSOLUTE_ATTR] ? own : mergeStyle(style, own);
    for (const child of Array.from(el.childNodes)) walk(child, next);
  };

  for (const child of Array.from(root.childNodes)) walk(child, EMPTY_STYLE);
  root.replaceChildren(flat);
}

/**
 * Der an `node` geltende Stil, zusammengesetzt aus allen Eltern bis `root`.
 *
 * Wird als Ausgangsstil gebraucht, wenn eine Auswahl den umgebenden Span
 * vollständig ausfüllt: `extractContents()` liefert dann nur den nackten
 * Textknoten, und ohne diesen Ausgangsstil ginge die bestehende Formatierung
 * beim Umfärben verloren.
 */
export function styleAt(root: HTMLElement, node: Node): EditorStyle {
  const chain: HTMLElement[] = [];
  let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (current && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE) chain.unshift(current as HTMLElement);
    current = current.parentNode;
  }
  return chain.reduce<EditorStyle>((style, el) => mergeStyle(style, readStyle(el)), EMPTY_STYLE);
}

/** Ein Baustein aus einem ausgewählten Bereich. */
export type RangePiece =
  | { kind: "text"; text: string; style: EditorStyle }
  | { kind: "br" }
  | { kind: "img"; node: HTMLElement };

/**
 * Liest den Bereich zwischen zwei Zeichenpositionen aus – jeder Textabschnitt
 * mit dem Stil, der dort tatsächlich gilt.
 *
 * Bewusst VOR dem Löschen des Bereichs aufrufen: danach ist die Verschachtelung
 * weg, aus der sich der Stil ergibt. Gegenüber `extractContents()` hat das den
 * Vorteil, dass auch Abschnitte ohne eigene Hülle ihren richtigen Stil behalten
 * und nicht den ihres Nachbarn erben.
 */
export function collectRange(root: HTMLElement, from: number, to: number): RangePiece[] {
  const pieces: RangePiece[] = [];
  let offset = 0;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const start = Math.max(from, offset);
      const end = Math.min(to, offset + text.length);
      if (end > start) {
        pieces.push({
          kind: "text",
          text: text.slice(start - offset, end - offset),
          style: styleAt(root, node),
        });
      }
      offset += text.length;
      continue;
    }

    // Umbrüche und Bilder haben keine Textlänge – sie zählen nur, wenn sie
    // wirklich innerhalb der Auswahl liegen.
    const el = node as HTMLElement;
    if (offset <= from || offset >= to) continue;
    if (el.tagName === "BR") pieces.push({ kind: "br" });
    else if (el.tagName === "IMG") {
      pieces.push({ kind: "img", node: el.cloneNode(true) as HTMLElement });
    }
  }

  return pieces;
}

/** Länge des Textes vor `node` (Bilder und Umbrüche zählen nicht mit). */
export function textOffsetOf(root: HTMLElement, node: Node, offset: number): number {
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode === node) return count + offset;
    count += walker.currentNode.textContent?.length ?? 0;
  }
  return count;
}

/** Umkehrung von {@link textOffsetOf} – findet die Stelle wieder. */
export function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const range = document.createRange();
  let count = 0;
  let startSet = false;
  let lastNode: Node | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const len = node.textContent?.length ?? 0;
    lastNode = node;
    if (!startSet && start <= count + len) {
      range.setStart(node, Math.max(0, start - count));
      startSet = true;
    }
    if (startSet && end <= count + len) {
      range.setEnd(node, Math.max(0, end - count));
      return range;
    }
    count += len;
  }

  if (!startSet || !lastNode) return null;
  // Ende lag hinter dem letzten Text – bis dorthin auswählen.
  range.setEnd(lastNode, lastNode.textContent?.length ?? 0);
  return range;
}

// ─── Editor-DOM → Minecraft-Text ────────────────────────────────────────────

/** Zeichen, die ein Steuerzeichen einleiten könnten und deshalb entschärft werden. */
function needsGuard(text: string, i: number): boolean {
  const c = text[i];
  if (c === "&") return /[0-9a-fA-FkKlLmMnNoOrR#]/.test(text[i + 1] ?? "");
  if (c === "<") return text[i + 1] === "#" || text.startsWith("<gradient:", i);
  if (c === "[") return text.startsWith("[img:", i);
  return false;
}

/**
 * Serialisiert den Editor-Inhalt.
 *
 * Farbe kommt immer VOR den Formatierungen, weil ein Farbwechsel in Minecraft
 * die Formatierung zurücksetzt. Nach einem Zeilenumbruch beginnt der Stil neu –
 * genauso zerlegt das Plugin den Text vor dem Rendern.
 */
export function nodesToMc(root: HTMLElement): string {
  let out = "";
  let lastPrefix: string | null = null;
  /** Nach einem Bild steht bereits ein Umbruch – ein direkt folgendes <br> würde eine Leerzeile erzeugen. */
  let skipNextBreak = false;

  const prefixFor = (style: EditorStyle): string => {
    if (isEmptyStyle(style)) return "&r";
    let p = "&r";
    if (style.color) p += `&${style.color}`; // "#RRGGBB" → "&#RRGGBB"
    if (style.bold) p += "&l";
    if (style.italic) p += "&o";
    if (style.underline) p += "&n";
    if (style.strike) p += "&m";
    if (style.obf) p += "&k";
    return p;
  };

  const writeText = (raw: string, style: EditorStyle) => {
    if (!raw) return;
    skipNextBreak = false;
    const prefix = prefixFor(style);
    if (prefix !== lastPrefix) {
      out += prefix;
      lastPrefix = prefix;
    }
    // Vom Nutzer getippte Steuerzeichen entschärfen: das Zeichen bleibt stehen,
    // danach wird der Stil erneut gesetzt. Das trennt z. B. "&" und "c", sodass
    // daraus kein Farbcode wird.
    for (let i = 0; i < raw.length; i++) {
      out += raw[i];
      if (needsGuard(raw, i)) out += prefix;
    }
  };

  const walk = (node: Node, style: EditorStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      writeText(node.textContent ?? "", style);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;

    if (el.tagName === "BR") {
      if (skipNextBreak) {
        skipNextBreak = false;
        return;
      }
      out += "\n";
      lastPrefix = null; // nach dem Umbruch beginnt der Stil neu
      return;
    }
    if (el.tagName === "IMG") {
      if (el.dataset.img) {
        // Ein Bild steht immer auf einer eigenen Zeile.
        if (out && !out.endsWith("\n")) out += "\n";
        out += `[img:${el.dataset.img}]\n`;
        lastPrefix = null;
        skipNextBreak = true;
      }
      return;
    }

    const own = readStyle(el);
    const merged = mergeStyle(style, own);

    // Browser fügen beim Zeilenumbruch gern DIV/P ein – als Umbruch behandeln.
    const isBlock = el.tagName === "DIV" || el.tagName === "P";
    if (isBlock && out && !out.endsWith("\n")) {
      out += "\n";
      lastPrefix = null;
    }

    if (merged.gradient?.length && !style.gradient) {
      // Verlauf als ein Block ausgeben, sonst würde er pro Abschnitt neu starten.
      const outerOut = out;
      const outerLast = lastPrefix;
      out = "";
      lastPrefix = "";
      for (const child of Array.from(el.childNodes)) {
        walk(child, { ...merged, gradient: undefined, color: undefined });
      }
      const inner = out;
      out = outerOut;
      lastPrefix = outerLast;

      let pre = "";
      if (merged.bold) pre += "&l";
      if (merged.italic) pre += "&o";
      if (merged.underline) pre += "&n";
      if (merged.strike) pre += "&m";
      if (merged.obf) pre += "&k";
      out += `&r${pre}<gradient:${merged.gradient.join(":")}>${inner}</gradient>`;
      lastPrefix = null;
      return;
    }

    for (const child of Array.from(el.childNodes)) walk(child, merged);

    if (isBlock && !out.endsWith("\n")) {
      out += "\n";
      lastPrefix = null;
    }
  };

  for (const child of Array.from(root.childNodes)) walk(child, EMPTY_STYLE);

  // Führenden Reset und Leerzeilen am Ende entfernen.
  return out.replace(/^&r/, "").replace(/\n+$/, "");
}
