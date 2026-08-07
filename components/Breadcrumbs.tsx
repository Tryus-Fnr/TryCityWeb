"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ChevronRight, Home } from "lucide-react";

/**
 * Pfadleiste über dem Seiteninhalt.
 *
 * Die Beschriftungen entstehen aus dem Pfad. Auf der Startseite bleibt die
 * Leiste leer – ein Haus, das auf die Seite zeigt, auf der man schon steht,
 * wäre nur Platzverschwendung.
 *
 * Bei Seiten, deren letzter Pfadteil eine Nummer oder Kennung ist
 * (`/news/12`, `/items/raw_iron`), setzt die Seite selbst eine lesbare
 * Beschriftung über {@link SetBreadcrumb}.
 */

const LABELS: Record<string, string> = {
  items: "Item-Werte",
  news: "Blog",
  auction: "Auktionshaus",
  orders: "Kaufaufträge",
  bounties: "Kopfgelder",
  players: "Spieler",
  clans: "Clans",
  clan: "Clan",
  stats: "Statistiken",
  maps: "Karten",
  servermap: "Server-Karte",
  infra: "Infrastruktur",
  node: "Node",
  service: "Dienst",
  mod: "Moderation",
  player: "Spieler",
  admin: "Verwaltung",
  bossbar: "Bossbar",
  login: "Anmelden",
  creator: "Creator",
  credits: "Credits",
  impressum: "Impressum",
  datenschutz: "Datenschutz",
  regelwerk: "Regelwerk",
};

/** `raw_iron` → „Raw Iron"; als Rückfall für unbekannte Pfadteile. */
function prettify(segment: string): string {
  const clean = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
  if (!clean) return segment;
  return clean
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ── Beschriftung des letzten Pfadteils überschreiben ────────────────────────

const OverrideContext = createContext<{
  label: string | null;
  setLabel: (v: string | null) => void;
}>({ label: null, setLabel: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  const value = useMemo(() => ({ label, setLabel }), [label]);
  return <OverrideContext.Provider value={value}>{children}</OverrideContext.Provider>;
}

/**
 * Setzt die Beschriftung des letzten Pfadteils – etwa den Beitragstitel statt
 * seiner Nummer. Rendert nichts.
 */
export function SetBreadcrumb({ label }: { label: string }) {
  const { setLabel } = useContext(OverrideContext);
  useEffect(() => {
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
  return null;
}

export default function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const { label: override } = useContext(OverrideContext);

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null; // Startseite: keine Leiste

  const crumbs = segments.map((seg, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label:
      i === segments.length - 1 && override
        ? override
        : (LABELS[seg.toLowerCase()] ?? prettify(seg)),
    last: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Pfadleiste"
      className="border-b border-white/[0.06] bg-white/[0.015]"
    >
      <ol className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-4 py-2.5 text-sm">
        <li className="flex items-center">
          <Link
            href="/"
            aria-label="Startseite"
            className="flex items-center rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>
        {crumbs.map((c) => (
          <li key={c.href} className="flex min-w-0 items-center">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-700" aria-hidden />
            {c.last ? (
              <span
                aria-current="page"
                className="ml-1 max-w-[60vw] truncate px-1 font-medium text-neutral-200 sm:max-w-none"
              >
                {c.label}
              </span>
            ) : (
              <Link
                href={c.href}
                className="ml-1 truncate rounded-md px-1 py-0.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
              >
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
