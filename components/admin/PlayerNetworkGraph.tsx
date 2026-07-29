"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerNetwork } from "@/lib/queries";
import { Search, Maximize2 } from "lucide-react";

/**
 * Kräftebasierter Beziehungsgraph (Force-Directed Graph) der Spieler.
 *
 * Eigene Simulation auf einem Canvas statt einer Graph-Bibliothek: Bei einigen
 * hundert Knoten reicht das locker, spart eine Abhängigkeit und lässt sich
 * beim Zeichnen frei gestalten.
 *
 * Physik pro Frame:
 *  - Abstoßung zwischen allen Knoten (Barnes-Hut wäre bei >2000 nötig, hier nicht)
 *  - Anziehung entlang der Kanten, gewichtet – stärkere Bindung zieht kürzer
 *  - leichte Zentrierung, damit nichts wegdriftet
 */

type Props = { data: PlayerNetwork };

type Sim = {
  uuid: string;
  name: string;
  group: number | null;
  groupName: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
};

/** Ruhelänge je Bindungsstärke – stärker = näher beieinander. */
const REST_LENGTH: Record<number, number> = { 3: 42, 2: 95, 1: 190 };
/** Federkonstante je Stärke. */
const STIFFNESS: Record<number, number> = { 3: 0.045, 2: 0.014, 1: 0.0035 };

const PALETTE = [
  "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa",
  "#fb7185", "#22d3ee", "#a3e635", "#f97316", "#c084fc",
];

