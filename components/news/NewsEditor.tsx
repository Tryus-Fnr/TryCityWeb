"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bold, Italic, Underline, Strikethrough, Sparkles, Eraser,
  ImagePlus, Save, Trash2, Eye, Pin, EyeOff, Loader2, X,
} from "lucide-react";
import { LEGACY_COLORS, LEGACY_COLOR_NAMES } from "@/lib/mcformat";
import { NEWS_TYPES, type NewsPost, type NewsImage, type NewsTypeId } from "@/lib/newsTypes";
import McText from "./McText";
import {
  collectRange, flattenEditor, makeImageNode, makeStyledNode, mcToNodes, nodesToMc,
  rangeFromOffsets, textOffsetOf, type EditorStyle,
} from "./mcHtml";

/** Bild im Editor: `data` ist immer eine vollständige Data-URL. */
type DraftImage = { idx: number; caption: string; data: string };

type Props = {
  /** Vorhandener Beitrag (Bearbeiten) oder null (Neu anlegen). */
  post: NewsPost | null;
  images: NewsImage[];
  /** Name des eingeloggten Admins – Vorbelegung für das Autorfeld. */
  currentUser: string;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export default function NewsEditor({ post, images, currentUser }: Props) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);

  const [type, setType] = useState<NewsTypeId>(post?.type ?? "update");
  const [title, setTitle] = useState(post?.title ?? "");
  const [summary, setSummary] = useState(post?.summary ?? "");
  const [author, setAuthor] = useState(post?.authorName ?? currentUser);
  const [published, setPublished] = useState(post?.published ?? true);
  const [pinned, setPinned] = useState(post?.pinned ?? false);

  const [draftImages, setDraftImages] = useState<DraftImage[]>(() =>
    images.map((i) => ({
      idx: i.idx,
      caption: i.caption,
      data: `data:${i.mime};base64,${i.data}`,
    }))
  );

  const [body, setBody] = useState(post?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradientFrom, setGradientFrom] = useState("#4FA3D9");
  const [gradientTo, setGradientTo] = useState("#C084FC");
  const [customColor, setCustomColor] = useState("#FFFFFF");

  // ── Editor-Inhalt einmalig aus dem gespeicherten Text aufbauen ────────────
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const srcOf = (idx: number) => draftImages.find((i) => i.idx === idx)?.data;
    el.replaceChildren(mcToNodes(post?.body ?? "", srcOf));
    setBody(nodesToMc(el));
    // Absichtlich nur beim ersten Rendern – danach gehört der Inhalt dem DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncBody = useCallback(() => {
    const el = editorRef.current;
    if (el) setBody(nodesToMc(el));
  }, []);

  // ── Formatierung auf die Auswahl anwenden ─────────────────────────────────

  /**
   * Wendet `mutate` auf jeden ausgewählten Textabschnitt an.
   *
   * Der ausgewählte Bereich wird herausgelöst, flach neu aufgebaut und wieder
   * eingesetzt. Anschliessend wird der ganze Editor eingeebnet – sonst blieben
   * die angeschnittenen Eltern-Spans stehen und würden z. B. „Formatierung
   * entfernen“ wirkungslos machen. Die Auswahl merken wir uns dafür als
   * Zeichenposition und stellen sie danach wieder her.
   */
  const applyToSelection = useCallback(
    (mutate: (style: EditorStyle) => EditorStyle) => {
      const root = editorRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      if (range.collapsed || !root.contains(range.commonAncestorContainer)) {
        setError("Markiere zuerst den Text, den du formatieren möchtest.");
        return;
      }
      setError(null);

      const from = textOffsetOf(root, range.startContainer, range.startOffset);
      const to = textOffsetOf(root, range.endContainer, range.endOffset);

      // Erst die Stile einsammeln, dann löschen – danach wäre nicht mehr
      // erkennbar, welcher Abschnitt vorher wie formatiert war.
      const pieces = collectRange(root, from, to);
      range.deleteContents();

      const rebuilt = document.createDocumentFragment();
      for (const piece of pieces) {
        if (piece.kind === "text") {
          // absolute = true: der neue Stil gilt unabhängig von den Eltern.
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

  // ── Eingabe-Verhalten ─────────────────────────────────────────────────────

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter soll einen echten Zeilenumbruch setzen und keine neuen Blöcke bauen.
    if (e.key === "Enter") {
      e.preventDefault();
      insertNodeAtCaret(document.createElement("br"));
      syncBody();
      return;
    }
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
    // Nur Text übernehmen – fremdes HTML würde den Baum unbrauchbar machen.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text) insertNodeAtCaret(document.createTextNode(text));
    syncBody();
  };

  // ── Bilder ────────────────────────────────────────────────────────────────

  const nextImageIndex = () =>
    draftImages.reduce((max, img) => Math.max(max, img.idx), 0) + 1;

  const addImage = async (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Das Bild ist zu groß – bitte höchstens 2 MB.");
      return;
    }
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      setError("Erlaubt sind PNG, JPEG, GIF und WebP.");
      return;
    }
    setError(null);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const idx = nextImageIndex();
    setDraftImages((prev) => [...prev, { idx, caption: "", data: dataUrl }]);
    editorRef.current?.focus();
    insertNodeAtCaret(makeImageNode(idx, dataUrl));
    syncBody();
  };

  const removeImage = (idx: number) => {
    const root = editorRef.current;
    root?.querySelectorAll(`img[data-img="${idx}"]`).forEach((el) => el.remove());
    setDraftImages((prev) => prev.filter((i) => i.idx !== idx));
    syncBody();
  };

  // ── Speichern ─────────────────────────────────────────────────────────────

  const save = async () => {
    if (!title.trim()) {
      setError("Bitte gib einen Titel an.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      type,
      title: title.trim(),
      summary: summary.trim(),
      body,
      authorName: author.trim(),
      published,
      pinned,
      images: draftImages.map((i) => ({ idx: i.idx, caption: i.caption, data: i.data })),
    };

    try {
      const res = await fetch(post ? `/api/news/${post.id}` : "/api/news", {
        method: post ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.push("/admin/news");
      router.refresh();
    } catch {
      setError("Der Server ist gerade nicht erreichbar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!post || !confirm(`Beitrag „${post.title}“ wirklich löschen?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/news/${post.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      router.push("/admin/news");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const previewImages = useMemo(
    () =>
      draftImages.map((img) => ({
        id: img.idx,
        postId: post?.id ?? 0,
        idx: img.idx,
        mime: mimeOf(img.data),
        caption: img.caption,
        data: base64Of(img.data),
      })),
    [draftImages, post?.id]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Kopfdaten ── */}
      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-2">
        <Field label="Titel" className="sm:col-span-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={128}
            placeholder="z. B. Update 1.4 – Auktionshaus überarbeitet"
            className={inputClass}
          />
        </Field>

        <Field label="Typ">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as NewsTypeId)}
            className={inputClass}
          >
            {NEWS_TYPES.map((t) => (
              <option key={t.id} value={t.id} className="bg-neutral-950">
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Autor"
          hint="Darf ein beliebiger Spielername sein – der Beitrag erscheint dann unter diesem Namen."
        >
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={16}
            className={inputClass}
          />
        </Field>

        <Field
          label="Kurzfassung"
          hint="Erscheint in der Übersicht und ingame über dem Text. Optional."
          className="sm:col-span-2"
        >
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={256}
            placeholder="Ein Satz, worum es geht"
            className={inputClass}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Toggle active={published} onClick={() => setPublished((v) => !v)}>
            {published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {published ? "Veröffentlicht" : "Entwurf"}
          </Toggle>
          <Toggle active={pinned} onClick={() => setPinned((v) => !v)}>
            <Pin className="h-4 w-4" />
            {pinned ? "Angepinnt" : "Nicht angepinnt"}
          </Toggle>
        </div>
      </div>

      {/* ── Werkzeugleiste ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
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

          <Divider />

          {Object.entries(LEGACY_COLORS).map(([code, hex]) => (
            <button
              key={code}
              type="button"
              title={`${LEGACY_COLOR_NAMES[code]} (&${code})`}
              onClick={() => setColor(hex)}
              className="h-6 w-6 rounded-md border border-white/20 transition-transform hover:scale-110"
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
              className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
            />
            <button
              type="button"
              onClick={() => setColor(customColor)}
              className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium hover:bg-white/20"
            >
              Anwenden
            </button>
          </label>

          <Divider />

          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            Verlauf
            <input
              type="color"
              value={gradientFrom}
              onChange={(e) => setGradientFrom(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
            />
            <input
              type="color"
              value={gradientTo}
              onChange={(e) => setGradientTo(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
            />
            <button
              type="button"
              onClick={setGradient}
              className="rounded-md px-2 py-1 text-xs font-semibold text-black"
              style={{
                backgroundImage: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
              }}
            >
              Anwenden
            </button>
          </label>

          <Divider />

          <ToolButton title="Formatierung entfernen" onClick={clearFormatting}>
            <Eraser className="h-4 w-4" />
          </ToolButton>

          <label
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10"
            title="Bild einfügen (wird als Base64 gespeichert)"
          >
            <ImagePlus className="h-4 w-4" />
            Bild
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void addImage(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {/* ── Schreibfläche ── */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncBody}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          spellCheck
          className="min-h-[280px] w-full whitespace-pre-wrap break-words p-5 text-[15px] leading-relaxed outline-none"
          data-placeholder="Schreib hier deinen Beitrag …"
        />

        <p className="border-t border-white/10 px-5 py-2.5 text-xs text-neutral-600">
          Markiere Text und klicke eine Farbe oder Formatierung an. Alles, was du hier
          siehst, sieht ingame genauso aus – Bilder ausgenommen, dort steht ein Hinweis
          auf die Website.
        </p>
      </div>

      {/* ── Bildunterschriften ── */}
      {draftImages.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="mb-3 text-sm font-semibold text-neutral-200">
            Bilder ({draftImages.length})
          </h3>
          <div className="flex flex-col gap-3">
            {draftImages.map((img) => (
              <div key={img.idx} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.data}
                  alt={`Bild ${img.idx}`}
                  className="h-14 w-20 shrink-0 rounded-lg border border-white/10 object-cover"
                />
                <input
                  value={img.caption}
                  onChange={(e) =>
                    setDraftImages((prev) =>
                      prev.map((i) =>
                        i.idx === img.idx ? { ...i, caption: e.target.value } : i
                      )
                    )
                  }
                  placeholder="Bildunterschrift (optional)"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.idx)}
                  title="Bild entfernen"
                  className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vorschau ── */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <Eye className="h-3.5 w-3.5" />
          Vorschau
        </div>
        <McText text={body} images={previewImages} className="text-[15px]" />
      </div>

      {/* ── Aktionen ── */}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {post ? "Änderungen speichern" : "Beitrag anlegen"}
        </button>

        {post && (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Löschen
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Kleinteile ─────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none transition-colors focus:border-sky-500/60";

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-neutral-600">{hint}</span>}
    </label>
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
      onMouseDown={(e) => e.preventDefault()} // Auswahl im Editor nicht verlieren
      onClick={onClick}
      className="rounded-lg p-2 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
        active
          ? "bg-sky-500/15 text-sky-300 ring-sky-500/30"
          : "text-neutral-400 ring-white/10 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-white/10" />;
}

/** Fügt einen Knoten an der aktuellen Cursorposition ein. */
function insertNodeAtCaret(node: Node) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function mimeOf(dataUrl: string): string {
  return /^data:([\w/+.-]+);base64,/.exec(dataUrl)?.[1] ?? "image/png";
}

function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
