# Wichtel-Glücksrad – Pelican Egg

> **An Claude Code:** Diese Datei fasst einen Planungs-Chat zusammen. Lies sie vollständig, bevor du anfängst.
> Antworte auf Deutsch. Kläre zuerst kurz die **offenen Fragen** am Ende mit mir und beginne danach mit **Schritt 1**.
> Die Pelican-Plattform ist bei mir bereits im Einsatz (dort läuft ein Minecraft-Paper-Server). Ich bin also mit dem Panel, mit Eggs und Allocations vertraut.

## Ziel
Eine Web-App als **Pelican-Egg**: Der Admin trägt eine Liste mit Namen ein. Die Namen erscheinen auf einem **Glücksrad**. Jede Person öffnet die Seite am Handy, dreht einmal und zieht dadurch ihren Wichtelpartner.

## Anforderungen
- Ein gezogener Name darf **nie doppelt** vergeben werden, auch nicht, wenn mehrere Leute gleichzeitig drehen.
- Namen **verschwinden nicht** vom Rad. Gezogene Namen werden markiert (ausgegraut oder durchgestrichen).
- **Admin-Ansicht:** wer wen gezogen hat, Teilnehmer verwalten, Einstellungen.
- Erreichbar über IP:Port bzw. eine Domain, optimiert fürs Handy.
- **Persönliche Einmal-Links** pro Person.

## Architektur (Plan)
- Node.js-App (z. B. Express oder Fastify) + SQLite (better-sqlite3), alles in einem Container
- Docker-Image: Pelican-/Pterodactyl-Yolk für Node.js 22
- Port aus der Pelican-Allocation (`SERVER_PORT`)
- Egg-Variablen: `ADMIN_PASSWORD`, `EVENT_TITLE`, `BASE_URL`, optional `BUDGET`
- Das Install-Script lädt den Code aus einem GitHub-Repo und führt `npm install` aus
- Egg-Format: Pelican JSON oder YAML, je nach Panel-Version
- Die SQLite-Datei liegt im Server-Verzeichnis und wird von Pelican-Backups mitgesichert

## Kernlogik
- Beim Start der Ziehung berechnet der Server **sofort eine gültige Gesamtzuteilung** (Derangement: niemand zieht sich selbst, Ausschlussregeln werden beachtet). Das Rad landet auf dem vorbestimmten Namen. Damit gibt es keine Sackgassen und keine doppelten Ziehungen.
- Alternative (nicht bevorzugt): Live-Ziehung mit atomarer Transaktion und Prüfung, ob noch eine Lösung möglich ist.

## Einmal-Links
- Pro Person ein zufälliges Token, z. B. `/z/k7Fq2xP9`
- Nur **einmal drehen** möglich. Der Link bleibt gültig, damit man das Ergebnis nachschauen kann.
- Wer sich selbst ziehen würde, wird durch die Zuteilung ausgeschlossen
- Optional: Link per Cookie an das Gerät binden
- Im Admin-Bereich: Link kopieren, per WhatsApp teilen, QR-Code

## Admin
- **A) Pelican-Konsole (stdin-Befehle)**, z. B. `list`, `add <Name>`, `remove <Name>`, `links`, `start`, `reset`, `status`. Durch den Pelican-Login automatisch geschützt.
- **B) Web-Admin unter `/admin`** mit `ADMIN_PASSWORD`
- Funktionen: Teilnehmer verwalten, Ziehung starten oder sperren, Zuteilung ansehen (standardmäßig verdeckt), Ausschlüsse (z. B. Paare), neu auslosen oder zurücksetzen, CSV-Export, Event-Infos (Budget, Datum, Ort)
- Ein echtes Pelican-Plugin ist verworfen (Overkill, Plugin-System noch in Entwicklung)

## Datenschutz-Punkt
Wenn gezogene Namen live markiert werden, kann man zurückverfolgen, wer wen hat. Mögliche Lösungen: nur den Fortschritt anzeigen („7 von 12 gezogen“) oder ohne Live-Push aktualisieren. **Noch offen.**

## Erreichbarkeit
- IP:Port über die Allocation
- Domain + HTTPS über einen Reverse Proxy auf dem Host (Caddy, nginx, NPM) oder einen Cloudflare Tunnel, außerhalb des Eggs. HTTPS wird empfohlen.

## Ideen für später
Wunschzettel pro Person, anonyme Fragen an den Wichtel, Budget und Datum auf der Ergebnisseite, Weihnachtsdesign, Konfetti, Vibration, Rate-Limiting.

## Reihenfolge
1. ✅ App lokal: Rad, Login per Passwort, Zuteilungslogik (Demo-Daten: `npm run demo`, Start: `npm run build` + `npm start`)
2. ✅ Admin über Konsole (`help` in der Pelican-Konsole) und Web unter `/admin` (Passwort aus `ADMIN_PASSWORD`, lokal in `.env`). Zeigt auch, wer sein Passwort schon benutzt und wer gedreht hat. Admin-Login übersteht einen Reload (Ablauf nach 30 Min. ohne Aktivität). Optionaler Co-Admin mit eigenem Passwort, der die Zuteilung je nach Einstellung gar nicht oder nur verdeckt sieht.
3. Egg schreiben und auf dem Panel testen. Egg ist fertig (`pelican/`, Repo: https://github.com/laserm4rc/wichtel-gluecksrad), der Test auf dem Panel steht noch aus.
4. Domain und HTTPS
5. Extras

## Entscheidungen (25.11.2026)
Diese Punkte ersetzen die abweichenden Angaben weiter oben.
1. **Zugang:** Alle bekommen denselben Link. Jede Person meldet sich mit ihrem eigenen Passwort an, das der Admin vergibt. Es gibt keine persönlichen Einmal-Links.
2. **Rad:** Die Zuteilung steht vor dem ersten Drehen fest (Derangement). Das Rad ist nur eine Animation ohne eigene Funktion und landet auf dem vorbestimmten Namen. Gezogene Namen werden nicht markiert. Damit ist der Datenschutz-Punkt erledigt.
3. **Admin:** Der Admin macht selbst mit. Die Zuteilung darf im Admin trotzdem immer sichtbar sein und wird nicht verdeckt.
4. **Frontend:** React + TypeScript + Vite mit Radix Themes (Design-Regeln in `CLAUDE.local.md`). Das Backend bleibt Node.js + Express + SQLite (better-sqlite3).
5. **GitHub-Repo:** öffentlich unter https://github.com/laserm4rc/wichtel-gluecksrad
6. **Pelican:** aktuelle 1.x, Egg im Format PLCN_v3 (YAML)

## Offene Fragen (für Schritt 4)
1. Gibt es schon eine Domain und einen Reverse Proxy auf dem Host?
