#!/bin/bash
# ============================================================
#  TryCity Website – Einspielen eines fertigen Builds
#
#  Auf dem Server als root:
#    cd /opt/trycityweb && git pull && ./update.sh
#
#  Gebaut wird NICHT hier, sondern von GitHub Actions bei jedem
#  Push auf master (.github/workflows/build.yml). Dieses Script
#  lädt nur das fertige Archiv, tauscht es ein und startet neu.
#
#  Warum: auf dieser Maschine laufen CloudNet, MariaDB und mehrere
#  Minecraft-Server. Die belegen rund 21 von 23 GB. Ein "next build"
#  hier hat jedes Mal die ganze Kiste ins Swappen getrieben und die
#  Spieler von den Servern geworfen. Entpacken und neu starten
#  braucht dagegen fast nichts.
#
#  Geht doch mal etwas schief, wird der vorherige Stand automatisch
#  zurückgeholt.
# ============================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/trycityweb}"
SERVICE="${SERVICE:-trycityweb}"
REPO="${REPO:-Tryus-Fnr/TryCityWeb}"
RELEASE_TAG="${RELEASE_TAG:-deploy-latest}"
ARTIFACT="${ARTIFACT:-trycityweb-build.tar.gz}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000}"

URL="https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${ARTIFACT}"

# Verzeichnisse, die aus dem Archiv kommen. Alles andere (Quellcode,
# public/, .env) bleibt unangetastet.
PAYLOAD=(".next" "node_modules")

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   TryCity Website – Build einspielen ║"
echo "╚══════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

# Temporärverzeichnis bewusst INNERHALB von APP_DIR: nur dann liegen alt und
# neu auf demselben Dateisystem und "mv" ist ein Umhängen statt eines
# Kopiervorgangs über hunderte MB.
TMP="$(mktemp -d "${APP_DIR}/.update-XXXXXX")"
BACKUP="${APP_DIR}/.update-backup"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# ── 1. Archiv laden ─────────────────────────────────────────────
echo "▶  Lade Build von GitHub..."
if ! curl -fL --retry 3 --retry-delay 2 --progress-bar -o "${TMP}/${ARTIFACT}" "$URL"; then
  echo ""
  echo "❌  Download fehlgeschlagen."
  echo "    Läuft der Build noch? https://github.com/${REPO}/actions"
  exit 1
fi
echo "   Größe: $(du -h "${TMP}/${ARTIFACT}" | cut -f1)"

# ── 2. Entpacken und prüfen ─────────────────────────────────────
echo "▶  Entpacke..."
tar -xzf "${TMP}/${ARTIFACT}" -C "$TMP"

if [ ! -f "${TMP}/.next/BUILD_ID" ]; then
  echo "❌  Archiv unvollständig (kein .next/BUILD_ID) – nichts geändert."
  exit 1
fi

if [ -f "${TMP}/BUILD_INFO" ]; then
  # shellcheck disable=SC1091
  BUILD_COMMIT="$(grep '^commit=' "${TMP}/BUILD_INFO" | cut -d= -f2)"
  BUILD_TIME="$(grep '^built='  "${TMP}/BUILD_INFO" | cut -d= -f2)"
  BUILD_NODE="$(grep '^node='   "${TMP}/BUILD_INFO" | cut -d= -f2)"
  echo "   Gebaut: ${BUILD_TIME}  Commit: ${BUILD_COMMIT:0:7}  Node: ${BUILD_NODE}"

  # Passt der Build zum Quellstand hier? Wenn nicht, ist der Workflow
  # vermutlich noch nicht durch.
  LOCAL_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unbekannt)"
  if [ "$BUILD_COMMIT" != "$LOCAL_COMMIT" ] && [ "${1:-}" != "--any" ]; then
    echo ""
    echo "⚠  Der Build gehört zu einem anderen Commit als der Code hier:"
    echo "     Build : ${BUILD_COMMIT:0:7}"
    echo "     Server: ${LOCAL_COMMIT:0:7}"
    echo ""
    echo "    Meistens heißt das: der GitHub-Build läuft noch."
    echo "    Kurz warten und nochmal, oder trotzdem einspielen:"
    echo "      ./update.sh --any"
    echo ""
    exit 1
  fi
fi

# Passt der Build zur Node-Fassung auf dem Server?
if command -v node >/dev/null 2>&1 && [ -n "${BUILD_NODE:-}" ]; then
  SERVER_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  BUILD_MAJOR="$(echo "$BUILD_NODE" | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$SERVER_MAJOR" -lt "$BUILD_MAJOR" ]; then
    echo "⚠  Server hat Node ${SERVER_MAJOR}, gebaut wurde mit ${BUILD_MAJOR}."
    echo "   Läuft meistens trotzdem – bei Problemen Node auf dem Server anheben."
  fi
fi

# ── 3. Einwechseln ──────────────────────────────────────────────
# Erst alles beiseite legen, dann das Neue hinstellen. Geht etwas
# schief, kommt der alte Stand zurück.
echo "▶  Tausche Build ein..."
rm -rf "$BACKUP"; mkdir -p "$BACKUP"

rollback() {
  echo "↩  Stelle vorherigen Stand wieder her..."
  for d in "${PAYLOAD[@]}"; do
    rm -rf "${APP_DIR:?}/${d}"
    if [ -e "${BACKUP}/${d}" ]; then
      mv "${BACKUP}/${d}" "${APP_DIR}/${d}"
    fi
  done
  systemctl restart "$SERVICE" || true
}

# Ab hier ist der alte Stand beiseitegelegt. Bricht irgendetwas ab, muss er
# zurück – sonst bliebe die Website ohne .next stehen.
trap 'rollback; cleanup' ERR

for d in "${PAYLOAD[@]}"; do
  if [ -e "${APP_DIR}/${d}" ]; then
    mv "${APP_DIR}/${d}" "${BACKUP}/${d}"
  fi
  mv "${TMP}/${d}" "${APP_DIR}/${d}"
done
cp -f "${TMP}/BUILD_INFO" "${APP_DIR}/BUILD_INFO" 2>/dev/null || true

# ── 4. Neu starten und nachsehen ────────────────────────────────
echo "▶  systemctl restart ${SERVICE}..."
if ! systemctl restart "$SERVICE"; then
  echo "❌  Dienst ließ sich nicht starten."
  rollback
  exit 1
fi

# Next braucht nach dem Neustart ein paar Sekunden, bis Port 3000 offen ist.
# curl-Meldungen dabei unterdrücken – die ersten Fehlschläge sind normal und
# sahen bisher aus, als wäre etwas kaputt.
printf "▶  Warte auf Antwort"
OK=false
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 3 "$HEALTH_URL" 2>/dev/null; then OK=true; break; fi
  printf "."
  sleep 1
done
echo ""

if [ "$OK" != true ]; then
  echo ""
  echo "❌  Website antwortet nicht auf ${HEALTH_URL}."
  echo "    Logs:  journalctl -u ${SERVICE} -n 40 --no-pager"
  rollback
  exit 1
fi

trap cleanup EXIT   # ab hier ist nichts mehr zurückzurollen
rm -rf "$BACKUP"

echo ""
echo "✅  Fertig. Website läuft."
curl -s -o /dev/null -w "   HTTP-Status: %{http_code}\n" "$HEALTH_URL"
echo "   Verfügbarer Speicher: $(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo) MB"
echo ""
