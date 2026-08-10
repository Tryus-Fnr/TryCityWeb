import { alertsSince, overlayKeyOk, subscribe, type TebexAlert } from "@/lib/tebexAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dauerverbindung zur Overlay-Seite (Server-Sent Events).
 *
 * SSE statt WebSocket: die Daten fließen nur in eine Richtung, der Browser
 * verbindet nach Abbrüchen von allein neu und schickt dabei die zuletzt
 * gesehene Ereignis-ID mit – genau das, was ein OBS-Overlay braucht.
 */

/** Abstand der Lebenszeichen. Muss unter nginx' proxy_read_timeout (60 s) bleiben. */
const HEARTBEAT_MS = 20_000;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!overlayKeyOk(key)) {
    return new Response("unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const lastId = Number(req.headers.get("last-event-id") ?? 0);

  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Gegenstelle ist weg – aufräumen und still beenden
          cleanup();
        }
      };

      const send = (alert: TebexAlert) =>
        write(`id: ${alert.id}\ndata: ${JSON.stringify(alert)}\n\n`);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // war schon zu
        }
      };

      // Kommentarzeile: markiert dem Overlay die stehende Verbindung
      write(": verbunden\n\n");

      // Was während eines kurzen Aussetzers lief, jetzt nachreichen
      for (const missed of alertsSince(lastId)) send(missed);

      unsubscribe = subscribe(send);
      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      req.signal.addEventListener("abort", cleanup);
    },

    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Ohne das sammelt nginx die Ausgabe und der Alert kommt gar nicht
      // oder erst Minuten später an.
      "X-Accel-Buffering": "no",
    },
  });
}