export default function PlayerNetworkGraph({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<Sim | null>(null);

  // Kamera & Simulation leben in Refs – kein Re-Render pro Frame.
  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const nodesRef = useRef<Sim[]>([]);
  const draggingNode = useRef<Sim | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);
  const alpha = useRef(1);

  const groupColors = useMemo(() => {
    const map = new Map<number, string>();
    let i = 0;
    for (const n of data.nodes) {
      if (n.group !== null && !map.has(n.group)) map.set(n.group, PALETTE[i++ % PALETTE.length]);
    }
    return map;
  }, [data.nodes]);

  // Knoten einmalig aufbauen und im Kreis vorverteilen.
  useEffect(() => {
    const degree = new Map<string, number>();
    for (const e of data.edges) {
      degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
      degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
    }
    const radius = Math.max(200, data.nodes.length * 6);
    nodesRef.current = data.nodes.map((n, i) => {
      const angle = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
      return {
        ...n,
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        degree: degree.get(n.uuid) ?? 0,
      };
    });
    alpha.current = 1;
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const index = new Map(nodesRef.current.map((n) => [n.uuid, n]));
    let raf = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function step() {
      const nodes = nodesRef.current;
      const a = alpha.current;

      if (a > 0.002) {
        // Abstoßung (O(n²) – bei einigen hundert Knoten unkritisch)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i], n2 = nodes[j];
            let dx = n2.x - n1.x, dy = n2.y - n1.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.01; }
            if (d2 > 640000) continue;               // weit weg -> ignorieren
            const force = 2600 / d2;
            const d = Math.sqrt(d2);
            const fx = (dx / d) * force, fy = (dy / d) * force;
            n1.vx -= fx; n1.vy -= fy;
            n2.vx += fx; n2.vy += fy;
          }
        }

        // Federn entlang der Kanten
        for (const e of data.edges) {
          const n1 = index.get(e.a), n2 = index.get(e.b);
          if (!n1 || !n2) continue;
          const dx = n2.x - n1.x, dy = n2.y - n1.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const rest = REST_LENGTH[e.weight] ?? 150;
          const k = STIFFNESS[e.weight] ?? 0.01;
          const force = (d - rest) * k;
          const fx = (dx / d) * force, fy = (dy / d) * force;
          n1.vx += fx; n1.vy += fy;
          n2.vx -= fx; n2.vy -= fy;
        }

        for (const n of nodes) {
          n.vx -= n.x * 0.0012;                      // sanft zur Mitte
          n.vy -= n.y * 0.0012;
          if (n === draggingNode.current) { n.vx = 0; n.vy = 0; continue; }
          n.vx *= 0.82; n.vy *= 0.82;                // Dämpfung
          n.x += n.vx * a; n.y += n.vy * a;
        }
        alpha.current = a * 0.994;
      }

      draw();
      raf = requestAnimationFrame(step);
    }

    function draw() {
      const rect = canvas!.getBoundingClientRect();
      const cam = camera.current;
      ctx!.clearRect(0, 0, rect.width, rect.height);
      ctx!.save();
      ctx!.translate(rect.width / 2 + cam.x, rect.height / 2 + cam.y);
      ctx!.scale(cam.zoom, cam.zoom);

      const needle = query.trim().toLowerCase();

      // Kanten zuerst, schwächste unten
      const sorted = [...data.edges].sort((x, y) => x.weight - y.weight);
      for (const e of sorted) {
        const n1 = index.get(e.a), n2 = index.get(e.b);
        if (!n1 || !n2) continue;
        const strong = e.weight === 3;
        ctx!.strokeStyle = strong
          ? "rgba(255,255,255,0.20)"
          : e.weight === 2
          ? "rgba(255,255,255,0.10)"
          : "rgba(255,255,255,0.045)";
        ctx!.lineWidth = (strong ? 1.4 : e.weight === 2 ? 0.9 : 0.6) / cam.zoom;
        ctx!.beginPath();
        ctx!.moveTo(n1.x, n1.y);
        ctx!.lineTo(n2.x, n2.y);
        ctx!.stroke();
      }

      for (const n of nodesRef.current) {
        const r = 4 + Math.min(9, Math.sqrt(n.degree) * 2.1);
        const color = n.group !== null ? groupColors.get(n.group)! : "#64748b";
        const match = needle.length > 0 && n.name.toLowerCase().includes(needle);
        const dim = needle.length > 0 && !match;

        ctx!.globalAlpha = dim ? 0.15 : 1;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();

        if (match || n === hover) {
          ctx!.lineWidth = 2 / cam.zoom;
          ctx!.strokeStyle = "#fff";
          ctx!.stroke();
        }

        // Namen erst ab genug Zoom bzw. bei Treffern/Hover
        if (cam.zoom > 1.35 || match || n === hover) {
          ctx!.globalAlpha = dim ? 0.25 : 1;
          ctx!.fillStyle = "rgba(255,255,255,0.92)";
          ctx!.font = `${Math.max(9, 11 / cam.zoom)}px ui-sans-serif, system-ui`;
          ctx!.textAlign = "center";
          ctx!.fillText(n.name, n.x, n.y - r - 4 / cam.zoom);
        }
        ctx!.globalAlpha = 1;
      }
      ctx!.restore();
    }

    function toWorld(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      const cam = camera.current;
      return {
        x: (clientX - rect.left - rect.width / 2 - cam.x) / cam.zoom,
        y: (clientY - rect.top - rect.height / 2 - cam.y) / cam.zoom,
      };
    }

    function nodeAt(clientX: number, clientY: number): Sim | null {
      const p = toWorld(clientX, clientY);
      let best: Sim | null = null;
      let bestDist = Infinity;
      for (const n of nodesRef.current) {
        const r = 4 + Math.min(9, Math.sqrt(n.degree) * 2.1) + 4;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < r && d < bestDist) { best = n; bestDist = d; }
      }
      return best;
    }

    function onDown(ev: PointerEvent) {
      const n = nodeAt(ev.clientX, ev.clientY);
      if (n) { draggingNode.current = n; alpha.current = Math.max(alpha.current, 0.35); }
      else panning.current = { x: ev.clientX - camera.current.x, y: ev.clientY - camera.current.y };
      canvas!.setPointerCapture(ev.pointerId);
    }
    function onMove(ev: PointerEvent) {
      if (draggingNode.current) {
        const p = toWorld(ev.clientX, ev.clientY);
        draggingNode.current.x = p.x;
        draggingNode.current.y = p.y;
      } else if (panning.current) {
        camera.current.x = ev.clientX - panning.current.x;
        camera.current.y = ev.clientY - panning.current.y;
      } else {
        const n = nodeAt(ev.clientX, ev.clientY);
        setHover(n);
        canvas!.style.cursor = n ? "pointer" : "grab";
      }
    }
    function onUp(ev: PointerEvent) {
      draggingNode.current = null;
      panning.current = null;
      canvas!.releasePointerCapture(ev.pointerId);
    }
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      const cam = camera.current;
      const rect = canvas!.getBoundingClientRect();
      const mx = ev.clientX - rect.left - rect.width / 2;
      const my = ev.clientY - rect.top - rect.height / 2;
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.min(6, Math.max(0.12, cam.zoom * factor));
      // Zoom auf den Mauszeiger statt auf die Bildmitte
      cam.x = mx - ((mx - cam.x) * next) / cam.zoom;
      cam.y = my - ((my - cam.y) * next) / cam.zoom;
      cam.zoom = next;
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [data, groupColors, query, hover]);

  function reset() {
    camera.current = { x: 0, y: 0, zoom: 1 };
    alpha.current = 1;
  }

  const groupCount = new Set(data.nodes.map((n) => n.group).filter((g) => g !== null)).size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Spieler hervorheben…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
          />
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/[0.06]"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Ansicht zurücksetzen
        </button>
        <p className="ml-auto text-sm text-neutral-600">
          <span className="tabular-nums text-neutral-400">{data.nodes.length}</span> Punkte ·{" "}
          <span className="tabular-nums text-neutral-400">{data.edges.length}</span> Linien ·{" "}
          <span className="tabular-nums text-neutral-400">{groupCount}</span> Gruppen
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
        <canvas ref={canvasRef} className="h-[70vh] w-full touch-none" style={{ cursor: "grab" }} />
        {data.nodes.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-600">
            Keine Daten im gewählten Zeitraum.
          </p>
        )}
        {hover && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-black/80 px-3 py-2 backdrop-blur">
            <p className="text-sm font-semibold text-neutral-100">{hover.name}</p>
            <p className="text-xs text-neutral-500">
              {hover.groupName ?? "Keine Gruppe"} · {hover.degree} Verbindungen
            </p>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-3 right-3 text-xs text-neutral-700">
          Ziehen zum Bewegen · Scrollen zum Zoomen · Punkte verschiebbar
        </p>
      </div>
    </div>
  );
}
