import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { isSessionRevoked, loadIsAdmin, loadIsMod } from "@/lib/queries";
import CookieBanner from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TryCity – Server-Stats & Item-Werte",
  description:
    "Live-Statistiken des TryCity Minecraft-Netzwerks: Spielerzahlen, Item-Preise und Preisverläufe.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  let navSession: { name: string; isAdmin: boolean; isMod: boolean } | null = null;

  if (session) {
    // Sitzungs-Widerruf prüfen (Minecraft-Befehl /weblogout)
    const revoked = session.uuid
      ? await isSessionRevoked(session.uuid, session.issuedAt)
      : false;

    if (!revoked) {
      const isAdmin = session.uuid ? await loadIsAdmin(session.uuid) : false;
      const isMod = isAdmin || (session.uuid ? await loadIsMod(session.uuid) : false);
      navSession = { name: session.name, isAdmin, isMod };
    }
  }

  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Navbar session={navSession} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-white/10 py-8">
          <div className="mx-auto max-w-6xl px-4 flex flex-col items-center gap-5">
            {/* Social links */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <a
                href="https://shop.trycity.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-500/70 transition-colors hover:text-amber-400"
              >
                Store
              </a>
              <a
                href="https://discord.gg/zJaQ8tfyzh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400/70 transition-colors hover:text-indigo-400"
              >
                Discord
              </a>
              <a
                href="https://twitch.tv/tryus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400/70 transition-colors hover:text-violet-400"
              >
                Twitch · Tryus
              </a>
              <a
                href="https://www.youtube.com/@MehrTryus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-400/70 transition-colors hover:text-red-400"
              >
                YouTube · MehrTryus
              </a>
              <a
                href="https://youtube.com/@Tryusfnr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-400/70 transition-colors hover:text-red-400"
              >
                YouTube · Tryusfnr
              </a>
            </div>
            {/* Legal links */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              <Link
                href="/regelwerk"
                className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
              >
                Regelwerk
              </Link>
              <Link
                href="/impressum"
                className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
              >
                Impressum
              </Link>
              <Link
                href="/datenschutz"
                className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
              >
                Datenschutz
              </Link>
              <Link
                href="/credits"
                className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
              >
                Credits
              </Link>
            </div>
            <p className="text-xs text-neutral-600">
              TryCity Netzwerk · Alle Daten live vom Server
            </p>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
