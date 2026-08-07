import type { NextConfig } from "next";
import path from "path";

/**
 * Anzahl paralleler Build-Prozesse.
 *
 * Ohne Angabe nimmt Next (Kerne - 1) – auf dem Server also 11. Jeder davon ist
 * ein eigener Node-Prozess und belegt schnell über ein GB. Auf der Maschine,
 * auf der auch CloudNet, MariaDB und die Minecraft-Server laufen, hat das bei
 * jedem Deploy den Speicher gesprengt: der Kernel fing an zu swappen, die
 * ganze Kiste stand, und die Spieler flogen von den Servern.
 *
 * deploy.sh setzt BUILD_CPUS (zusätzlich zu einer harten cgroup-Grenze). Ist
 * die Variable nicht gesetzt – also auf dem Entwicklungsrechner – bleibt der
 * Schlüssel ganz weg und Next baut mit voller Geschwindigkeit.
 */
const buildCpus = Number(process.env.BUILD_CPUS) || 0;

const nextConfig: NextConfig = {
  // Workspace-Root explizit setzen (verhindert falsche Lockfile-Erkennung)
  turbopack: {
    root: path.join(__dirname),
  },
  ...(buildCpus > 0 ? { experimental: { cpus: buildCpus } } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mineskin.eu" },
      { protocol: "https", hostname: "mc-heads.net" },
    ],
  },
};

export default nextConfig;
