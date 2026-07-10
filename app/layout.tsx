import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/session";
import { isSessionRevoked, loadIsAdmin } from "@/lib/queries";

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

  let navSession: { name: string; isAdmin: boolean } | null = null;

  if (session) {
    // Sitzungs-Widerruf prüfen (Minecraft-Befehl /weblogout)
    const revoked = session.uuid
      ? await isSessionRevoked(session.uuid, session.issuedAt)
      : false;

    if (!revoked) {
      const isAdmin = session.uuid ? await loadIsAdmin(session.uuid) : false;
      navSession = { name: session.name, isAdmin };
    }
  }

  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Navbar session={navSession} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-white/10 py-6 text-center text-sm text-neutral-500">
          TryCity Netzwerk · Alle Daten live vom Server
        </footer>
      </body>
    </html>
  );
}
