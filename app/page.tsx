import Link from "next/link";
import { loadItems, loadPeak, loadServersNow } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Kennzahlen laden – bei DB-Ausfall Platzhalter zeigen statt Fehlerseite. */
async function loadHomeStats() {
  try {
    const [servers, items, peak] = await Promise.all([
      loadServersNow(),
      loadItems(),
      loadPeak(Date.now() - 24 * 3600_000),
    ]);
    return {
      online: servers.reduce((sum, s) => sum + s.online, 0),
      serverCount: servers.length,
      itemCount: items.length,
      peak24h: peak,
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const stats = await loadHomeStats();

  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section className="pt-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          TryCity
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-400">
          Live-Statistiken des TryCity-Netzwerks – Spielerzahlen, Item-Preise und
          Preisverläufe der dynamischen Wirtschaft.
        </p>
      </section>

      {/* Kennzahlen */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Spieler online" value={stats ? String(stats.online) : "–"} accent />
        <StatCard label="Peak (24h)" value={stats ? String(stats.peak24h) : "–"} />
        <StatCard label="Server" value={stats ? String(stats.serverCount) : "–"} />
        <StatCard label="Handelbare Items" value={stats ? String(stats.itemCount) : "–"} />
      </section>

      {/* Tabs / Bereiche */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TabCard
          href="/stats"
          title="Server-Stats"
          description="Spielerzahlen-Verlauf über 24 Stunden, 7 oder 30 Tage – gesamt und pro Server."
        />
        <TabCard
          href="/servermap"
          title="Server-Karte"
          description="Interaktive zoombare Karte aller SMP-Server-Regionen mit Koordinaten und Status."
        />
        <TabCard
          href="/items"
          title="Item-Werte"
          description="Alle Verkaufspreise der dynamischen Wirtschaft mit Preisverlaufs-Graphen pro Item."
        />
        <TabCard
          href="/auction"
          title="Auktionshaus"
          description="Aktive Sofortkäufe und laufende Auktionen von Spielern – filterbar und sortierbar."
        />
        <TabCard
          href="/orders"
          title="Orders"
          description="Offene Kaufaufträge: liefere Items an Spieler und verdiene Coins."
        />
        <TabCard
          href="/bounties"
          title="Kopfgelder"
          description="Aktive Kopfgelder auf Spieler – wer steht ganz oben auf der Liste?"
        />
        <TabCard
          href="/players"
          title="SMP-Spieler"
          description="Alle Spieler des SMP mit Statistiken, Wirtschaftsdaten, Vitalwerten und Spielprofil."
        />
      </section>

      {!stats && (
        <p className="text-center text-sm text-amber-400/80">
          Datenbank aktuell nicht erreichbar – Kennzahlen werden angezeigt, sobald die
          Verbindung steht.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <div className={`text-3xl font-bold ${accent ? "text-sky-400" : "text-neutral-100"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </div>
  );
}

function TabCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-sky-400/40 hover:bg-sky-400/5"
    >
      <h2 className="text-xl font-bold group-hover:text-sky-300">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</p>
      <span className="mt-4 inline-block text-sm font-medium text-sky-400">
        Öffnen →
      </span>
    </Link>
  );
}
