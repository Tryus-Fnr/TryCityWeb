/** Gemeinsame Formatierung und Farbgebung der Infrastruktur-Ansichten. */

/** Bytes als GiB/MiB mit einer Nachkommastelle. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "–";
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) return `${gib.toFixed(1)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
}

/** Anteil 0..1 als Prozent. Negative Werte gelten als "unbekannt". */
export function formatPercent(ratio: number): string {
  if (ratio < 0 || Number.isNaN(ratio)) return "–";
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)} %`;
}

/** Laufzeit seit einem Zeitstempel, grob gerundet. */
export function formatUptime(since: number): string {
  if (!since || since <= 0) return "–";
  const seconds = Math.max(0, (Date.now() - since) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

/** "vor 12 s" – zeigt, wie frisch ein Messwert ist. */
export function formatAge(timestamp: number): string {
  if (!timestamp) return "nie";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `vor ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `vor ${minutes} min`;
  return `vor ${Math.round(minutes / 60)} h`;
}

/**
 * Ampelfarbe für eine Auslastung: grün bis 75 %, gelb bis 90 %, danach rot.
 * Unbekannte Werte bleiben neutral.
 */
export function usageColor(ratio: number): string {
  if (ratio < 0 || Number.isNaN(ratio)) return "bg-neutral-600";
  if (ratio >= 0.9) return "bg-rose-500";
  if (ratio >= 0.75) return "bg-amber-400";
  return "bg-emerald-400";
}

export function usageTextColor(ratio: number): string {
  if (ratio < 0 || Number.isNaN(ratio)) return "text-neutral-500";
  if (ratio >= 0.9) return "text-rose-400";
  if (ratio >= 0.75) return "text-amber-300";
  return "text-emerald-400";
}

/**
 * Ist der Service ein Proxy?
 *
 * Für Spielerzahlen entscheidend: ein Proxy kennt JEDEN Spieler des Netzwerks,
 * ein Spielserver nur die auf ihm. Zählt man beides zusammen, steht überall die
 * doppelte Zahl.
 */
export function isProxyEnvironment(environment: string): boolean {
  const env = (environment ?? "").toUpperCase();
  return (
    env.includes("PROXY") ||
    env.includes("BUNGEE") ||
    env.includes("VELOCITY") ||
    env.includes("WATERFALL")
  );
}

/** Feste Farben je Service-Umgebung, damit Proxies sofort auffallen. */
export function environmentLabel(environment: string): { label: string; className: string } {
  const env = environment.toUpperCase();
  if (isProxyEnvironment(env)) {
    return { label: "Proxy", className: "bg-violet-500/15 text-violet-300" };
  }
  if (env.includes("PAPER") || env.includes("SPIGOT") || env.includes("BUKKIT") || env.includes("FOLIA")) {
    return { label: "Server", className: "bg-sky-500/15 text-sky-300" };
  }
  return { label: environment || "unbekannt", className: "bg-white/10 text-neutral-300" };
}

/** Zeitachsen-Beschriftung – bei langen Zeiträumen das Datum, sonst die Uhrzeit. */
export function makeTimeFormatter(range: string) {
  return (t: number) => {
    const d = new Date(t);
    if (range === "1h" || range === "6h" || range === "24h") {
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };
}
