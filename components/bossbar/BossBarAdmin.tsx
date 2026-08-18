"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Sparkles, Eraser,
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff,
  Save, X, Loader2, Radio, Settings,
} from "lucide-react";
import { LEGACY_COLORS, LEGACY_COLOR_NAMES, toSmallCaps } from "@/lib/mcformat";
import type { BossBarConfig, BossBarMessage } from "@/lib/bossbar";
import McText from "@/components/news/McText";
import {
  collectRange, flattenEditor, makeStyledNode, mcToNodes, nodesToMc,
  rangeFromOffsets, textOffsetOf, type EditorStyle,
} from "@/components/news/mcHtml";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  initialMessages: BossBarMessage[];
  initialConfig: BossBarConfig;
};

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function BossBarAdmin({ initialMessages, initialConfig }: Props) {
  const [messages, setMessages] = useState<BossBarMessage[]>(initialMessages);
  const [config, setConfig] = useState<BossBarConfig>(initialConfig);

  // welche ID wird gerade bearbeitet? -1 = neue Nachricht
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // ── Config speichern ─────────────────────────────────────────────────────

  const saveConfig = async () => {
    setConfigSaving(true);
    setError(null);
    const res = await fetch("/api/bossbar/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: config.enabled, intervalSeconds: config.intervalSeconds }),
    });
    const json = await res.json();
    setConfigSaving(false);
    if (!json.ok) {
      setError(json.error ?? "Fehler beim Speichern der Konfiguration.");
    } else {
      setConfigDirty(false);
    }
  };

  // ── Nachricht löschen ────────────────────────────────────────────────────

  const deleteMessage = async (id: number) => {
    if (!confirm("Nachricht wirklich löschen?")) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/bossbar/${id}`, { method: "DELETE" });
    const json = await res.json();
    setSaving(false);
    if (!json.ok) {
      setError(json.error ?? "Löschen fehlgeschlagen.");
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) setEditingId(null);
    }
  };

  // ── Nachricht umschalten ─────────────────────────────────────────────────

  const toggleMessage = async (id: number, enabled: boolean) => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/bossbar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const json = await res.json();
    setSaving(false);
    if (!json.ok) {
      setError(json.error ?? "Fehler.");
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled } : m))
      );
    }
  };

  // ── Reihenfolge ändern ───────────────────────────────────────────────────

  const moveMessage = async (id: number, direction: "up" | "down") => {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const other = direction === "up" ? idx - 1 : idx + 1;
    if (other < 0 || other >= messages.length) return;

    // Positionen tauschen
    const newMessages = [...messages];
    const tmpPos = newMessages[idx].position;
    newMessages[idx] = { ...newMessages[idx], position: newMessages[other].position };
    newMessages[other] = { ...newMessages[other], position: tmpPos };
    [newMessages[idx], newMessages[other]] = [newMessages[other], newMessages[idx]];
    setMessages(newMessages);

    setSaving(true);
    setError(null);
    await Promise.all([
      fetch(`/api/bossbar/${newMessages[idx].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newMessages[idx].position }),
      }),
      fetch(`/api/bossbar/${newMessages[other].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newMessages[other].position }),
      }),
    ]);
    setSaving(false);
  };

  // ── Nachricht gespeichert (Callback vom Editor) ──────────────────────────

  const onSaved = useCallback(
    (msg: BossBarMessage) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        return exists ? prev.map((m) => (m.id === msg.id ? msg : m)) : [...prev, msg];
      });
      setEditingId(null);
    },
    []
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-bold">Bossbar verwalten</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Nachrichten rotieren automatisch in der Bossbar – sichtbar für alle Spieler auf
            allen Servern. Änderungen werden sofort auf alle Proxys synchronisiert.
          </p>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Konfiguration */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <Settings className="h-3.5 w-3.5" />
          Konfiguration
        </div>
        <div className="flex flex-wrap items-end gap-6">
          {/* Aktiv */}
          <label className="flex cursor-pointer items-center gap-3">
            <div
              role="checkbox"
              aria-checked={config.enabled}
              onClick={() => {
                setConfig((c) => ({ ...c, enabled: !c.enabled }));
                setConfigDirty(true);
              }}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                config.enabled ? "bg-sky-500" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  config.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
            <span className="text-sm text-neutral-300">
              Bossbar {config.enabled ? "aktiv" : "deaktiviert"}
            </span>
          </label>

          {/* Intervall */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Wechselintervall
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={3}
                max={3600}
                value={config.intervalSeconds}
                onChange={(e) => {
                  const v = Math.max(3, parseInt(e.target.value) || 60);
                  setConfig((c) => ({ ...c, intervalSeconds: v }));
                  setConfigDirty(true);
                }}
                className="w-24 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500/60"
              />
              <span className="text-sm text-neutral-500">Sekunden</span>
            </div>
          </label>

          <button
            type="button"
            onClick={saveConfig}
            disabled={!configDirty || configSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-sky-400 disabled:opacity-40"
          >
            {configSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Speichern
          </button>
        </div>
      </div>

      {/* Nachrichten-Liste */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300">
            Nachrichten ({messages.length}
            {messages.filter((m) => m.enabled).length !== messages.length &&
              `, ${messages.filter((m) => m.enabled).length} aktiv`}
            )
          </h2>
          <button
            type="button"
            onClick={() => setEditingId(-1)}
            disabled={editingId === -1}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Neue Nachricht
          </button>
        </div>

        {messages.length === 0 && editingId !== -1 && (
          <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-10 text-center text-sm text-neutral-500">
            Noch keine Nachrichten. Lege die erste an.
          </p>
        )}

        {/* Bestehende Nachrichten */}
        {messages.map((msg, idx) => (
          <div key={msg.id}>
            {editingId === msg.id ? (
              <MessageEditor
                message={msg}
                onSaved={onSaved}
                onCancel={() => setEditingId(null)}
                onError={setError}
              />
            ) : (
              <MessageRow
                msg={msg}
                position={idx + 1}
                total={messages.length}
                saving={saving}
                onEdit={() => setEditingId(msg.id)}
                onToggle={() => toggleMessage(msg.id, !msg.enabled)}
                onDelete={() => deleteMessage(msg.id)}
                onMoveUp={() => moveMessage(msg.id, "up")}
                onMoveDown={() => moveMessage(msg.id, "down")}
              />
            )}
          </div>
        ))}

        {/* Neue Nachricht */}
        {editingId === -1 && (
          <MessageEditor
            message={null}
            nextPosition={
              messages.length > 0 ? messages[messages.length - 1].position + 1 : 0
            }
            onSaved={onSaved}
            onCancel={() => setEditingId(null)}
            onError={setError}
          />
        )}
      </div>

      {/* Platzhalter-Hilfe */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Verfügbare Platzhalter
        </h3>
        <div className="flex flex-col gap-2 text-sm text-neutral-400">
          <PlaceholderRow code="%countdown:DD.MM.YYYY HH:mm%" desc="Countdown bis zu einem Datum (z. B. 29.07.2026 16:00)" />
          <PlaceholderRow code="%online%" desc="Aktuelle Spieleranzahl im Netzwerk" />
          <PlaceholderRow code="%date%" desc="Heutiges Datum" />
          <PlaceholderRow code="%time%" desc="Aktuelle Uhrzeit" />
        </div>
      </div>
    </div>
  );
}

// ─── Nachrichten-Zeile ────────────────────────────────────────────────────────

function MessageRow({
  msg,
  position,
  total,
  saving,
  onEdit,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  msg: BossBarMessage;
  position: number;
  total: number;
  saving: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
        msg.enabled
          ? "border-white/10 bg-white/[0.02]"
          : "border-white/[0.05] bg-transparent opacity-60"
      }`}
    >
      {/* Position */}
      <span className="w-5 shrink-0 text-center text-xs font-bold text-neutral-600">
        {position}
      </span>

      {/* Vorschau */}
      <div className="min-w-0 flex-1 truncate">
        {/* Vorschau zeigt, wie es ingame aussieht – dort ist nichts anklickbar. */}
        <McText text={msg.message} className="text-sm leading-relaxed" links={false} />
      </div>

      {/* Status */}
      <span
        className={`shrink-0 text-xs ${
          msg.enabled ? "text-emerald-500" : "text-neutral-600"
        }`}
      >
        {msg.enabled ? "Aktiv" : "Aus"}
      </span>

      {/* Aktionen */}
      <div className="flex shrink-0 items-center gap-1">
        <IconBtn title="Bearbeiten" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title={msg.enabled ? "Deaktivieren" : "Aktivieren"} onClick={onToggle} disabled={saving}>
          {msg.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </IconBtn>
        <IconBtn title="Nach oben" onClick={onMoveUp} disabled={saving || position === 1}>
          <ChevronUp className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Nach unten" onClick={onMoveDown} disabled={saving || position === total}>
          <ChevronDown className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          title="Löschen"
          onClick={onDelete}
          disabled={saving}
          className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    </div>
  );
}

