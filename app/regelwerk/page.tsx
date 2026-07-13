import type { Metadata } from "next";
import { CheckCircle, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Regelwerk – TryCity",
  description: "Das offizielle Regelwerk des TryCity Minecraft-Netzwerks mit erlaubten und verbotenen Mods.",
};

const ALLOWED_MODS = [
  { name: "Simple Voice Chat", desc: "Näherungs-Sprachchat im Spiel" },
  { name: "Sodium", desc: "Performance-Optimierung für Rendering (Fabric)" },
  { name: "Lithium", desc: "Server-seitige Performance-Optimierung (Fabric)" },
  { name: "Iris Shaders", desc: "Shader-Unterstützung für Fabric" },
  { name: "OptiFine", desc: "Performance & Shader-Unterstützung" },
  { name: "Starlight", desc: "Verbesserte Lichtberechnung" },
  { name: "FerriteCore", desc: "RAM-Nutzung reduzieren" },
  { name: "EntityCulling", desc: "Nicht sichtbare Entities ausblenden" },
  { name: "LazyDFU", desc: "Schnelleres Laden des Spiels" },
  { name: "VoxelMap (ohne Spieler-Radar)", desc: "Mini-Karte ohne Spieler-Tracking" },
  { name: "Appleskin", desc: "Anzeige von Hunger- und Sättigungswerten" },
  { name: "Shulker Box Tooltip", desc: "Inhalt von Shulkerboxen im Tooltip anzeigen" },
  { name: "Inventory Tweaks / Inventory Profiles Next", desc: "Inventar-Sortierung" },
  { name: "REI / JEI (nur Rezept-Lookup)", desc: "Rezepte nachschlagen" },
  { name: "Distant Horizons", desc: "Erhöhte Renderdistanz (LOD)" },
  { name: "BetterF3", desc: "Übersichtlicheres Debug-Menü" },
  { name: "No Chat Reports", desc: "Entfernt Chat-Report-Signaturen" },
];

const BANNED_CANT_JOIN = [
  { name: "Hacked Clients (Wurst, Impact, Meteor, etc.)", desc: "Vollständig verboten – führt zum sofortigen Bann" },
  { name: "X-Ray Texture Packs / X-Ray Mods", desc: "Erzminen durch Wände sehen" },
  { name: "Fly Hacks", desc: "Unerlaubtes Fliegen in Survival" },
  { name: "Speed Hacks", desc: "Erhöhte Bewegungsgeschwindigkeit" },
  { name: "KillAura / ForceAura", desc: "Automatisches Angreifen von Spielern/Mobs" },
  { name: "AutoClicker (im Kampf)", desc: "Automatisches Klicken für Kampfvorteile" },
  { name: "Xaero's Minimap (ohne Spieler-Radar)", desc: "Mini-Karte ohne Spieler-Tracking" },
  { name: "JourneyMap (ohne Spieler-Radar)", desc: "Vollbild-Karte ohne Spieler-Tracking" },
  { name: "Reach / Hitbox-Erweiterungen", desc: "Größere Reichweite beim Angreifen" },
  { name: "NoFall / AntiKnockback", desc: "Fallschaden oder Rückstoß deaktivieren" },
  { name: "Baritone (Automatisierter Abbau/Navigation)", desc: "Bot-ähnliche Automatisierung" },
  { name: "FreeCam (zum Ausspähen von Spielern)", desc: "Außerhalb des Körpers die Welt erkunden" },
  { name: "Scaffold / Scaffold Hacks", desc: "Automatisches Platzieren von Blöcken" },
  { name: "ESP / Wallhack", desc: "Spieler/Items durch Wände sehen" },
  { name: "Minimap mit Spieler-Radar", desc: "Zeigt Positionen anderer Spieler auf der Karte" },
  { name: "Radar-Mods", desc: "Jegliche Mods, die Spieler oder Mobs orten" },
  { name: "Schematic Mods (zum Kopieren fremder Bauten)", desc: "Bauten anderer Spieler ohne Erlaubnis kopieren" },
  { name: "Auto-Fisher / Auto-Farm Mods", desc: "Vollautomatisches Angeln oder Farmen ohne Anwesenheit" },
  { name: "Macro Mods (im Vorteilskontext)", desc: "Automationen, die Spielern ungerechtfertigte Vorteile verschaffen" },
  { name: "Seed Finder / Seed-Viewer / Seed Cracker", desc: "Ermöglicht das Erkennen von Strukturen und Ressourcen" },
  { name: "FreeLook ohne Einschränkung", desc: "Sich umschauen ohne Körperbewegung (Stealth-Vorteil)" },
];

