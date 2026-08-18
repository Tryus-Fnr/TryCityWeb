import { Fragment, type ReactNode } from "react";
import { parseMc, splitMcBlocks, styleToCss, type McNode } from "@/lib/mcformat";
import Obfuscated from "./Obfuscated";
import type { NewsImage } from "@/lib/newsTypes";

/**
 * Rendert einen Beitragstext im Minecraft-Format so, wie er auch im Spiel
 * aussieht: Farben, Verläufe, fett/kursiv/unterstrichen/durchgestrichen und
 * der „verschlüsselte“ Effekt.
 *
 * Bilder (`[img:N]`) werden hier – anders als im Spiel – tatsächlich angezeigt.
 * Fehlt ein Bild zu einem Platzhalter, wird der Platzhalter still übersprungen.
 *
 * Zusätzlich werden Zeilen mit führenden Rauten zu Überschriften: `#`, `##` und
 * `###`. Ingame bleiben die Rauten stehen – dort gibt es keine Schriftgrößen,
 * und ein `# Fazit` liest sich auch so als Zwischenüberschrift.
 *
 * Adressen im Text werden anklickbar. Für Vorschauen, die zeigen sollen, wie ein
 * Text ingame aussieht, lässt sich das über `links` abschalten.
 */
export default function McText({
  text,
  images = [],
  className = "",
  headings = true,
  links = true,
}: {
  text: string;
  images?: NewsImage[];
  className?: string;
  /** Überschriften auswerten. Für Vorschauen abschaltbar. */
  headings?: boolean;
  /** Adressen anklickbar machen. Ingame ist nichts anklickbar – Vorschauen setzen false. */
  links?: boolean;
}) {
  const byIndex = new Map(images.map((img) => [img.idx, img]));

  if (!headings) {
    return (
      <div className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
        {renderNodes(parseMc(text), byIndex, links)}
      </div>
    );
  }

  const blocks = splitMcBlocks(text);

  return (
    <div className={`break-words leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          const inner = renderNodes(parseMc(block.text), byIndex, links);
          const common = "font-bold tracking-tight text-neutral-50 first:mt-0";
          if (block.level === 1) {
            return (
              <h2 key={i} className={`${common} mt-8 mb-3 text-2xl sm:text-[1.7rem]`}>
                {inner}
              </h2>
            );
          }
          if (block.level === 2) {
            return (
              <h3 key={i} className={`${common} mt-7 mb-2.5 text-xl`}>
                {inner}
              </h3>
            );
          }
          return (
            <h4 key={i} className={`${common} mt-6 mb-2 text-base uppercase tracking-wide`}>
              {inner}
            </h4>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap first:mt-0">
            {renderNodes(parseMc(block.text), byIndex, links)}
          </div>
        );
      })}
    </div>
  );
}

function renderNodes(nodes: McNode[], images: Map<number, NewsImage>, links: boolean) {
  return nodes.map((node, i) => {
    switch (node.kind) {
      case "break":
        return <br key={i} />;

      case "text": {
        const css = { ...styleToCss(node.style), color: node.style.color };
        return node.style.obf ? (
          <Obfuscated key={i} text={node.text} style={css} />
        ) : (
          <span key={i} style={css}>
            {links ? linkify(node.text) : node.text}
          </span>
        );
      }

      case "gradient": {
        // Verlauf über den ganzen Block: der Text selbst wird transparent und
        // zeigt den Hintergrund durch – die Kind-Knoten tragen nur noch die
        // Formatierungen (fett, kursiv …).
        return (
          <span
            key={i}
            style={{
              backgroundImage: `linear-gradient(90deg, ${node.colors.join(", ")})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {node.children.map((child, j) =>
              child.kind === "text" ? (
                <span key={j} style={styleToCss(child.style)}>
                  {links ? linkify(child.text) : child.text}
                </span>
              ) : (
                <Fragment key={j}>{renderNodes([child], images, links)}</Fragment>
              )
            )}
          </span>
        );
      }

      case "image": {
        const img = images.get(node.index);
        if (!img) return null;
        return (
          <figure key={i} className="my-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${img.mime};base64,${img.data}`}
              alt={img.caption || "Bild zum Beitrag"}
              className="max-h-[70vh] w-auto max-w-full rounded-xl border border-white/10"
            />
            {img.caption && (
              <figcaption className="mt-2 text-xs text-neutral-500">{img.caption}</figcaption>
            )}
          </figure>
        );
      }
    }
  });
}

/**
 * Adressen im Text: `https://…`, `http://…` und alles, was mit `www.` beginnt.
 *
 * Klammern gehören bewusst nicht zur Adresse – sonst würde „(siehe example.com)“
 * die schließende Klammer mitschlucken.
 */
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'()\[\]]+/gi;

/** Satzzeichen am Ende gehören zum Satz, nicht zur Adresse. */
function trimUrlTail(raw: string): string {
  let url = raw;
  while (url && ".,;:!?".includes(url[url.length - 1])) url = url.slice(0, -1);
  return url;
}

/**
 * Macht Adressen anklickbar – nur im Web, ingame bleibt es einfacher Text.
 *
 * Läuft pro Text-Knoten: eine Adresse, in deren Mitte die Farbe wechselt, ist
 * bereits in mehrere Knoten zerfallen und bleibt deshalb unverlinkt. Verlinkt
 * wird nur http/https, damit kein `javascript:` in ein `href` gerät.
 */
function linkify(text: string): ReactNode {
  URL_RE.lastIndex = 0;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = URL_RE.exec(text))) {
    const url = trimUrlTail(m[0]);
    if (!url) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a
        key={m.index}
        href={url.toLowerCase().startsWith("www.") ? `https://${url}` : url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 decoration-neutral-500 transition-colors hover:decoration-current"
      >
        {url}
      </a>
    );
    last = m.index + url.length;
  }

  if (out.length === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
