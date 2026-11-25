#!/bin/bash
# Wichtel-Glücksrad – Installationsskript für Pelican.
# Läuft im Installations-Container (node:22-bookworm-slim), das Server-Verzeichnis ist /mnt/server.
# Lädt den Code von GitHub, installiert die Abhängigkeiten und baut die Oberfläche.
# Bei einer Neuinstallation bleiben data/ (Datenbank) und .env erhalten.
set -euo pipefail

echo "== Pakete installieren"
apt-get update -qq
apt-get install -y -qq --no-install-recommends git ca-certificates > /dev/null

echo "== Code laden"
REPO="${GIT_ADDRESS:-}"
if [ -z "$REPO" ]; then
  echo "Fehler: GIT_ADDRESS ist leer. Bitte die Repo-Adresse in den Server-Variablen eintragen." >&2
  exit 1
fi
[[ "$REPO" != *.git ]] && REPO="${REPO}.git"
if [ -n "${USERNAME:-}" ] && [ -n "${ACCESS_TOKEN:-}" ]; then
  # Privates Repo: Zugangsdaten in die Adresse einsetzen (nur für diesen Klon)
  REPO="https://${USERNAME}:${ACCESS_TOKEN}@${REPO#https://}"
fi
BRANCH="${BRANCH:-main}"

rm -rf /tmp/app
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" /tmp/app
rm -rf /tmp/app/.git

mkdir -p /mnt/server
cd /mnt/server
# Alten Code entfernen, Datenbank und .env behalten
find /mnt/server -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec rm -rf {} +
cp -a /tmp/app/. /mnt/server/
rm -rf /tmp/app

echo "== Abhängigkeiten installieren"
# --ignore-scripts: better-sqlite3 bringt fertige Linux-Binärdateien mit, ein Compiler ist nicht nötig
npm ci --ignore-scripts --no-audit --no-fund --loglevel=error

echo "== Oberfläche bauen"
npm run build --silent

echo "== Entwicklungs-Pakete entfernen"
npm prune --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error

mkdir -p /mnt/server/data
echo "== Installation fertig"
