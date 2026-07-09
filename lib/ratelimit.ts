/**
 * Einfaches In-Memory-Rate-Limit (pro Node-Prozess).
 * Reicht für einen einzelnen Server; bei Bedarf später durch Redis ersetzen.
 */
const hits = new Map<string, number[]>();

/**
 * @return true wenn erlaubt, false wenn Limit überschritten
 */
export function rateLimit(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= maxHits) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);

  // gelegentlich aufräumen, damit die Map nicht wächst
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t > windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** Client-IP aus Request-Headern (hinter nginx: X-Forwarded-For). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
