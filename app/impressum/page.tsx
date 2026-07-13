import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum – TryCity",
  description: "Impressum des TryCity Minecraft-Netzwerks.",
};

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-3xl py-12 px-4">
      <div className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Rechtliches
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Impressum</h1>
        <p className="mt-2 text-sm text-neutral-500">Angaben gemäß § 5 TMG</p>
      </div>

      <div className="flex flex-col gap-8 text-sm leading-relaxed text-neutral-300">

        {/* Betreiber */}
        <Section title="Betreiber">
          <p className="text-neutral-400">
            Das TryCity Netzwerk wird als kommerzielles Minecraft-Netzwerk betrieben. Über den offiziellen
            Store werden kostenpflichtige Leistungen angeboten.
          </p>
          <p className="mt-3">
            <span className="font-semibold text-neutral-100">Name:</span> Tom Adler
          </p>
          <p>
            <span className="font-semibold text-neutral-100">Projektname:</span> TryCity Netzwerk
          </p>
          <p>
            <span className="font-semibold text-neutral-100">Anschrift:</span> Deutschland
            {" "}
            <span className="text-neutral-600 text-xs">(vollständige Adresse auf Anfrage – siehe Kontakt)</span>
          </p>
        </Section>

        {/* Kontakt */}
        <Section title="Kontakt">
          <p>
            <span className="font-semibold text-neutral-100">E-Mail:</span>{" "}
            <a
              href="mailto:contact@trycity.net"
              className="text-sky-400 hover:text-sky-300 transition-colors"
            >
              contact@trycity.net
            </a>
          </p>
          <p>
            <span className="font-semibold text-neutral-100">Discord:</span>{" "}
            <a
              href="https://discord.gg/zJaQ8tfyzh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              discord.gg/zJaQ8tfyzh
            </a>
          </p>
        </Section>

        {/* Inhaltlich Verantwortlicher */}
        <Section title="Inhaltlich Verantwortlicher gemäß § 18 Abs. 2 MStV">
          <p>Tom Adler, Deutschland</p>
          <p className="mt-1 text-neutral-500 text-xs">
            Verantwortlich für Inhalte des Netzwerks, der Website und der zugehörigen Social-Media-Kanäle.
          </p>
        </Section>

        {/* Haftung für Inhalte */}
        <Section title="Haftung für Inhalte">
          <p className="text-neutral-400">
            Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
            Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich.
          </p>
        </Section>

        {/* Haftung für Links */}
        <Section title="Haftung für Links">
          <p className="text-neutral-400">
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
            Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
            der Seiten verantwortlich.
          </p>
        </Section>

        {/* Urheberrecht */}
        <Section title="Urheberrecht">
          <p className="text-neutral-400">
            Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
            dem deutschen Urheberrecht. Downloads und Kopien dieser Seite sind nur für den privaten,
            nicht kommerziellen Gebrauch gestattet.
          </p>
          <p className="mt-3 text-neutral-500 text-xs">
            Minecraft ist ein eingetragenes Warenzeichen der Mojang Studios / Microsoft Corporation.
            TryCity steht in keiner offiziellen Verbindung zu Mojang Studios oder Microsoft.
          </p>
        </Section>

        {/* Streitschlichtung */}
        <Section title="Streitschlichtung">
          <p className="text-neutral-400">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 transition-colors"
            >
              ec.europa.eu/consumers/odr
            </a>
            . Unsere E-Mail-Adresse lautet: contact@trycity.net
          </p>
          <p className="mt-3 text-neutral-400">
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>

        {/* Online-Shop Hinweis */}
        <Section title="Hinweis zum Online-Shop">
          <p className="text-neutral-400">
            Über{" "}
            <a
              href="https://shop.trycity.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              shop.trycity.net
            </a>{" "}
            werden kostenpflichtige virtuelle Leistungen (z. B. Ränge, kosmetische Items) für das
            TryCity Minecraft-Netzwerk angeboten. Vertragspartner ist dabei Tom Adler (TryCity Netzwerk).
            Für den Kauf gelten die im Shop hinterlegten AGB und Widerrufsbelehrungen.
          </p>
          <p className="mt-3 text-neutral-500 text-xs">
            Minecraft ist ein eingetragenes Warenzeichen der Mojang Studios / Microsoft Corporation.
            TryCity steht in keiner offiziellen Verbindung zu Mojang Studios oder Microsoft.
          </p>
        </Section>

      </div>

      <p className="mt-12 text-xs text-neutral-600">
        Stand: Juli 2026 · TryCity Netzwerk
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
      <h2 className="mb-3 text-base font-bold text-neutral-100 border-b border-white/[0.07] pb-2">
        {title}
      </h2>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