const RULES = [
  {
    nr: "§ 1",
    title: "Respektvoller Umgang",
    text: "Jeder Spieler ist mit Respekt zu behandeln. Beleidigungen, Diskriminierung, Hetze oder Mobbing sind verboten – egal ob im Chat, auf Discord oder über andere Kanäle.",
  },
  {
    nr: "§ 2",
    title: "Kein Cheating / Hacking",
    text: "Die Nutzung von Hacks, Cheats oder Mods, die einen unfairen Vorteil gegenüber anderen Spielern verschaffen, ist strikt verboten. Siehe Mod-Liste unten.",
  },
  {
    nr: "§ 3",
    title: "Kein Spam / kein Flooding",
    text: "Wiederholtes Senden gleicher Nachrichten, sinnloser Zeichenfolgen oder übermäßiger Nutzung von Großbuchstaben im Chat ist verboten.",
  },
  {
    nr: "§ 4",
    title: "Keine Werbung",
    text: "Das Bewerben fremder Server, Websites oder Discord-Server ist ohne ausdrückliche Genehmigung des Teams verboten.",
  },
  {
    nr: "§ 5",
    title: "Bug-Reporting",
    text: "Gefundene Bugs oder Exploits sind dem Team zu melden und dürfen nicht zum eigenen Vorteil ausgenutzt werden. Wer Exploits ausnutzt, riskiert einen permanenten Bann.",
  },
  {
    nr: "§ 6",
    title: "Team-Entscheidungen",
    text: "Entscheidungen des Serverteams sind zu respektieren. Bei Unklarheiten oder Uneinigkeiten ist der Beschwerdeweg über Discord einzuhalten.",
  },
  {
    nr: "§ 7",
    title: "Accounts & Sharing",
    text: "Jeder Spieler ist für seinen Account verantwortlich. Account-Sharing ist auf eigene Gefahr – Verstöße werden dem Account zugerechnet, unabhängig davon, wer gespielt hat.",
  },
  {
    nr: "§ 8",
    title: "Sanktionen",
    text: "Das Team behält sich vor, bei Regelverstößen Verwarnungen, temporäre Bans oder dauerhafte Sperrungen auszusprechen. Schwere Verstöße können ohne Vorwarnung zu einem permanenten Bann führen.",
  },
];

export default function RegelwerkPage() {
  return (
    <div className="mx-auto max-w-4xl py-12 px-4">
      {/* Header */}
      <div className="mb-12 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Spielregeln
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Regelwerk</h1>
        <p className="mt-4 text-base text-neutral-400 max-w-xl mx-auto">
          Das offizielle Regelwerk des TryCity Minecraft-Netzwerks. Mit dem Betreten des Servers
          erkennst du diese Regeln automatisch an.
        </p>
      </div>

      {/* Allgemeine Regeln */}
      <section className="mb-16">
        <SectionHeader icon={<ShieldCheck className="h-5 w-5 text-sky-400" />} title="Allgemeine Regeln" color="sky" />
        <div className="mt-6 flex flex-col gap-4">
          {RULES.map((rule) => (
            <div
              key={rule.nr}
              className="flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-5"
            >
              <span className="shrink-0 rounded-lg bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-400 self-start">
                {rule.nr}
              </span>
              <div>
                <p className="font-semibold text-neutral-100">{rule.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-400">{rule.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Erlaubte Mods */}
      <section className="mb-16">
        <SectionHeader icon={<CheckCircle className="h-5 w-5 text-emerald-400" />} title="Erlaubte Mods" color="emerald" />
        <p className="mt-3 text-sm text-neutral-500">
          Diese Mods sind ausdrücklich erlaubt und können ohne Bedenken genutzt werden.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ALLOWED_MODS.map((mod) => (
            <div
              key={mod.name}
              className="flex items-start gap-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-4 py-3"
            >
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-neutral-100">{mod.name}</p>
                <p className="text-xs text-neutral-500">{mod.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Verbotene Mods – kein Join möglich */}
      <section className="mb-16">
        <SectionHeader icon={<XCircle className="h-5 w-5 text-red-400" />} title="Verbotene Mods – kein Join möglich" color="red" />
        <p className="mt-3 text-sm text-neutral-500">
          Mit diesen Clients oder Mods ist ein Verbinden mit dem Server technisch blockiert oder führt zu einem sofortigen Bann.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {BANNED_CANT_JOIN.map((mod) => (
            <div
              key={mod.name}
              className="flex items-start gap-3 rounded-xl border border-red-500/10 bg-red-500/[0.04] px-4 py-3"
            >
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-neutral-100">{mod.name}</p>
                <p className="text-xs text-neutral-500">{mod.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer-Hinweis */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-6 py-5 text-center text-sm text-neutral-500">
        Das Regelwerk kann jederzeit angepasst werden. Spieler werden über Änderungen auf unserem{" "}
        <a
          href="https://discord.gg/zJaQ8tfyzh"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Discord
        </a>{" "}
        informiert. Stand: Juli 2026.
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  color: "sky" | "emerald" | "red" | "amber";
}) {
  const borderColor = {
    sky: "border-sky-500/30",
    emerald: "border-emerald-500/30",
    red: "border-red-500/30",
    amber: "border-amber-500/30",
  }[color];

  return (
    <div className={`flex items-center gap-3 border-b pb-3 ${borderColor}`}>
      {icon}
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
  );
}

