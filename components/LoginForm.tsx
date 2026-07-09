"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "name" | "code";

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (d.ok) {
        setStep("code");
      } else {
        setError(d.error ?? "Fehler – bitte erneut versuchen.");
      }
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const d = await res.json();
      if (d.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(d.error ?? "Code ungültig.");
      }
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "name") {
    return (
      <form onSubmit={requestCode} className="flex flex-col gap-4">
        <label className="text-sm text-neutral-400">
          Dein Minecraft-Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Leon_lp9Dev"
            autoFocus
            required
            minLength={3}
            maxLength={16}
            pattern="[A-Za-z0-9_]+"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-base text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Sende…" : "Code anfordern"}
        </button>
        <p className="text-xs leading-relaxed text-neutral-500">
          Du musst dafür auf dem TryCity-Server online sein. Der Code kommt innerhalb
          weniger Sekunden in deinen Ingame-Chat.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-neutral-400">
        Wir haben <span className="font-semibold text-neutral-200">{name}</span> einen
        6-stelligen Code in den Ingame-Chat geschickt (5 Minuten gültig).
      </p>
      <label className="text-sm text-neutral-400">
        Code aus dem Chat
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          autoFocus
          required
          inputMode="numeric"
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-neutral-100 outline-none placeholder:text-neutral-700 focus:border-emerald-400/50"
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "Prüfe…" : "Anmelden"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("name");
          setCode("");
          setError(null);
        }}
        className="text-sm text-neutral-500 hover:text-neutral-300"
      >
        ← Anderen Namen verwenden / Code neu anfordern
      </button>
    </form>
  );
}
