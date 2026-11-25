# 🎄 Wichtel-Glücksrad

Web-App fürs Wichteln, gedacht als Server auf einem [Pelican-Panel](https://pelican.dev).
Alle bekommen denselben Link und ein eigenes Passwort, drehen am Glücksrad und sehen, wen sie beschenken.

- Die Zuteilung steht vor dem ersten Drehen komplett fest: niemand zieht sich selbst, niemand wird doppelt gezogen, Ausschlüsse (z. B. Paare) werden beachtet.
- Das Rad ist nur Animation und landet auf dem vorbestimmten Namen. Bei jedem Besuch muss neu gedreht werden, um den Namen zu sehen.
- Admin-Bereich unter `/admin`: Personen und Passwörter, Ausschlüsse, Ziehung, Event-Infos, optionaler Co-Admin.
- Admin-Befehle auch in der Pelican-Konsole (`help`).
- Alles liegt in einer SQLite-Datei (`data/wichtel.db`) und wird von Pelican-Backups mitgesichert.

## Installation auf Pelican

### 1. Egg importieren
Im Panel unter **Admin → Eggs → Importieren** die Datei [`pelican/egg-wichtel-gluecksrad.yaml`](pelican/egg-wichtel-gluecksrad.yaml) hochladen
(oder die „Raw“-Adresse der Datei auf GitHub als URL angeben).

### 2. Server anlegen
- **Egg:** Wichtel-Glücksrad
- **Docker-Image:** Node.js 22
- **Allocation:** ein freier Port, die Seite läuft dann unter `http://<IP>:<Port>`
- **Ressourcen:** 512 MB RAM und 1 GB Speicher reichen locker
- **Variablen:**
  - **Admin-Passwort** (Pflicht, mindestens 8 Zeichen)
  - **Event-Titel**, optional **Budget**, **Datum**, **Ort**. Das sind nur Startwerte, später lassen sie sich im Admin ändern.
  - **Öffentliche Adresse:** leer lassen, solange es keine Domain gibt
  - **Git-Repo / Branch:** sind schon vorausgefüllt

Die Installation lädt den Code, installiert die Pakete und baut die Oberfläche. Das dauert 1–2 Minuten.

### 3. Starten
Server starten. Sobald in der Konsole `Konsole bereit` steht, läuft alles:
- Teilnehmerseite: `http://<IP>:<Port>`
- Admin: `http://<IP>:<Port>/admin`
- Konsole: `help` zeigt alle Befehle

### 4. Aktualisieren
Im Panel unter **Einstellungen → Server neu installieren**. Der Code wird neu geladen, **die Datenbank (`data/`) bleibt erhalten**.

## Ablauf fürs Wichteln
1. Im Admin unter **Personen** alle eintragen. Passwörter werden automatisch erzeugt, z. B. `tanne-zimt-472`.
2. Unter **Ausschlüsse** Paare festlegen, die sich nicht ziehen sollen.
3. Unter **Ziehung** auf **Ziehung starten**.
4. Jeder Person die Einladung schicken: Link und Passwort kopieren oder direkt per WhatsApp.
5. Unter **Personen** sieht man, wer sein Passwort schon benutzt und wer gedreht hat.

## Admin-Konsole (Pelican)
| Befehl | Wirkung |
|---|---|
| `status` | Überblick |
| `list` | Alle Personen mit Passwort und Status |
| `add <Name> [passwort]` / `remove <Name>` | Person hinzufügen / entfernen |
| `password <Name> [passwort]` | Neues Passwort |
| `exclude <Name> <Name>` / `include <Name> <Name>` | Ausschluss setzen / aufheben |
| `start` / `assignments` | Ziehung starten / Zuteilung anzeigen |
| `redraw ja` / `reset ja` | Neu auslosen / Zuteilung löschen |
| `event [feld] [wert]` | Event-Infos anzeigen oder ändern |
| `coadmin …` | Co-Admin verwalten (`coadmin` zeigt den Stand) |
| `stop` | Server beenden |

Namen mit Leerzeichen in Anführungszeichen: `add "Anna Maria"`.

## Lokale Entwicklung
Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
cp .env.example .env      # ADMIN_PASSWORD eintragen
npm run demo              # Beispieldaten anlegen und auslosen (zeigt die Passwörter)
npm run build             # Oberfläche bauen
npm start                 # http://localhost:3000
```

Beim Entwickeln mit automatischem Neuladen: `npm run dev:server` und in einem zweiten Terminal `npm run dev:web` (http://localhost:5173).

| Befehl | Zweck |
|---|---|
| `npm test` | Tests (Zuteilung, Datenbank, API, Admin) |
| `npm run typecheck` | TypeScript-Prüfung der Oberfläche |
| `npm run egg -- --repo <url>` | Egg aus `pelican/install.sh` neu erzeugen |

**Technik:** Node.js, Express, SQLite (better-sqlite3), React, TypeScript, Vite, Radix Themes.
