"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  session: { name: string } | null;
};

const TABS = [
  { href: "/", label: "Startseite" },
  { href: "/stats", label: "Server-Stats" },
  { href: "/items", label: "Item-Werte" },
];

export default function Navbar({ session }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link href="/" className="mr-4 flex items-center gap-2 font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
          <span className="text-lg">
            Try<span className="text-emerald-400">City</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(tab.href)
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {session ? (
            <>
              <span className="hidden text-sm text-neutral-300 sm:inline">
                <span className="text-neutral-500">Angemeldet als </span>
                <span className="font-semibold text-emerald-300">{session.name}</span>
              </span>
              <button
                onClick={logout}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-white/5"
              >
                Abmelden
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