// ─── Nachrichten-Editor ───────────────────────────────────────────────────────

function MessageEditor({
  message,
  nextPosition = 0,
  onSaved,
  onCancel,
  onError,
}: {
  message: BossBarMessage | null;
  nextPosition?: number;
  onSaved: (msg: BossBarMessage) => void;
  onCancel: () => void;
  onError: (err: string | null) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState(message?.message ?? "");
  const [saving, setSaving] = useState(false);
  const [gradientFrom, setGradientFrom] = useState("#4FA3D9");
  const [gradientTo, setGradientTo] = useState("#C084FC");
  const [customColor, setCustomColor] = useState("#FFFFFF");

  // Editor-Inhalt einmalig aufbauen
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.replaceChildren(mcToNodes(message?.message ?? "", () => undefined));
    setBody(nodesToMc(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncBody = useCallback(() => {
    const el = editorRef.current;
    if (el) setBody(nodesToMc(el));
  }, []);

  // ── Formatierung auf Auswahl anwenden ────────────────────────────────────

  const applyToSelection = useCallback(
    (mutate: (style: EditorStyle) => EditorStyle) => {
      const root = editorRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      if (range.collapsed || !root.contains(range.commonAncestorContainer)) return;

      const from = textOffsetOf(root, range.startContainer, range.startOffset);
      const to = textOffsetOf(root, range.endContainer, range.endOffset);

      const pieces = collectRange(root, from, to);
      range.deleteContents();

      const rebuilt = document.createDocumentFragment();
      for (const piece of pieces) {
        if (piece.kind === "text") {
          rebuilt.appendChild(makeStyledNode(piece.text, mutate(piece.style), true));
        } else if (piece.kind === "br") {
          rebuilt.appendChild(document.createElement("br"));
        } else {
          rebuilt.appendChild(piece.node);
        }
      }

      range.insertNode(rebuilt);
      flattenEditor(root);

      const restored = rangeFromOffsets(root, from, to);
      if (restored) {
        sel.removeAllRanges();
        sel.addRange(restored);
      }
      syncBody();
    },
    [syncBody]
  );

  const setColor = (hex: string) =>
    applyToSelection((s) => ({ ...s, color: hex.toUpperCase(), gradient: undefined }));

  const setGradient = () =>
    applyToSelection((s) => ({
      ...s,
      gradient: [gradientFrom.toUpperCase(), gradientTo.toUpperCase()],
      color: undefined,
    }));

  const toggle = (key: "bold" | "italic" | "underline" | "strike" | "obf") =>
    applyToSelection((s) => ({ ...s, [key]: !s[key] || undefined }));

  const clearFormatting = () => applyToSelection(() => ({}));

  const applySmallCapsToSelection = useCallback(() => {
    const root = editorRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (range.collapsed || !root.contains(range.commonAncestorContainer)) return;

    const from = textOffsetOf(root, range.startContainer, range.startOffset);
    const to = textOffsetOf(root, range.endContainer, range.endOffset);

    const pieces = collectRange(root, from, to);
    range.deleteContents();

    const rebuilt = document.createDocumentFragment();
    for (const piece of pieces) {
      if (piece.kind === "text") {
        rebuilt.appendChild(makeStyledNode(toSmallCaps(piece.text), piece.style, true));
      } else if (piece.kind === "br") {
        rebuilt.appendChild(document.createElement("br"));
      } else {
        rebuilt.appendChild(piece.node);
      }
    }

    range.insertNode(rebuilt);
    flattenEditor(root);

    const restored = rangeFromOffsets(root, from, to);
    if (restored) {
      sel.removeAllRanges();
      sel.addRange(restored);
    }
    syncBody();
  }, [syncBody]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      const map: Record<string, "bold" | "italic" | "underline"> = {
        b: "bold", i: "italic", u: "underline",
      };
      const action = map[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        toggle(action);
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        sel.getRangeAt(0).insertNode(document.createTextNode(text));
      }
    }
    syncBody();
  };

  // ── Speichern ────────────────────────────────────────────────────────────

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    onError(null);

    const url = message ? `/api/bossbar/${message.id}` : "/api/bossbar";
    const method = message ? "PATCH" : "POST";
    const payload = message
      ? { message: body }
      : { message: body, position: nextPosition };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);

    if (!json.ok) {
      onError(json.error ?? "Speichern fehlgeschlagen.");
      return;
    }

    const savedMsg: BossBarMessage = {
      id: message?.id ?? json.id,
      position: message?.position ?? nextPosition,
      message: body,
      enabled: message?.enabled ?? true,
    };
    onSaved(savedMsg);
  };

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.04]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 p-3">
        <ToolButton title="Fett (Strg+B)" onClick={() => toggle("bold")}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Kursiv (Strg+I)" onClick={() => toggle("italic")}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Unterstrichen (Strg+U)" onClick={() => toggle("underline")}>
          <Underline className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Durchgestrichen" onClick={() => toggle("strike")}>
          <Strikethrough className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Verschlüsselt (&k)" onClick={() => toggle("obf")}>
          <Sparkles className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Small Caps" onClick={applySmallCapsToSelection}>
          <span className="text-xs font-bold">Sᴍ</span>
        </ToolButton>

        <Divider />

        {Object.entries(LEGACY_COLORS).map(([code, hex]) => (
          <button
            key={code}
            type="button"
            title={`${LEGACY_COLOR_NAMES[code]} (&${code})`}
            onClick={() => setColor(hex)}
            className="h-5 w-5 rounded border border-white/20 transition-transform hover:scale-110"
            style={{ backgroundColor: hex }}
          />
        ))}

        <Divider />

        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          Hex
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="h-5 w-7 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          />
          <button
            type="button"
            onClick={() => setColor(customColor)}
            className="rounded-md bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
          >
            ↵
          </button>
        </label>

        <Divider />

        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          Verlauf
          <input
            type="color"
            value={gradientFrom}
            onChange={(e) => setGradientFrom(e.target.value)}
            className="h-5 w-7 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          />
          <input
            type="color"
            value={gradientTo}
            onChange={(e) => setGradientTo(e.target.value)}
            className="h-5 w-7 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          />
          <button
            type="button"
            onClick={setGradient}
            className="rounded-md px-2 py-0.5 text-xs font-semibold text-black"
            style={{ backgroundImage: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
          >
            ↵
          </button>
        </label>

        <Divider />

        <ToolButton title="Formatierung entfernen" onClick={clearFormatting}>
          <Eraser className="h-4 w-4" />
        </ToolButton>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncBody}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        spellCheck
        className="min-h-[52px] w-full whitespace-pre-wrap break-words px-5 py-3 text-[15px] leading-relaxed outline-none"
        data-placeholder="Nachrichtentext mit &-Codes, Gradients und Platzhaltern …"
      />

      {/* Vorschau */}
      {body && (
        <div className="border-t border-white/10 px-5 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-600">
            <Radio className="h-3 w-3" />
            Vorschau
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/30 px-4 py-2">
            <div className="h-2 w-32 shrink-0 rounded-full bg-white/20" title="Bossbar-Balken (Simulation)" />
            <McText text={body} className="flex-1 text-sm leading-relaxed" links={false} />
          </div>
        </div>
      )}

      {/* Aktionen */}
      <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
        <p className="text-xs text-neutral-600">
          {body.length} Zeichen
          {body.length > 256 && (
            <span className="ml-2 text-amber-400">⚠ Bossbar-Text ist lang</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" />
            Abbrechen
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {message ? "Speichern" : "Hinzufügen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kleinteile ───────────────────────────────────────────────────────────────

function IconBtn({
  title,
  onClick,
  disabled,
  className = "",
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white/10 hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-white/10" />;
}

function PlaceholderRow({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <code className="shrink-0 rounded bg-white/5 px-2 py-0.5 font-mono text-xs text-sky-300">
        {code}
      </code>
      <span className="text-xs text-neutral-500">{desc}</span>
    </div>
  );
}


