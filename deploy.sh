#!/bin/bash
# ============================================================
#  TryCity Website – Update-Script
#  Ausführen auf dem Server als root:
#    chmod +x /opt/trycityweb/deploy.sh   (einmalig)
#    /opt/trycityweb/deploy.sh
#
#  WARUM DIESES SCRIPT SO AUSSIEHT
#  ------------------------------------------------------------
#  Auf dieser Maschine laufen CloudNet, MariaDB, die Minecraft-
#  Server und die Website nebeneinander. Der Speicher ist
#  chronisch knapp (98 % Commit, ~1,7 GB wirklich frei).
#
#  "next build" startet standardmäßig (Kerne - 1) Node-Prozesse
#  für die Seitengenerierung – hier also 11 Stück. Jeder davon
#  belegt schnell über ein GB. Das Ergebnis war kein abgestürzter
#  Build, sondern eine eingefrorene Kiste: der Kernel swappt,
#  alles steht, die Minecraft-Server verlieren ihre Ticks und
#  werfen die Spieler raus.
#
#  Deshalb läuft alles Schwere hier in einer eigenen
#  systemd-Scope mit Speicher-, CPU- und IO-Grenze. Die setzt der
#  Kernel durch: reißt der Build die Grenze, wird NUR der Build
#  abgeschossen – der Rest der Maschine merkt nichts davon.
# ============================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/trycityweb}"
SERVICE="${SERVICE:-trycityweb}"

# ── Grenzen für den Build (per Umgebungsvariable überschreibbar) ──
# Harte Obergrenze. Darüber killt der Kernel den Build, nicht die Maschine.
BUILD_MEM_MAX="${BUILD_MEM_MAX:-3G}"
# Ab hier bremst der Kernel den Build aus, statt ihn gleich zu töten.
BUILD_MEM_HIGH="${BUILD_MEM_HIGH:-2G}"
# 300 % = drei der zwölf Kerne. Der Rest bleibt für die Server.
BUILD_CPU_QUOTA="${BUILD_CPU_QUOTA:-300%}"
# Parallele Next-Worker. Voreinstellung wären 11 – das ist der Kern des Problems.
BUILD_CPUS="${BUILD_CPUS:-2}"
# Heap je Node-Prozess.
BUILD_NODE_HEAP_MB="${BUILD_NODE_HEAP_MB:-1536}"
# Weniger als so viel frei? Dann gar nicht erst anfangen.
MIN_FREE_MB="${MIN_FREE_MB:-2200}"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       TryCity Website – Deploy       ║"
echo "╚══════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

# ── Vorabprüfung: ist überhaupt genug Luft? ─────────────────────
# Lieber sauber abbrechen als die Maschine mitreißen.
AVAIL_MB=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
echo "▶  Verfügbarer Speicher: ${AVAIL_MB} MB (benötigt: ${MIN_FREE_MB} MB)"

if [ "${AVAIL_MB}" -lt "${MIN_FREE_MB}" ] && [ "${1:-}" != "--force" ]; then
  echo ""
  echo "⛔  Zu wenig freier Speicher für einen Build."
  echo ""
  echo "    Der Build würde die Maschine ins Swappen treiben und damit"
  echo "    auch die Minecraft-Server einfrieren. Möglichkeiten:"
  echo ""
  echo "      • Später nochmal versuchen (wenn weniger Spieler online sind)"
  echo "      • Speicherfresser suchen:  systemd-cgtop -m --order=memory"
  echo "      • Auf einer anderen Maschine bauen und nur .next hochladen"
  echo "      • Trotzdem starten:        $0 --force"
  echo ""
  echo "    Mit --force bleibt die Kiste trotzdem geschützt: der Build"
  echo "    läuft in einer Speichergrenze und wird notfalls allein gekillt."
  echo ""
  exit 1
fi

# ── Alles Schwere läuft eingesperrt ─────────────────────────────
# systemd-run --scope hängt den Befehl in eine eigene cgroup mit
# Limits. nice/ionice sorgen zusätzlich dafür, dass Minecraft und
# MariaDB bei CPU und Platte Vorfahrt haben.
HAVE_SYSTEMD_RUN=false
if command -v systemd-run >/dev/null 2>&1 && [ -d /sys/fs/cgroup ]; then
  HAVE_SYSTEMD_RUN=true
fi

