import type { Metadata } from "next";
import { requireCreator } from "@/lib/auth";
import {
  loadCreatorStats,
  loadCreatorEarnings,
  loadCreatorActiveUsers,
} from "@/lib/queries";
import CreatorChart from "@/components/CreatorChart";
import {
  Diamond,
  Users,
  UserCheck,
  ShoppingCart,
  TrendingUp,
  Clock,
} from "lucide-react";

export const metadata: Metadata = { title: "Creator-Dashboard – TryCity" };
export const dynamic = "force-dynamic";

const EARNINGS_DAYS = 30;

function fmt(value: number): string {
  return value.toLocaleString("de-DE");
}

function formatDateTime(value: string): string {
  const [date, time] = value.split(" ");
  if (!date || !time) return value;
  const [y, m, d] = date.split("-");
  return `${time.slice(0, 5)} Uhr, ${d}.${m}.${y}`;
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">{label}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            accent
              ? "bg-cyan-500/10 text-cyan-400"
              : "bg-white/5 text-neutral-400"
          }`}
        >
          <Icon size={15} />
        </span>
      </div>
      <div
        className={`text-2xl font-bold tabular-nums tracking-tight ${
          accent ? "text-cyan-400" : "text-neutral-100"
        }`}
      >
        {value}
      </div>
      {hint && <p className="text-xs text-neutral-600">{hint}</p>}
    </div>
  );
}

export default async function CreatorPage() {
  const code = await requireCreator();

  const [stats, earnings, users] = await Promise.all([
    loadCreatorStats(code.code),
    loadCreatorEarnings(code.code, EARNINGS_DAYS),
    loadCreatorActiveUsers(code.code),
  ]);

  return (
    <div className="flex flex-col gap-7">
      {/* Title bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Creator-Dashboard
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Verdienste & Reichweite deines Codes in der Übersicht
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
          <span className="text-neutral-500">Dein Code</span>
          <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-xs font-semibold tracking-widest text-cyan-400 ring-1 ring-cyan-500/20">
            {code.code}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Gems gesamt"
          value={`💎 ${fmt(stats.gemsTotal)}`}
          hint="durch deinen Code verdient"
          icon={Diamond}
          accent
        />
        <StatCard
          label="Gems (30 Tage)"
          value={`💎 ${fmt(stats.gems30d)}`}
          icon={TrendingUp}
          accent
        />
        <StatCard
          label="Käufe gesamt"
          value={fmt(stats.purchasesTotal)}
          hint="Gem-Käufe mit deinem Code"
          icon={ShoppingCart}
        />
        <StatCard
          label="Aktuelle Nutzer"
          value={fmt(stats.currentUsers)}
          hint="Code gerade aktiv"
          icon={UserCheck}
        />
        <StatCard
          label="Nutzer (30 Tage)"
          value={fmt(stats.users30d)}
          hint="pro Spieler einmal gezählt"
          icon={Users}
        />
        <StatCard
          label="Nutzer gesamt"
          value={fmt(stats.usersTotal)}
          hint="seit Beginn"
          icon={Users}
        />
      </div>

      {/* Chart */}
      <CreatorChart earnings={earnings} />

      {/* Active users */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-neutral-100">
              Aktive Nutzer
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Haben deinen Code aktuell eingetragen
            </p>
          </div>
          <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 ring-1 ring-cyan-500/20">
            {users.length}
          </span>
        </div>

        {users.length === 0 ? (
          <p className="mt-6 text-center text-sm text-neutral-600">
            Aktuell hat niemand deinen Code eingetragen.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="pb-2.5 pr-4 text-xs font-medium text-neutral-500">
                    Spieler
                  </th>
                  <th className="pb-2.5 pr-4 text-xs font-medium text-neutral-500">
                    Eingetragen
                  </th>
                  <th className="pb-2.5 text-xs font-medium text-neutral-500">
                    Läuft ab
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={`${u.playerName}-${u.enteredAt}`}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-[10px] font-bold text-neutral-400">
                          {getInitials(u.playerName)}
                        </span>
                        <span className="font-medium text-neutral-200">
                          {u.playerName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-neutral-500">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} className="shrink-0" />
                        {formatDateTime(u.enteredAt)}
                      </span>
                    </td>
                    <td className="py-3 whitespace-nowrap text-neutral-500">
                      {formatDateTime(u.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-neutral-700">
        Ein eingetragener Code gilt 7 Tage. Du bekommst bei jedem Gem-Kauf
        eines aktiven Nutzers einen Anteil der ausgegebenen Gems obendrauf.
      </p>
    </div>
  );
}
