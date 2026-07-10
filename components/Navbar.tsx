"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  session: { name: string; isAdmin: boolean } | null;
};

const PUBLIC_TABS = [
  { href: "/items", label: "Item-Werte" },
  { href: "/auction", label: "Auktionshaus" },
  { href: "/orders", label: "Orders" },
  { href: "/bounties", label: "Kopfgelder" },
];

const ADMIN_TABS = [
  { href: "/stats", label: "Server-Stats" },
  { href: "/servermap", label: "Server-Karte" },
  { href: "/players", label: "SMP-Spieler" },
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

  const tabs = session?.isAdmin
    ? [{ href: "/", label: "Startseite" }, ...PUBLIC_TABS, ...ADMIN_TABS]
    : [{ href: "/", label: "Startseite" }, ...PUBLIC_TABS];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
        <Link href="/" className="mr-4 flex items-center gap-2 font-bold tracking-tight">
          <span className="text-lg">TryCity</span>
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(tab.href)
                  ? "bg-sky-500/15 text-sky-300"
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
                <span className="font-semibold text-sky-300">{session.name}</span>
                {session.isAdmin && (
                  <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                    Admin
                  </span>
                )}
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
              className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-sky-400"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
