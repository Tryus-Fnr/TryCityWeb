"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type ParsedItem = { id: string; count: number; customName?: string } | null;

type InventoryData = {
  inventory: ParsedItem[];
  enderChest: ParsedItem[];
  armor: ParsedItem[];
  offhand: ParsedItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  return `${h}h ${m}m`;
}

function fmtDate(ms: number): string {
  if (!ms) return "–";
  return new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoney(v: number | null): string {
  if (v === null) return "–";
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

function materialToTexture(id: string): string {
  return id.replace(/^minecraft:/, "");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PlayerAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <Image
      src={`https://mineskin.eu/helm/${encodeURIComponent(name)}`}
      alt={name}
      width={size}
      height={size}
      className="rounded"
      unoptimized
    />
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const online = status === "ONLINE";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      online ? "bg-emerald-500/15 text-emerald-300" : "bg-white/6 text-neutral-400"
    }`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
        online ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-neutral-500"
      }`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

// ─── Inventory grid ──────────────────────────────────────────────────────────

function ItemSlot({ item, slot }: { item: ParsedItem; slot: number }) {
  const [imgError, setImgError] = useState(false);

  if (!item) {
    return (
      <div
        className="relative aspect-square w-full rounded border border-white/[0.08] bg-black/30"
        title={`Slot ${slot}`}
      />
    );
  }

  const mat   = materialToTexture(item.id);
  const label = item.customName ?? mat.replace(/_/g, " ");

  return (
    <div
      className="group relative aspect-square w-full cursor-default overflow-hidden rounded border border-white/10 bg-black/40 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/5"
      title={`${label}${item.count > 1 ? ` ×${item.count}` : ""}`}
    >
      {!imgError ? (
        <Image
          src={`https://mc-heads.net/item/${mat}`}
          alt={label}
          fill
          sizes="40px"
          className="object-contain p-0.5"
          unoptimized
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full items-center justify-center overflow-hidden p-0.5 text-center text-[8px] leading-tight text-neutral-500">
          {mat.split("_").slice(-1)[0]}
        </div>
      )}
      {item.count > 1 && (
        <span className="absolute bottom-0.5 right-0.5 text-[10px] font-bold leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
          {item.count}
        </span>
      )}
    </div>
  );
}

function InventoryGrid({ slots, cols = 9, label }: { slots: ParsedItem[]; cols?: number; label?: string }) {
  return (
    <div>
      {label && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</p>}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {slots.map((item, i) => <ItemSlot key={i} item={item} slot={i} />)}
      </div>
    </div>
  );
}

function pad<T>(arr: T[], len: number, fill: T): T[] {
  const out = [...arr];
  while (out.length < len) out.push(fill);
  return out.slice(0, len);
}

function InventoryView({ uuid }: { uuid: string }) {
  const [invTab, setInvTab] = useState<"inv" | "ender">("inv");
  const [data,    setData]  = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/players/${uuid}/inventory`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); else setError(d.error ?? "Fehler"); })
      .catch(() => setError("Netzwerkfehler"))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) return <div className="py-8 text-center text-sm text-neutral-500">Lade Inventar…</div>;
  if (error)   return <div className="py-8 text-center text-sm text-red-400">{error}</div>;
  if (!data)   return null;

  const inv    = pad(data.inventory,  36, null);
  const main   = inv.slice(9, 36);
  const hotbar = inv.slice(0, 9);
  const ender  = pad(data.enderChest, 27, null);
  const armorDisplay: ParsedItem[] = [
    data.armor[3] ?? null,
    data.armor[2] ?? null,
    data.armor[1] ?? null,
    data.armor[0] ?? null,
  ];
  const offhand: ParsedItem[] = [data.offhand[0] ?? null];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["inv", "ender"] as const).map((k) => (
          <button key={k} onClick={() => setInvTab(k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              invTab === k ? "bg-emerald-500/15 text-emerald-300" : "border border-white/10 text-neutral-400 hover:bg-white/5"
            }`}>
            {k === "inv" ? "🎒 Inventar" : "📦 Enderchest"}
          </button>
        ))}
      </div>

      {invTab === "inv" ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col gap-3">
          <div className="flex gap-1">
            {/* Armor + offhand column */}
            <div className="flex flex-col gap-1" style={{ width: "calc((100% - 8 * 0.25rem) / 9)" }}>
              {armorDisplay.map((item, i) => <ItemSlot key={i} item={item} slot={36 + (3 - i)} />)}
              <div className="mt-1"><ItemSlot item={offhand[0]} slot={40} /></div>
            </div>
            {/* Main 3×9 */}
            <div className="flex-1">
              <InventoryGrid slots={main} cols={9} />
            </div>
          </div>
          <div className="border-t border-white/10 pt-3">
            <InventoryGrid slots={hotbar} cols={9} label="Hotbar" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <InventoryGrid slots={ender} cols={9} />
        </div>
      )}
    </div>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h3>
      {children}
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>;
}

function Stat({ label, value, accent = false, children }: {
  label: string; value?: string; accent?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/3 px-3 py-2.5">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${accent ? "text-emerald-400" : "text-neutral-100"}`}>
        {children ?? (value ?? "–")}
      </div>
    </div>
  );
}