run_limited() {
  if [ "$HAVE_SYSTEMD_RUN" = true ]; then
    systemd-run --scope --quiet --collect \
      --unit="trycityweb-build-$$" \
      -p MemoryMax="$BUILD_MEM_MAX" \
      -p MemoryHigh="$BUILD_MEM_HIGH" \
      -p MemorySwapMax=0 \
      -p CPUQuota="$BUILD_CPU_QUOTA" \
      -p CPUWeight=20 \
      -p IOWeight=10 \
      -p TasksMax=512 \
      nice -n 19 ionice -c 3 "$@"
  else
    # Kein systemd greifbar: wenigstens Priorität runter.
    echo "⚠  systemd-run nicht verfügbar – Build läuft ohne harte Speichergrenze."
    nice -n 19 ionice -c 3 "$@"
  fi
}

if [ "$HAVE_SYSTEMD_RUN" = true ]; then
  echo "▶  Grenzen: RAM max ${BUILD_MEM_MAX} (Bremse ab ${BUILD_MEM_HIGH}), CPU ${BUILD_CPU_QUOTA}, kein Swap"
fi
echo "▶  Next-Worker: ${BUILD_CPUS} (Voreinstellung wären $(( $(nproc) - 1 )))"
echo ""

# MemorySwapMax=0 ist wichtig: ohne das weicht der Build in den Swap
# aus, statt an die Grenze zu stoßen – und genau das Swappen ist es,
# was die ganze Maschine lahmlegt.

# ── 1. Lokale Änderungen sichern (z. B. .env-Edits) ─────────────
STASHED=false
if ! git diff --quiet; then
  echo "⚠  Lokale Änderungen erkannt – stashe temporär..."
  git stash
  STASHED=true
fi

restore_stash() {
  if [ "$STASHED" = true ]; then
    echo "▶  Lokale Änderungen wiederherstellen (git stash pop)..."
    git stash pop || echo "⚠  Stash-Konflikt – bitte manuell prüfen: git status"
    STASHED=false
  fi
}
# Auch bei Abbruch zurückspielen, sonst sind die .env-Anpassungen verschwunden.
trap restore_stash EXIT

# ── 2. Neuesten Code holen ──────────────────────────────────────
echo "▶  git pull..."
git pull

restore_stash
trap - EXIT

# ── 3. Abhängigkeiten ───────────────────────────────────────────
echo "▶  npm install..."
run_limited npm install --prefer-offline --no-audit --no-fund

# ── 4. Produktions-Build ────────────────────────────────────────
echo "▶  npm run build..."
export NODE_OPTIONS="--max-old-space-size=${BUILD_NODE_HEAP_MB}"
export NEXT_TELEMETRY_DISABLED=1
export BUILD_CPUS   # wird in next.config.ts als experimental.cpus gelesen

if ! run_limited npm run build; then
  echo ""
  echo "❌  Build fehlgeschlagen – der Dienst läuft unverändert weiter."
  echo ""
  echo "    An der Speichergrenze gescheitert? Das steht im Kernel-Log:"
  echo "      journalctl -k --since '10 min ago' | grep -iv 'UFW BLOCK' | grep -i 'killed process'"
  echo ""
  echo "    Dann entweder mehr erlauben (BUILD_MEM_MAX=4G $0)"
  echo "    oder weniger parallel bauen (BUILD_CPUS=1 $0)."
  echo ""
  exit 1
fi

# Sicherheitsnetz: nur neu starten, wenn wirklich ein Build herauskam.
if [ ! -f ".next/BUILD_ID" ]; then
  echo "❌  Kein .next/BUILD_ID gefunden – Build unvollständig. Dienst bleibt, wie er ist."
  exit 1
fi

# ── 5. Dienst neu starten ───────────────────────────────────────
echo "▶  systemctl restart $SERVICE..."
systemctl restart "$SERVICE"

sleep 2
if systemctl is-active --quiet "$SERVICE"; then
  echo ""
  echo "✅  Deploy erfolgreich! Service läuft."
  echo ""
  curl -s -o /dev/null -w "   HTTP-Status: %{http_code}\n" http://127.0.0.1:3000
  echo "   Verfügbarer Speicher jetzt: $(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo) MB"
  echo ""
else
  echo ""
  echo "❌  Service ist NICHT aktiv! Logs prüfen:"
  echo "    journalctl -u $SERVICE -n 30 --no-pager"
  echo ""
  exit 1
fi
