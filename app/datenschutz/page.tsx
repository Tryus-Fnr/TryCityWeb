import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutz – TryCity",
  description: "Datenschutzerklärung des TryCity Minecraft-Netzwerks.",
};

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-3xl py-12 px-4">
      <div className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Rechtliches
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Datenschutzerklärung</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Gemäß DSGVO (EU 2016/679) und dem Bundesdatenschutzgesetz (BDSG)
        </p>
      </div>

      <div className="flex flex-col gap-8 text-sm leading-relaxed text-neutral-300">

        <Section title="1. Verantwortlicher">
          <p>
            Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
          </p>
          <p className="mt-3">
            <span className="font-semibold text-neutral-100">Leon M. (Tryus)</span><br />
            Betreiber des TryCity Minecraft-Netzwerks<br />
            Deutschland<br />
            E-Mail:{" "}
            <a
              href="mailto:contact@trycity.net"
              className="text-sky-400 hover:text-sky-300 transition-colors"
            >
              contact@trycity.net
            </a>
          </p>
        </Section>

        <Section title="2. Erhobene Daten und Zweck">
          <p className="text-neutral-400">
            Wir verarbeiten nur die Daten, die für den Betrieb des Netzwerks und der Website
            unbedingt erforderlich sind.
          </p>

          <SubHeading>2.1 Minecraft-Spielerdaten</SubHeading>
          <ul className="list-disc list-inside text-neutral-400 mt-2 flex flex-col gap-1">
            <li>Minecraft-UUID und Spielername (öffentliche Mojang-Daten)</li>
            <li>Spielstatistiken (Coins, Kills, Deaths, Online-Zeit etc.)</li>
            <li>Wirtschaftsdaten (Käufe, Verkäufe, Auktionen, Kopfgelder)</li>
            <li>Letzter Login-Zeitpunkt und Spielzeit</li>
          </ul>
          <p className="mt-2 text-neutral-500 text-xs">
            Zweck: Betrieb der Spielfunktionen, Wirtschaftssystem, Ranglisten und Server-Statistiken.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung / Nutzungsverhältnis).
          </p>

          <SubHeading>2.2 Website-Login (Session)</SubHeading>
          <p className="text-neutral-400">
            Beim Login auf der Website wird ein signiertes JWT-Cookie gesetzt, das folgende Daten enthält:
          </p>
          <ul className="list-disc list-inside text-neutral-400 mt-2 flex flex-col gap-1">
            <li>Minecraft-UUID und Spielername</li>
            <li>Ausstellungszeitpunkt der Session</li>
          </ul>
          <p className="mt-2 text-neutral-500 text-xs">
            Das Cookie ist als <code className="bg-white/5 px-1 rounded">HttpOnly</code> gesetzt und
            für JavaScript nicht zugänglich. Es wird ausschließlich für die Authentifizierung verwendet.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
          </p>

          <SubHeading>2.3 Server-Logs und IP-Adressen</SubHeading>
          <p className="text-neutral-400">
            Beim Verbinden mit dem Minecraft-Server wird deine IP-Adresse temporär im Server-Log gespeichert.
            Diese Daten werden für Sicherheitszwecke (Anti-Cheat, Bann-System) verwendet und nicht an
            Dritte weitergegeben.
          </p>
          <p className="mt-2 text-neutral-500 text-xs">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit und Betrug-Prävention).
          </p>

          <SubHeading>2.4 Webserver-Logs</SubHeading>
          <p className="text-neutral-400">
            Beim Aufrufen der Website werden folgende Daten automatisch erhoben:
          </p>
          <ul className="list-disc list-inside text-neutral-400 mt-2 flex flex-col gap-1">
            <li>IP-Adresse (anonymisiert nach 7 Tagen)</li>
            <li>Aufgerufene URL, Zeitpunkt und HTTP-Statuscode</li>
            <li>Browser-Typ und Betriebssystem (User-Agent)</li>
          </ul>
          <p className="mt-2 text-neutral-500 text-xs">
            Zweck: Fehlerbehebung und Sicherheitsüberwachung.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
          </p>
        </Section>

        <Section title="3. Weitergabe an Dritte">
          <p className="text-neutral-400">
            Deine Daten werden nicht an Dritte verkauft oder zu Werbezwecken weitergegeben.
            Eine Übermittlung an Dritte erfolgt nur:
          </p>
          <ul className="list-disc list-inside text-neutral-400 mt-2 flex flex-col gap-1">
            <li>Auf ausdrückliche Anforderung durch Behörden (gesetzliche Verpflichtung)</li>
            <li>An Hosting-Dienstleister im Rahmen der Auftragsverarbeitung (Art. 28 DSGVO)</li>
          </ul>
          <p className="mt-3 text-neutral-400">
            Externe Dienste, die beim Besuch der Website geladen werden:
          </p>
          <ul className="list-disc list-inside text-neutral-400 mt-2 flex flex-col gap-1">
            <li>
              <span className="font-semibold text-neutral-200">mc-heads.net</span> – Abruf von
              Minecraft-Spieler-Avataren. Beim Laden wird deine IP an mc-heads.net übermittelt.
            </li>
            <li>
              <span className="font-semibold text-neutral-200">Google Fonts</span> – Schriftarten
              (Geist Sans / Mono), werden über Google-Server geladen.
            </li>
          </ul>
        </Section>

        <Section title="4. Cookies">
          <p className="text-neutral-400">
            Die Website setzt ausschließlich technisch notwendige Cookies:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs text-neutral-400 border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-neutral-300">
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2 pr-4">Zweck</th>
                  <th className="text-left py-2">Laufzeit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/[0.05]">
                  <td className="py-2 pr-4 font-mono">session</td>
                  <td className="py-2 pr-4">Authentifizierung (Login-Status)</td>
                  <td className="py-2">7 Tage / bis Abmeldung</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-neutral-500 text-xs">
            Es werden keine Tracking- oder Marketing-Cookies verwendet.
          </p>
        </Section>

        <Section title="5. Speicherdauer">
          <p className="text-neutral-400">
            Spielerdaten werden so lange gespeichert, wie das Spieler-Konto aktiv ist oder der
            Spieler am Netzwerk teilnimmt. Auf Anfrage können Daten gelöscht werden (siehe Abschnitt 6).
            Server-Logs werden nach spätestens 30 Tagen gelöscht.
          </p>
        </Section>

        <Section title="6. Deine Rechte">
          <p className="text-neutral-400">
            Gemäß DSGVO stehen dir folgende Rechte zu:
          </p>
          <ul className="list-disc list-inside text-neutral-400 mt-2 flex flex-col gap-1.5">
            <li><span className="text-neutral-200">Auskunftsrecht</span> (Art. 15 DSGVO): Welche Daten speichern wir über dich?</li>
            <li><span className="text-neutral-200">Berichtigungsrecht</span> (Art. 16 DSGVO): Korrektur falscher Daten</li>
            <li><span className="text-neutral-200">Löschungsrecht</span> (Art. 17 DSGVO): „Recht auf Vergessenwerden"</li>
            <li><span className="text-neutral-200">Einschränkung der Verarbeitung</span> (Art. 18 DSGVO)</li>
            <li><span className="text-neutral-200">Datenübertragbarkeit</span> (Art. 20 DSGVO)</li>
            <li><span className="text-neutral-200">Widerspruchsrecht</span> (Art. 21 DSGVO)</li>
            <li><span className="text-neutral-200">Beschwerderecht</span> bei der zuständigen Datenschutzbehörde</li>
          </ul>
          <p className="mt-3 text-neutral-400">
            Zur Geltendmachung deiner Rechte wende dich per E-Mail an:{" "}
            <a
              href="mailto:contact@trycity.net"
              className="text-sky-400 hover:text-sky-300 transition-colors"
            >
              contact@trycity.net
            </a>
          </p>
        </Section>

        <Section title="7. Datensicherheit">
          <p className="text-neutral-400">
            Die Website wird über HTTPS ausgeliefert. Session-Cookies sind als{" "}
            <code className="bg-white/5 px-1 rounded">HttpOnly</code> und{" "}
            <code className="bg-white/5 px-1 rounded">Secure</code> gesetzt. Datenbankzugriffe
            erfolgen ausschließlich über verschlüsselte Verbindungen innerhalb gesicherter Server-Infrastruktur.
          </p>
        </Section>

        <Section title="8. Änderungen dieser Datenschutzerklärung">
          <p className="text-neutral-400">
            Diese Datenschutzerklärung kann bei Bedarf angepasst werden. Änderungen werden auf dieser
            Seite veröffentlicht. Wir empfehlen, diese Seite regelmäßig zu prüfen.
          </p>
        </Section>

        <Section title="9. Zuständige Aufsichtsbehörde">
          <p className="text-neutral-400">
            Wenn du der Meinung bist, dass die Verarbeitung deiner Daten gegen das Datenschutzrecht
            verstößt, hast du das Recht, dich bei der zuständigen Datenschutzaufsichtsbehörde zu beschweren.
            In Deutschland ist dies der jeweilige Landesbeauftragte für Datenschutz und Informationsfreiheit.
          </p>
        </Section>

      </div>

      <p className="mt-12 text-xs text-neutral-600">
        Stand: Juli 2025 · TryCity Netzwerk
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
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 font-semibold text-neutral-200">{children}</p>
  );
}

