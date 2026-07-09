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

## Konfiguration

Alle Zugangsdaten ausschließlich über Umgebungsvariablen
(`.env.local` / `.env`, niemals committen – siehe `.env.example`):

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `AUTH_SECRET` – Zufallsstring zum Signieren der Sessions

## Deployment

Siehe [DEPLOY.md](DEPLOY.md) (Node 22, systemd, nginx, Let's Encrypt).
Datenbank-Setup (Login-Tabelle + eingeschränkter Web-User): `setup.sql`.
