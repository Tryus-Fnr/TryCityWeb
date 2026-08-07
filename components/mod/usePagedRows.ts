"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Blättern durch eine Mod-Liste.
 *
 * Die Seite liefert den ersten Block mit; weitere holt der Haken bei Bedarf über
 * `/api/mod/list` nach und hängt sie an. Gesucht und gefiltert wird über alles,
 * was geladen ist – deshalb wird angehängt statt ersetzt.
 *
 * Vorher lud die Seite genau 500 Zeilen und danach war Schluss, ohne dass man
 * es der Anzeige ansah.
 */
export function usePagedRows<T>(kind: string, initial: T[], total: number) {
  const [rows, setRows] = useState<T[]>(initial);
  const [chunk, setChunk] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wechselt die Seite den ersten Block aus (Neuladen), von vorne beginnen.
  useEffect(() => {
    setRows(initial);
    setChunk(0);
  }, [initial]);

  const hasMore = rows.length < total;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mod/list?kind=${encodeURIComponent(kind)}&page=${chunk + 1}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Nachladen fehlgeschlagen.");
        return;
      }
      setRows((prev) => [...prev, ...(json.rows as T[])]);
      setChunk((c) => c + 1);
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  }, [chunk, hasMore, kind, loading]);

  return { rows, hasMore, loading, error, loadMore, total };
}
