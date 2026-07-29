/**
 * Rendert einen Clan-Tag exakt so, wie ihn das Proxy-Plugin im Spiel baut.
 *
 * Die Logik ist 1:1 aus `Clan#getFormattedTag()` übernommen:
 *  - NONE      → ganzer Tag in der Primärfarbe
 *  - GRADIENT  → linear von Primär- nach Sekundärfarbe, Zeichen für Zeichen
 *  - SWITCH    → Zeichen wechseln abwechselnd zwischen beiden Farben
 * Fehlt die Sekundärfarbe, fallen GRADIENT und SWITCH auf NONE zurück – genau
 * wie im Plugin. Formatierungscodes (l/o/n/m) werden als CSS abgebildet.
 */

/** Die 16 klassischen Minecraft-Farbcodes mit ihren echten RGB-Werten. */
const LEGACY_COLORS: Record<string, number> = {
  "0": 0x000000, "1": 0x0000aa, "2": 0x00aa00, "3": 0x00aaaa,
  "4": 0xaa0000, "5": 0xaa00aa, "6": 0xffaa00, "7": 0xaaaaaa,
  "8": 0x555555, "9": 0x5555ff, a: 0x55ff55, b: 0x55ffff,
  c: 0xff5555, d: 0xff55ff, e: 0xffff55, f: 0xffffff,
};

/** "#RRGGBB" oder ein einzelner Farbcode → Zahl. Unbekanntes wird weiß. */
export function clanColorToInt(color: string | null | undefined): number {
  if (!color) return 0xffffff;
  if (color.startsWith("#")) {
    const parsed = parseInt(color.slice(1), 16);
    return Number.isNaN(parsed) ? 0xffffff : parsed & 0xffffff;
  }
  if (color.length === 1) return LEGACY_COLORS[color.toLowerCase()] ?? 0xffffff;
  return 0xffffff;
}

export function intToHex(value: number): string {
  return "#" + value.toString(16).padStart(6, "0");
}

/** Primärfarbe als CSS-Hex – für Akzente rund um den Tag. */
export function clanPrimaryHex(color: string | null | undefined): string {
  return intToHex(clanColorToInt(color));
}

function formattingStyle(codes: string): React.CSSProperties {
  const set = new Set(codes.toLowerCase().split(""));
  const decorations: string[] = [];
  if (set.has("n")) decorations.push("underline");
  if (set.has("m")) decorations.push("line-through");
  return {
    fontWeight: set.has("l") ? 700 : undefined,
    fontStyle: set.has("o") ? "italic" : undefined,
    textDecoration: decorations.length ? decorations.join(" ") : undefined,
  };
}

type Props = {
  tag: string;
  color: string | null;
  secondaryColor: string | null;
  tagStyle: string;
  formattingCodes: string;
  /** Eckige Klammern wie im Chat mitrendern. */
  brackets?: boolean;
  className?: string;
};

export default function ClanTag({
  tag,
  color,
  secondaryColor,
  tagStyle,
  formattingCodes,
  brackets = false,
  className = "",
}: Props) {
  const style = formattingStyle(formattingCodes ?? "");
  const hasSecondary = !!secondaryColor && secondaryColor.length > 0;
  const mode = (tagStyle ?? "NONE").toUpperCase();
  const chars = [...tag];

  let colored: React.ReactNode;

  if (mode === "GRADIENT" && hasSecondary) {
    const from = clanColorToInt(color);
    const to = clanColorToInt(secondaryColor);
    colored = chars.map((ch, i) => {
      const ratio = chars.length === 1 ? 0 : i / (chars.length - 1);
      const r = Math.round(((from >> 16) & 0xff) + (((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * ratio);
      const g = Math.round(((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * ratio);
      const b = Math.round((from & 0xff) + ((to & 0xff) - (from & 0xff)) * ratio);
      return (
        <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>
          {ch}
        </span>
      );
    });
  } else if (mode === "SWITCH" && hasSecondary) {
    const a = clanPrimaryHex(color);
    const b = clanPrimaryHex(secondaryColor);
    colored = chars.map((ch, i) => (
      <span key={i} style={{ color: i % 2 === 0 ? a : b }}>
        {ch}
      </span>
    ));
  } else {
    colored = <span style={{ color: clanPrimaryHex(color) }}>{tag}</span>;
  }

  return (
    <span className={className} style={style}>
      {brackets && <span className="text-neutral-600">[</span>}
      {colored}
      {brackets && <span className="text-neutral-600">]</span>}
    </span>
  );
}
