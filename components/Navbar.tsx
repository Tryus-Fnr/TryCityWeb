"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, LogOut } from "lucide-react";

type Props = {
  session: { name: string; isAdmin: boolean } | null;
};

const PUBLIC_TABS = [
  { href: "/items", label: "Item-Werte" },
  { href: "/auction", label: "Auktionshaus" },
  { href: "/orders", label: "Orders" },
  { href: "/bounties", label: "Kopfgelder" },
  { href: "/regelwerk", label: "Regelwerk" },
];

const ADMIN_TABS = [
  { href: "/stats", label: "Server-Stats" },
  { href: "/servermap", label: "Server-Karte" },
  { href: "/players", label: "SMP-Spieler" },
  { href: "/maps", label: "Karten" },
];

export default function Navbar({ session }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUserMenuOpen(false);
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const tabs = session?.isAdmin
    ? [{ href: "/", label: "Startseite" }, ...PUBLIC_TABS, ...ADMIN_TABS]
    : [{ href: "/", label: "Startseite" }, ...PUBLIC_TABS];

  const tabClass = (href: string) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-sky-500/15 text-sky-300"
        : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">

        {/* ── Logo ── */}
        <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
          <Image
            src="/logo.png"
            alt="TryCity"
            height={32}
            width={120}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        {/* ── Desktop nav ── */}
        <div className="hidden items-center gap-0.5 md:flex">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className={tabClass(tab.href)}>
              {tab.label}
            </Link>
          ))}
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-2">
          {session ? (
            /* Player avatar + dropdown */
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center justify-center rounded-lg p-0.5 ring-1 ring-white/10 transition-all hover:ring-sky-400/60 focus:outline-none"
                aria-label="Benutzermenü öffnen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(session.name)}/32`}
                  alt={session.name}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-md"
                  style={{ imageRendering: "pixelated" }}
                />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur-sm">
                  {/* User info header */}
                  <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://mc-heads.net/avatar/${encodeURIComponent(session.name)}/40`}
                      alt={session.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-lg"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-100">
                        {session.name}
                      </p>
                      {session.isAdmin && (
                        <span className="mt-0.5 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="p-1">
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-neutral-100"
                    >
                      <LogOut className="h-4 w-4 shrink-0 text-neutral-500" />
                      Abmelden
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-sky-400"
            >
              Login
            </Link>
          )}

          {/* ── Hamburger (mobile only) ── */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile menu ── */}
      {menuOpen && (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-0.5">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(tab.href)
                    ? "bg-sky-500/15 text-sky-300"
                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
