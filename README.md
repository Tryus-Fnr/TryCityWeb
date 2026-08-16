# TryCityWeb

Website des TryCity-Minecraft-Netzwerks: Server-Statistiken, Item-Werte mit
Preisverlaufs-Graphen und Login über das Minecraft-Konto (Code kommt ingame).

## Stack

- **Next.js 16** (App Router, TypeScript) – Frontend + API in einer App
- **Tailwind CSS 4** – Styling
- **Recharts** – Graphen
- **mysql2** – direkter Lesezugriff auf die Spiel-Datenbank
- **jose** – JWT-Sessions (httpOnly-Cookie)

## Datenquellen (von den MC-Servern befüllt)

| Tabelle                  | Inhalt                                    |
| ------------------------ | ----------------------------------------- |
| `server_statistics`      | Spielerzahlen alle 5 Min (Proxy)          |
| `smpg_sell_prices`       | aktuelle Verkaufspreise                   |
| `smpg_dynamic_prices`    | Einstellungen des dynamischen Preissystems |
| `smpg_price_history`     | Preis/Volumen pro Anpassungslauf          |
| `smpg_dynamic_price_log` | Admin-Änderungen (Marker im Graph)        |
| `smpg_web_login_codes`   | Login-Codes (einzige Schreib-Tabelle)     |

## Minecraft-Login

1. Spieler gibt im Web seinen MC-Namen ein → Code landet in `smpg_web_login_codes`.
2. Das SMPGlobal-Plugin stellt den Code ingame per Chat zu (`delivered = 1`).
3. Spieler gibt den Code im Web ein → Session-Cookie. Codes: 6-stellig,
   5 Minuten gültig, einmal verwendbar, nur nach Ingame-Zustellung akzeptiert.

## Entwicklung

```bash
cp .env.example .env.local   # Werte eintragen (siehe unten)
npm install
npm run dev                  # http://localhost:3000
```

Ohne erreichbare Datenbank läuft die Seite trotzdem – Kennzahlen/Graphen
zeigen dann Platzhalter.

## Vorschläge und Bug-Meldungen

Beides kommt von Spielern selbst und wird ausschließlich hier eingereicht.

| Seite          | Wer                     | Inhalt                                            |
| -------------- | ----------------------- | ------------------------------------------------- |
| `/vorschlaege` | lesen alle, sonst Login | Ideen einreichen, dafür/dagegen stimmen           |
| `/bugs`        | Login                   | Fehler melden, bis 3 Screenshots, eigene Meldungen |
| `/mod/bugs`    | Mod/Admin               | alle Meldungen inkl. Bilder, Priorität & Status   |

Tabellen: `smpg_suggestions`, `smpg_suggestion_votes` und `smpg_bug_images`
(alle in `setup.sql`) sowie `smpg_bugs`, die vom SMPGlobal-Plugin angelegt wird.

**Ingame** gibt es das Melde-Formular nicht mehr: `/bug` zeigt nur noch den Link
hierher (`de.leon.sMPGlobal.bug.BugCommand.REPORT_URL`), `/bug admin` bleibt und
liest dieselbe Tabelle. Screenshots sind ingame nicht darstellbar – dort steht
nur, wie viele es sind.

**Doppelte Ideen** fängt eine Ähnlichkeitssuche ab, die schon beim Tippen des
Titels läuft (`lib/similarity.ts`): Zeichen-Trigramme plus Wortstämme, gerechnet
über einen Titel-Index, der eine Minute im Speicher liegt. Bewusst ohne KI – das
muss zwischen zwei Tastenanschlägen fertig sein. Ab 0,82 Ähnlichkeit lässt sich
ein Vorschlag erst nach ausdrücklicher Bestätigung abschicken; geprüft wird das
beim Absenden noch einmal, damit es sich nicht am Formular vorbei umgehen lässt.

**Missbrauchsschutz** (`lib/feedbackInput.ts` und die Routen unter `app/api`):
Tagesmenge und Mindestabstand je Konto aus der Datenbank, Rate-Limits je Konto
und IP, gesperrte oder stummgeschaltete Konten reichen nichts ein, Textlängen
und unsichtbare Zeichen werden serverseitig zurechtgestutzt. Bilder rechnet der
Browser vor dem Hochladen auf 1600 px herunter und kodiert sie neu; der Server
prüft danach Kennbytes, Bildpunkte, Anzahl und Größe und liefert sie nur mit
`nosniff` an den Melder und das Team aus.

## Konfiguration

Alle Zugangsdaten ausschließlich über Umgebungsvariablen
(`.env.local` / `.env`, niemals committen – siehe `.env.example`):

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `AUTH_SECRET` – Zufallsstring zum Signieren der Sessions

## Deployment

Siehe [DEPLOY.md](DEPLOY.md) (Node 22, systemd, nginx, Let's Encrypt).
Datenbank-Setup (Login-Tabelle + eingeschränkter Web-User): `setup.sql`.