function DetailPanel({ uuid, name, onClose }: { uuid: string; name: string; onClose: () => void }) {
  const [detail,  setDetail]  = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<"stats" | "inv">("stats");

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/players/${uuid}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setDetail(d.player); else setError(d.error ?? "Fehler"); })
      .catch(() => setError("Netzwerkfehler"))
      .finally(() => setLoading(false));
  }, [uuid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111112] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-white/10 px-6 py-4">
          <PlayerAvatar name={name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">{name}</h2>
              {detail && <StatusBadge status={detail.status} />}
            </div>
            <p className="mt-0.5 font-mono text-xs text-neutral-500 truncate">{uuid}</p>
          </div>
          <button onClick={onClose} className="ml-2 flex-shrink-0 rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100" aria-label="Schließen">✕</button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 border-b border-white/10 px-6 py-2">
          {([["stats", "📊 Stats"], ["inv", "🎒 Inventar"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === k ? "bg-emerald-500/15 text-emerald-300" : "text-neutral-400 hover:bg-white/5"
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-neutral-500">Lade…</div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center text-red-400">{error}</div>
          ) : detail && tab === "stats" ? (
            <div className="flex flex-col gap-6">
              {detail.status && (
                <Section title="Server">
                  <StatGrid>
                    <Stat label="Status"><StatusBadge status={detail.status} /></Stat>
                    {detail.currentServer && <Stat label="Aktueller Server" value={detail.currentServer} />}
                    {detail.lastServer    && <Stat label="Letzter Server"   value={detail.lastServer}    />}
                    {detail.gameMode      && <Stat label="Spielmodus"       value={detail.gameMode}      />}
                  </StatGrid>
                </Section>
              )}
              {detail.health !== null && (
                <Section title="Vitalwerte">
                  <StatGrid>
                    <Stat label="❤ Leben">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-400">{detail.health?.toFixed(1)} / {detail.maxHealth?.toFixed(1)}</span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${detail.maxHealth ? Math.min(100, ((detail.health ?? 0) / detail.maxHealth) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </Stat>
                    <Stat label="🍖 Hunger" value={`${detail.foodLevel ?? "–"} / 20`} />
                    <Stat label="✨ Level"  value={String(detail.expLevel ?? "–")} />
                    <Stat label="XP" value={detail.experience !== null ? `${(detail.experience * 100).toFixed(0)} %` : "–"} />
                  </StatGrid>
                </Section>
              )}
              <Section title="Wirtschaft">
                <StatGrid>
                  <Stat label="💰 Guthaben"    value={fmtMoney(detail.balance)}      accent />
                  <Stat label="🏦 Bankguthaben" value={fmtMoney(detail.bankBalance)}         />
                  <Stat label="🪙 Coins"        value={detail.coins.toLocaleString("de-DE")} />
                  <Stat label="💎 Gems"         value={detail.gems.toLocaleString("de-DE")}  />
                  <Stat label="⭐ Stars"        value={detail.stars.toLocaleString("de-DE")} />
                </StatGrid>
              </Section>
              <Section title="Spielprofil">
                <StatGrid>
                  <Stat label="⏱ Spielzeit"        value={fmtDuration(detail.onlineTime)} accent />
                  <Stat label="📅 Erstmals gesehen" value={fmtDate(detail.firstJoin)}             />
                  <Stat label="🕐 Zuletzt online"   value={fmtDate(detail.lastJoin)}              />
                  {detail.tutorialProgress !== null && <Stat label="Tutorial" value={`${detail.tutorialProgress} %`} />}
                </StatGrid>
              </Section>
            </div>
          ) : tab === "inv" ? (
            <InventoryView uuid={uuid} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function Pagination({
  page, pageCount, total, onPage,
}: {
  page: number; pageCount: number; total: number; onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
      <span className="text-sm text-neutral-500">
        Seite {page + 1} / {pageCount}
        <span className="ml-2 text-neutral-600">({total} gesamt)</span>
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => { onPage(0); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page === 0}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default">«</button>
        <button onClick={() => { onPage(page - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page === 0}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default">Zurück</button>
        <button onClick={() => { onPage(page + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page >= pageCount - 1}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default">Weiter</button>
        <button onClick={() => { onPage(pageCount - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page >= pageCount - 1}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default">»</button>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function PlayerBrowser({ initial }: { initial: PlayerRow[] }) {
  const [players,  setPlayers]  = useState<PlayerRow[]>(initial);
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(0);
  const [selected, setSelected] = useState<{ uuid: string; name: string } | null>(null);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    setListLoading(true);
    fetch("/api/players")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPlayers(d.players); })
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, []);

  // Reset Seite bei Suche
  useEffect(() => { setPage(0); }, [search]);

  const filtered = players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Suchfeld */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Spieler suchen…"
          className="w-full rounded-xl border border-white/10 bg-white/4 py-2.5 pl-9 pr-4 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-emerald-400/50 focus:bg-white/6"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">✕</button>
        )}
      </div>

      {/* Count */}
      <p className="text-sm text-neutral-500">
        {listLoading ? "Lade…" : `${filtered.length} von ${players.length} Spieler${players.length !== 1 ? "n" : ""}`}
        {search && ` – Suche nach „${search}"`}
      </p>

      {/* Spieler-Grid */}
      {filtered.length === 0 && !listLoading ? (
        <div className="py-16 text-center text-neutral-500">Kein Spieler gefunden.</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((p) => (
              <button
                key={p.uuid}
                onClick={() => setSelected({ uuid: p.uuid, name: p.name })}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 p-4 text-left transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/4"
              >
                <PlayerAvatar name={p.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold group-hover:text-emerald-300">{p.name}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">⏱ {fmtDuration(p.onlineTime)}</div>
                  <div className="mt-0.5 text-xs text-neutral-600">Zuletzt: {fmtDate(p.lastJoin)}</div>
                </div>
                <span className="shrink-0 text-xs text-neutral-600 group-hover:text-emerald-400">→</span>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <Pagination page={page} pageCount={pageCount} total={filtered.length} onPage={setPage} />
          )}
        </>
      )}

      {/* Detail-Modal */}
      {selected && (
        <DetailPanel uuid={selected.uuid} name={selected.name} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}




