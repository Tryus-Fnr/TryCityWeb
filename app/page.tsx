import Image from "next/image";
import {
  TrendingUp,
  Hammer,
  Package,
  Crosshair,
  BarChart2,
  Map,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getAdminStatus } from "@/lib/auth";
import TabCarousel, { type CarouselTab } from "@/components/TabCarousel";

export const dynamic = "force-dynamic";

interface Feature {
  title: string;
  description: string;
  detail: string;
  Icon: LucideIcon;
  accentText: string;
  accentBg: string;
}

const features: Feature[] = [
  {
    title: "Dynamische Wirtschaft",
    description:
      "Der Server-Shop kauft und verkauft Items zu Preisen, die von Angebot und Nachfrage aller Spieler bestimmt werden. Je mehr ein Item nachgefragt wird, desto teurer wird es – und sinkt wieder, wenn niemand kauft.",
    detail: "Jede Transaktion beeinflusst den Markt in Echtzeit.",
    Icon: TrendingUp,
    accentText: "text-sky-400",
    accentBg: "bg-sky-400/10",
  },
  {
    title: "Auktionshaus",
    description:
      "Handle direkt mit anderen Spielern. Stelle Items als Sofortkauf oder zeitlich begrenzte Auktion ein und biete auf laufende Angebote – ohne Umweg über den Server-Shop.",
    detail: "Spieler-zu-Spieler Handel in Echtzeit.",
    Icon: Hammer,
    accentText: "text-violet-400",
    accentBg: "bg-violet-400/10",
  },
  {
    title: "Kaufaufträge",
    description:
      "Spieler stellen offene Kaufaufträge für bestimmte Items und Mengen ein. Liefere die gewünschten Waren direkt an den Auftraggeber und kassiere die ausgelobten Coins – ohne eigenen Shop.",
    detail: "Eine faire Möglichkeit, auch ohne Startkapital Coins zu verdienen.",
    Icon: Package,
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-400/10",
  },
  {
    title: "Kopfgelder",
    description:
      "Setze Kopfgelder auf andere Spieler oder kassiere bestehende Prämien ein. Eine öffentliche Bestenliste zeigt, wer aktuell am meisten Coins auf dem Kopf trägt.",
    detail: "Wer steht ganz oben auf der Liste?",
    Icon: Crosshair,
    accentText: "text-red-400",
    accentBg: "bg-red-400/10",
  },
  {
    title: "Item-Preisverläufe",
    description:
      "Alle handelbaren Items auf einen Blick. Interaktive Verlaufsgraphen zeigen die Preisentwicklung der letzten Tage sowie Mindest- und Höchstwerte zum idealen Kauf- oder Verkaufszeitpunkt.",
    detail: "Erkenne Trends – kaufe günstig, verkaufe teuer.",
    Icon: BarChart2,
    accentText: "text-amber-400",
    accentBg: "bg-amber-400/10",
  },
  {
    title: "SMP Spielwelt",
    description:
      "Erkunde, baue und überlebe in einer offenen Survival-Spielwelt gemeinsam mit anderen Spielern. Verbünde dich, handle oder schlage deinen ganz eigenen Weg ein.",
    detail: "Eine lebendige Welt voller Möglichkeiten.",
    Icon: Map,
    accentText: "text-green-400",
    accentBg: "bg-green-400/10",
  },
  {
    title: "Server-Statistiken",
    description:
      "Echtzeit-Übersicht aller aktiven Server und aktuellen Spielerzahlen. Verfolge Peak-Zeiten, Serverkapazitäten und Entwicklungen über 24 Stunden, 7 oder 30 Tage.",
    detail: "Historische Daten bis zu 30 Tage zurück.",
    Icon: Server,
    accentText: "text-blue-400",
    accentBg: "bg-blue-400/10",
  },
  {
    title: "Spieler-Profile",
    description:
      "Detaillierte Profile aller SMP-Spieler mit Wirtschaftsdaten, Vitalwerten, Spielstatistiken und Verlauf – alles an einem Ort übersichtlich aufbereitet und vergleichbar.",
    detail: "Verfolge deinen Fortschritt und vergleiche dich mit anderen.",
    Icon: Users,
    accentText: "text-purple-400",
    accentBg: "bg-purple-400/10",
  },
];

