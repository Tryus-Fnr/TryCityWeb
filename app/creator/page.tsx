import type { Metadata } from "next";
import { requireCreator } from "@/lib/auth";
import {
  loadCreatorStats,
  loadCreatorEarnings,
  loadCreatorActiveUsers,
} from "@/lib/queries";

export const metadata: Metadata = { title: "Creator-Dashboard – TryCity" };

/** Kein Caching: die Zahlen sollen beim Aufruf aktuell sein. */
export const dynamic = "force-dynamic";

const EARNINGS_DAYS = 30;

function formatNumber(value: number): string {
  return value.toLocaleString("de-DE");
}

/** "2026-07-16 14:23:05" → "14:23 Uhr, 16.07.2026" (erst Uhrzeit, ohne Sekunden) */
function formatDateTime(value: string): string {
  const [date, time] = value.split(" ");
  if (!date || !time) return value;
  const [y, m, d] = date.split("-");
  return `${time.slice(0, 5)} Uhr, ${d}.${m}.${y}`;
}

/** "2026-07-16" → "16.07." */
function formatDay(value: string): string {
  const [y, m, d] = value.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-sm text-neutral-400">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          accent ? "text-cyan-400" : "text-neutral-100"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}

/** Gems-Kennzeichnung. Das Ingame-Icon stammt aus dem Texturepack und steht im
 *  Browser nicht zur Verfügung – hier deshalb dieselbe Farbe (Cyan) + 💎. */
function Gems({ value }: { value: number }) {
  return (
    <span className="text-cyan-400 tabular-nums">💎 {formatNumber(value)}</span>
  );
}

export default async function CreatorPage() {
  const code = await requireCreator();

  const [stats, earnings, users] = await Promise.all([
    loadCreatorStats(code.code),
    loadCreatorEarnings(code.code, EARNINGS_DAYS),
    loadCreatorActiveUsers(code.code),
  ]);

  const maxGems = Math.max(1, ...earnings.map((e) => e.gems));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Creator-Dashboard</h1>
        <p className="mt-1 text-neutral-400">
          Dein Code:{" "}
          <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-cyan-400">
            {code.code}
          </span>{" "}
          – Spieler tragen ihn im Gem-Shop ein. Du bekommst bei jedem Gem-Kauf
          einen Anteil der ausgegebenen Gems obendrauf.
        </p>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Aktuelle Nutzer"
          value={formatNumber(stats.currentUsers)}
          hint="Code gerade eingetragen"
        />
        <StatCard
          label="Nutzer (30 Tage)"
          value={formatNumber(stats.users30d)}
          hint="pro Spieler einmal gezählt"
        />
        <StatCard
          label="Nutzer gesamt"
          value={formatNumber(stats.usersTotal)}
          hint="seit Beginn, pro Spieler einmal"
        />
        <StatCard
          label="Gems gesamt"
          value={`💎 ${formatNumber(stats.gemsTotal)}`}
          hint="durch deinen Code verdient"
          accent
        />
        <StatCard
          label="Gems (30 Tage)"
          value={`💎 ${formatNumber(stats.gems30d)}`}
          accent
        />
        <StatCard
          label="Käufe gesamt"
          value={formatNumber(stats.purchasesTotal)}
          hint="Gem-Käufe mit deinem Code"
        />
      </div>

      {/* Verdienst pro Tag */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-lg font-semibold">
          Verdienst pro Tag{" "}
          <span className="text-sm font-normal text-neutral-500">
            (letzte {EARNINGS_DAYS} Tage)
          </span>
        </h2>

        {earnings.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Noch keine Einnahmen. Sobald jemand mit deinem Code Gems ausgibt,
            erscheint hier ein Eintrag pro Tag.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-neutral-400">
                  <th className="pb-2 pr-4 font-medium">Tag</th>
                  <th className="pb-2 pr-4 font-medium">Gems</th>
                  <th className="pb-2 pr-4 font-medium">Käufe</th>
                  <th className="pb-2 font-medium">Anteil</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.day} className="border-b border-neutral-900">
                    <td className="py-2 pr-4 whitespace-nowrap text-neutral-300">
                      {formatDay(e.day)}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <Gems value={e.gems} />
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-neutral-400">
                      {formatNumber(e.purchases)}
                    </td>
                    <td className="py-2 w-1/2 min-w-32">
                      {/* Balken relativ zum besten Tag */}
                      <div className="h-2 w-full rounded-full bg-neutral-800">
                        <div
                          className="h-2 rounded-full bg-cyan-500"
                          style={{ width: `${(e.gems / maxGems) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aktuelle Nutzer */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <h2 className="text-lg font-semibold">
          Aktuelle Nutzer{" "}
          <span className="text-sm font-normal text-neutral-500">
            ({users.length})
          </span>
        </h2>

        {users.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Aktuell hat niemand deinen Code eingetragen.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-neutral-400">
                  <th className="pb-2 pr-4 font-medium">Spieler</th>
                  <th className="pb-2 pr-4 font-medium">Eingetragen</th>
                  <th className="pb-2 font-medium">Läuft ab</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={`${u.playerName}-${u.enteredAt}`}
                    className="border-b border-neutral-900"
                  >
                    <td className="py-2 pr-4 text-neutral-200">{u.playerName}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-neutral-400">
                      {formatDateTime(u.enteredAt)}
                    </td>
                    <td className="py-2 whitespace-nowrap text-neutral-400">
                      {formatDateTime(u.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-600">
        Ein eingetragener Code gilt 7 Tage. Trägt ein Spieler ihn erneut ein,
        verlängert sich die Laufzeit – als Nutzer zählt er trotzdem nur einmal.
      </p>
    </div>
  );
}
