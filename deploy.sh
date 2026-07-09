#!/bin/bash
# ============================================================
#  TryCity Website – Update-Script
#  Ausführen auf dem Server als root:
#    chmod +x /opt/trycityweb/deploy.sh   (einmalig)
#    /opt/trycityweb/deploy.sh
# ============================================================

set -e   # Abbruch bei Fehler

APP_DIR="/opt/trycityweb"
SERVICE="trycityweb"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       TryCity Website – Deploy       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Ins Projektverzeichnis wechseln
cd "$APP_DIR"

# 2. Lokale Änderungen sichern, falls vorhanden (z. B. .env-Edits)
if ! git diff --quiet; then
  echo "⚠  Lokale Änderungen erkannt – stashe temporär..."
  git stash
  STASHED=true
else
  STASHED=false
fi

# 3. Neuesten Code holen
echo "▶  git pull..."
git pull

# 4. Stash wieder anwenden (z. B. lokale .env-Anpassungen)
if [ "$STASHED" = true ]; then
  echo "▶  Lokale Änderungen wieder herstellen (git stash pop)..."
  git stash pop || echo "⚠  Stash-Konflikt – bitte manuell prüfen: git status"
fi

# 5. Abhängigkeiten aktualisieren
echo "▶  npm ci..."
npm ci --prefer-offline

# 6. Produktions-Build
echo "▶  npm run build..."
npm run build

# 7. Service neu starten
echo "▶  systemctl restart $SERVICE..."
systemctl restart "$SERVICE"

# 8. Kurz warten und Status prüfen
sleep 2
if systemctl is-active --quiet "$SERVICE"; then
  echo ""
  echo "✅  Deploy erfolgreich! Service läuft."
  echo ""
  curl -s -o /dev/null -w "   HTTP-Status: %{http_code}\n" http://127.0.0.1:3000
  echo ""
else
  echo ""
  echo "❌  Service ist NICHT aktiv! Logs prüfen:"
  echo "    journalctl -u $SERVICE -n 30 --no-pager"
  echo ""
  exit 1
fi

