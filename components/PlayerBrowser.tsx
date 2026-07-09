"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type PlayerRow = {
  uuid: string;
  name: string;
  firstJoin: number;
  lastJoin: number;
  onlineTime: number;
  coins: number;
  gems: number;
  stars: number;
};

type PlayerDetail = {
  uuid: string;
  name: string;
  firstJoin: number;
  lastJoin: number;
  lastQuit: number;
  onlineTime: number;
  coins: number;
  gems: number;
  stars: number;
  balance: number | null;
  bankBalance: number | null;
  status: string | null;
  currentServer: string | null;
  lastServer: string | null;
  health: number | null;
  maxHealth: number | null;
  foodLevel: number | null;
  expLevel: number | null;
  experience: number | null;
  gameMode: string | null;
  pendingStarterKit: boolean | null;
  tutorialProgress: number | null;
};

function fmtDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h`;
  }
  return `${h}h ${m}m`;
}

function fmtDate(ms: number): string {
  if (!ms) return "–";
  return new Date(ms).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtMoney(v: number | null): string {
  if (v === null) return "–";
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

function StatusBadge({ status }: { status: string | null }) {
  const isOnline = status === "ONLINE";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isOnline
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-white/[0.06] text-neutral-400"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-neutral-500"
        }`}
      />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}

function PlayerAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <Image
      src={`https://crafatar.com/avatars/${encodeURIComponent(name)}?size=${size}&overlay`}
      alt={name}
      width={size}
      height={size}
      className="rounded"
      unoptimized
    />
  );
}

function DetailPanel({ uuid, onClose }: { uuid: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/players/${uuid}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setDetail(d.player);
        else setError(d.error ?? "Fehler");
      })
      .catch(() => setError("Netzwerkfehler"))
      .finally(() => setLoading(false));
  }, [uuid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#111112] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-white/10 bg-[#111112] px-6 py-4">
          {detail && (
            <PlayerAvatar name={detail.name} size={48} />
          )}
          <div className="flex-1">
            {detail ? (
              <>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">{detail.name}</h2>
                  <StatusBadge status={detail.status} />
                </div>
                <p className="mt-0.5 text-xs text-neutral-500 font-mono">{detail.uuid}</p>
              </>
            ) : (
              <div className="h-6 w-40 rounded bg-white/5 animate-pulse" />
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-neutral-500">Lade…</div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center text-red-400">{error}</div>
          ) : detail ? (
            <div className="flex flex-col gap-6">

              {/* Server-Status */}
              {detail.status && (
                <Section title="Server">
                  <StatGrid>
                    <Stat label="Status">
                      <StatusBadge status={detail.status} />
                    </Stat>
                    {detail.currentServer && (
                      <Stat label="Aktueller Server" value={detail.currentServer} />
                    )}
                    {detail.lastServer && (
                      <Stat label="Letzter Server" value={detail.lastServer} />
                    )}
                    {detail.gameMode && (
                      <Stat label="Spielmodus" value={detail.gameMode} />
                    )}
                  </StatGrid>
                </Section>
              )}

              {/* Vitalwerte */}
              {detail.health !== null && (
                <Section title="Vitalwerte">
                  <StatGrid>
                    <Stat label="❤ Leben">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-semibold">
                          {detail.health?.toFixed(1)} / {detail.maxHealth?.toFixed(1)}
                        </span>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{
                              width: `${
                                detail.maxHealth
                                  ? Math.min(100, ((detail.health ?? 0) / detail.maxHealth) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </Stat>
                    <Stat label="🍖 Hunger" value={`${detail.foodLevel ?? "–"} / 20`} />
                    <Stat label="✨ Level" value={String(detail.expLevel ?? "–")} />
                    <Stat
                      label="XP"
                      value={
                        detail.experience !== null
                          ? `${(detail.experience * 100).toFixed(0)} %`
                          : "–"
                      }
                    />
                  </StatGrid>
                </Section>
              )}

              {/* Wirtschaft */}
              <Section title="Wirtschaft">
                <StatGrid>
                  <Stat label="💰 Guthaben" value={fmtMoney(detail.balance)} accent />
                  <Stat label="🏦 Bankguthaben" value={fmtMoney(detail.bankBalance)} />
                  <Stat label="🪙 Coins" value={detail.coins.toLocaleString("de-DE")} />
                  <Stat label="💎 Gems" value={detail.gems.toLocaleString("de-DE")} />
                  <Stat label="⭐ Stars" value={detail.stars.toLocaleString("de-DE")} />
                </StatGrid>
              </Section>

              {/* Spielzeit & Verlauf */}
              <Section title="Spielprofil">
                <StatGrid>
                  <Stat label="⏱ Spielzeit" value={fmtDuration(detail.onlineTime)} accent />
                  <Stat label="📅 Erstmals gesehen" value={fmtDate(detail.firstJoin)} />
                  <Stat label="🕐 Zuletzt online" value={fmtDate(detail.lastJoin)} />
                  {detail.tutorialProgress !== null && (
                    <Stat label="Tutorial" value={`${detail.tutorialProgress} %`} />
                  )}
                </StatGrid>
              </Section>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

function Stat({
  label,
  value,
  accent = false,
  children,
}: {
  label: string;
  value?: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${accent ? "text-emerald-400" : "text-neutral-100"}`}>
        {children ?? (value ?? "–")}
      </div>
    </div>
  );
}

export default function PlayerBrowser({ initial }: { initial: PlayerRow[] }) {
  const [players, setPlayers] = useState<PlayerRow[]>(initial);
  const [search, setSearch] = useState("");
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reload list from API to stay fresh
  useEffect(() => {
    setLoading(true);
    fetch("/api/players")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPlayers(d.players);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Suchfeld */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
          🔍
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Spieler suchen…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-neutral-100 placeholder-neutral-500 outline-none ring-0 transition-colors focus:border-emerald-400/50 focus:bg-white/[0.06]"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Ergebniszahl */}
      <p className="text-sm text-neutral-500">
        {loading
          ? "Lade…"
          : `${filtered.length} von ${players.length} Spieler${players.length !== 1 ? "n" : ""}`}
        {search && ` – Suche nach „${search}"`}
      </p>

      {/* Spielerliste */}
      {filtered.length === 0 && !loading ? (
        <div className="py-16 text-center text-neutral-500">Kein Spieler gefunden.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.uuid}
              onClick={() => setSelectedUuid(p.uuid)}
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/[0.04]"
            >
              <PlayerAvatar name={p.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold group-hover:text-emerald-300">
                  {p.name}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  ⏱ {fmtDuration(p.onlineTime)}
                  {" · "}
                  🪙 {p.coins.toLocaleString("de-DE")}
                </div>
                <div className="mt-0.5 text-xs text-neutral-600">
                  Zuletzt: {fmtDate(p.lastJoin)}
                </div>
              </div>
              <span className="text-xs text-neutral-600 group-hover:text-emerald-400">→</span>
            </button>
          ))}
        </div>
      )}

      {/* Detail-Modal */}
      {selectedUuid && (
        <DetailPanel uuid={selectedUuid} onClose={() => setSelectedUuid(null)} />
      )}
    </div>
  );
}