export default async function Home() {
  const isAdmin = await getAdminStatus();

  const tabs: CarouselTab[] = [
    {
      href: "/items",
      title: "Item-Werte",
      description:
        "Alle Verkaufspreise der dynamischen Wirtschaft mit Preisverlaufs-Graphen pro Item.",
    },
    {
      href: "/auction",
      title: "Auktionshaus",
      description:
        "Aktive Sofortkäufe und laufende Auktionen von Spielern – filterbar und sortierbar.",
    },
    {
      href: "/orders",
      title: "Orders",
      description:
        "Offene Kaufaufträge: liefere Items an Spieler und verdiene Coins.",
    },
    {
      href: "/bounties",
      title: "Kopfgelder",
      description:
        "Aktive Kopfgelder auf Spieler – wer steht ganz oben auf der Liste?",
    },
    ...(isAdmin
      ? ([
          {
            href: "/stats",
            title: "Server-Stats",
            description:
              "Spielerzahlen-Verlauf über 24 Stunden, 7 oder 30 Tage – gesamt und pro Server.",
          },
          {
            href: "/servermap",
            title: "Server-Karte",
            description:
              "Interaktive zoombare Karte aller SMP-Server-Regionen mit Koordinaten und Status.",
          },
          {
            href: "/players",
            title: "SMP-Spieler",
            description:
              "Alle Spieler des SMP mit Statistiken, Wirtschaftsdaten, Vitalwerten und Spielprofil.",
          },
        ] satisfies CarouselTab[])
      : []),
  ];

  return (
    <div className="flex flex-col">
      {/* ── HERO BANNER ── */}
      <section
        className="relative -mt-8 h-[72vh] min-h-[520px] overflow-hidden"
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      >
        <Image
          src="/banner.jpg"
          alt="TryCity Banner"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/25 to-[#0a0a0b]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-7xl font-black tracking-tight text-white drop-shadow-lg sm:text-9xl">
            TryCity
          </h1>
          <p className="mt-5 max-w-lg text-lg font-light text-neutral-200/90 drop-shadow sm:text-xl">
            Minecraft-Netzwerk mit lebendiger Wirtschaft, Auktionen, Kopfgeldern und mehr.
          </p>
        </div>
      </section>

      {/* ── JOIN ── */}
      <section className="border-b border-white/[0.08] py-14 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Jetzt mitspielen
        </p>
        <h2 className="mt-3 text-2xl font-bold">Trete dem Netzwerk bei</h2>
        <div className="mx-auto mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ServerAddress edition="Java Edition" address="play.trycity.de" />
          <ServerAddress
            edition="Bedrock Edition"
            address="play.trycity.de"
            port="19132"
          />
        </div>
      </section>

      {/* ── FEATURE SECTIONS ── */}
      <div className="divide-y divide-white/[0.06]">
        {features.map((feature, i) => (
          <FeatureSection
            key={feature.title}
            feature={feature}
            reversed={i % 2 === 1}
          />
        ))}
      </div>

      {/* ── TAB CAROUSEL ── */}
      <section className="overflow-hidden py-20">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Navigation
          </p>
          <h2 className="mt-2 text-2xl font-bold">Alle Bereiche auf einen Blick</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Fahre mit der Maus über eine Karte zum Pausieren &middot; Scrolle mit dem
            Mausrad
          </p>
        </div>
        <TabCarousel tabs={tabs} />
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function ServerAddress({
  edition,
  address,
  port,
}: {
  edition: string;
  address: string;
  port?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3.5 transition-colors hover:border-white/20">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
        {edition}
      </span>
      <span className="font-mono text-sm text-neutral-100">{address}</span>
      {port && (
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-neutral-400">
          :{port}
        </span>
      )}
    </div>
  );
}

function FeatureSection({
  feature,
  reversed,
}: {
  feature: Feature;
  reversed: boolean;
}) {
  const { title, description, detail, Icon, accentText, accentBg } = feature;
  return (
    <section
      className={`flex flex-col gap-10 py-16 sm:flex-row sm:items-center sm:gap-20 ${
        reversed ? "sm:flex-row-reverse" : ""
      }`}
    >
      <div
        className={`flex flex-1 justify-center ${
          reversed ? "sm:justify-end" : "sm:justify-start"
        }`}
      >
        <div
          className={`flex h-36 w-36 items-center justify-center rounded-3xl ${accentBg} ring-1 ring-white/10`}
        >
          <Icon className={`h-16 w-16 ${accentText}`} strokeWidth={1.25} />
        </div>
      </div>
      <div className="flex-[2]">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-4 text-base leading-relaxed text-neutral-400">
          {description}
        </p>
        <p className={`mt-4 text-sm font-semibold ${accentText}`}>
          {detail}
        </p>
      </div>
    </section>
  );
}
